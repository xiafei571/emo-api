package tracearchive

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/signer/v4"
)

type Uploader interface {
	Upload(context.Context, string, string) error
}

type s3Uploader struct {
	cfg             Config
	client          *http.Client
	signer          *v4.Signer
	inventoryMu     sync.Mutex
	inventory       InventoryStats
	inventoryExpiry time.Time
}

const (
	s3EmptyPayloadHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
	inventoryCacheTTL  = 5 * time.Minute
)

func NewS3Uploader(cfg Config) Uploader {
	return &s3Uploader{cfg: cfg, signer: v4.NewSigner(), client: &http.Client{
		Timeout:       cfg.UploadTimeout,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse },
	}}
}

func (u *s3Uploader) Upload(ctx context.Context, key, filename string) error {
	f, err := os.Open(filename)
	if err != nil {
		return err
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		return err
	}
	hash := sha256.New()
	if _, err = io.Copy(hash, f); err != nil {
		return err
	}
	if _, err = f.Seek(0, io.SeekStart); err != nil {
		return err
	}
	endpoint := u.cfg.Endpoint
	if endpoint == "" {
		endpoint = "https://s3." + u.cfg.Region + ".amazonaws.com"
	}
	target, err := url.Parse(endpoint)
	if err != nil {
		return err
	}
	target.Path = "/" + u.cfg.Bucket + "/" + strings.Trim(u.cfg.Prefix, "/") + "/" + key
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, target.String(), f)
	if err != nil {
		return err
	}
	req.ContentLength = info.Size()
	req.Header.Set("Content-Type", "application/gzip")
	req.Header.Set("x-amz-checksum-sha256", base64.StdEncoding.EncodeToString(hash.Sum(nil)))
	payloadHash := hex.EncodeToString(hash.Sum(nil))
	req.Header.Set("x-amz-content-sha256", payloadHash)
	credentials := aws.Credentials{AccessKeyID: u.cfg.AccessKey, SecretAccessKey: u.cfg.SecretKey, SessionToken: u.cfg.SessionToken}
	if err = signS3Request(ctx, u.signer, credentials, req, payloadHash, u.cfg.Region, time.Now()); err != nil {
		return err
	}
	resp, err := u.client.Do(req)
	if err != nil {
		return fmt.Errorf("S3 PUT transport failed")
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var serviceError struct {
			Code      string `xml:"Code"`
			RequestID string `xml:"RequestId"`
		}
		_ = xml.Unmarshal(body, &serviceError)
		if serviceError.Code != "" || serviceError.RequestID != "" {
			return fmt.Errorf("S3 PUT status=%d code=%s request_id=%s", resp.StatusCode, serviceError.Code, serviceError.RequestID)
		}
		return fmt.Errorf("S3 PUT status=%d", resp.StatusCode)
	}
	return nil
}

func (u *s3Uploader) Inventory(ctx context.Context, refresh bool) (InventoryStats, error) {
	u.inventoryMu.Lock()
	defer u.inventoryMu.Unlock()
	if !refresh && !u.inventoryExpiry.IsZero() && time.Now().Before(u.inventoryExpiry) {
		return u.inventory, nil
	}

	stats, err := u.fetchInventory(ctx)
	if err != nil {
		return InventoryStats{}, err
	}
	u.inventory = stats
	u.inventoryExpiry = time.Now().Add(inventoryCacheTTL)
	return stats, nil
}

func (u *s3Uploader) fetchInventory(ctx context.Context) (InventoryStats, error) {
	users := map[string]struct{}{}
	sessions := map[string]struct{}{}
	daily := map[string]*DailyInventoryStats{}
	var stats InventoryStats
	continuationToken := ""
	for {
		page, err := u.listInventoryPage(ctx, continuationToken)
		if err != nil {
			return InventoryStats{}, err
		}
		for _, object := range page.Contents {
			if !strings.HasSuffix(object.Key, ".jsonl.gz") {
				continue
			}
			stats.Objects++
			stats.CompressedBytes += object.Size
			if stats.FirstUploadedAt.IsZero() || object.LastModified.Before(stats.FirstUploadedAt) {
				stats.FirstUploadedAt = object.LastModified
			}
			if object.LastModified.After(stats.LastUploadedAt) {
				stats.LastUploadedAt = object.LastModified
			}
			user := archiveKeyComponent(object.Key, "user")
			if user != "" {
				users[user] = struct{}{}
			}
			session := archiveKeyComponent(object.Key, "session")
			if session == "" || session == "unknown" {
				stats.UnknownSessionObjects++
			} else {
				stats.KnownSessionObjects++
				sessions[session] = struct{}{}
			}
			date := archiveKeyComponent(object.Key, "date")
			if date != "" {
				entry := daily[date]
				if entry == nil {
					entry = &DailyInventoryStats{Date: date}
					daily[date] = entry
				}
				entry.Objects++
				entry.CompressedBytes += object.Size
			}
		}
		if !page.IsTruncated {
			break
		}
		if page.NextContinuationToken == "" || page.NextContinuationToken == continuationToken {
			return InventoryStats{}, fmt.Errorf("S3 LIST returned an invalid continuation token")
		}
		continuationToken = page.NextContinuationToken
	}
	stats.UniqueUsers = len(users)
	stats.UniqueKnownSessions = len(sessions)
	stats.CalculatedAt = time.Now().UTC()
	for _, entry := range daily {
		stats.Daily = append(stats.Daily, *entry)
	}
	sort.Slice(stats.Daily, func(i, j int) bool { return stats.Daily[i].Date > stats.Daily[j].Date })
	return stats, nil
}

type s3InventoryPage struct {
	IsTruncated           bool   `xml:"IsTruncated"`
	NextContinuationToken string `xml:"NextContinuationToken"`
	Contents              []struct {
		Key          string    `xml:"Key"`
		Size         int64     `xml:"Size"`
		LastModified time.Time `xml:"LastModified"`
	} `xml:"Contents"`
}

func (u *s3Uploader) listInventoryPage(ctx context.Context, continuationToken string) (s3InventoryPage, error) {
	endpoint := u.cfg.Endpoint
	if endpoint == "" {
		endpoint = "https://s3." + u.cfg.Region + ".amazonaws.com"
	}
	target, err := url.Parse(endpoint)
	if err != nil {
		return s3InventoryPage{}, err
	}
	target.Path = "/" + u.cfg.Bucket
	query := target.Query()
	query.Set("list-type", "2")
	query.Set("max-keys", strconv.Itoa(1000))
	query.Set("prefix", strings.Trim(u.cfg.Prefix, "/")+"/")
	if continuationToken != "" {
		query.Set("continuation-token", continuationToken)
	}
	target.RawQuery = query.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target.String(), nil)
	if err != nil {
		return s3InventoryPage{}, err
	}
	req.Header.Set("x-amz-content-sha256", s3EmptyPayloadHash)
	credentials := aws.Credentials{AccessKeyID: u.cfg.AccessKey, SecretAccessKey: u.cfg.SecretKey, SessionToken: u.cfg.SessionToken}
	if err = signS3Request(ctx, u.signer, credentials, req, s3EmptyPayloadHash, u.cfg.Region, time.Now()); err != nil {
		return s3InventoryPage{}, err
	}
	resp, err := u.client.Do(req)
	if err != nil {
		return s3InventoryPage{}, fmt.Errorf("S3 LIST transport failed")
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
		var serviceError struct {
			Code      string `xml:"Code"`
			RequestID string `xml:"RequestId"`
		}
		_ = xml.Unmarshal(body, &serviceError)
		return s3InventoryPage{}, fmt.Errorf("S3 LIST status=%d code=%s request_id=%s", resp.StatusCode, serviceError.Code, serviceError.RequestID)
	}
	var page s3InventoryPage
	if err = xml.NewDecoder(io.LimitReader(resp.Body, 8<<20)).Decode(&page); err != nil {
		return s3InventoryPage{}, fmt.Errorf("decode S3 LIST response: %w", err)
	}
	return page, nil
}

func archiveKeyComponent(key, name string) string {
	prefix := name + "="
	for _, component := range strings.Split(key, "/") {
		if strings.HasPrefix(component, prefix) {
			return strings.TrimPrefix(component, prefix)
		}
	}
	return ""
}

func signS3Request(ctx context.Context, signer *v4.Signer, credentials aws.Credentials, req *http.Request, payloadHash, region string, signedAt time.Time) error {
	return signer.SignHTTP(ctx, credentials, req, payloadHash, "s3", region, signedAt)
}

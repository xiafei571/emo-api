package tracedatasetbatch

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/signer/v4"
)

const emptySHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

type S3Store struct {
	cfg    Config
	client *http.Client
	signer *v4.Signer
}

func NewS3Store(cfg Config) *S3Store {
	return &S3Store{cfg: cfg, signer: v4.NewSigner(), client: &http.Client{
		Timeout:       10 * time.Minute,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse },
	}}
}

func (s *S3Store) List(ctx context.Context, bucket, prefix, token string) (ObjectPage, error) {
	target, err := s.target(bucket, "")
	if err != nil {
		return ObjectPage{}, err
	}
	query := target.Query()
	query.Set("list-type", "2")
	query.Set("prefix", prefix)
	if token != "" {
		query.Set("continuation-token", token)
	}
	target.RawQuery = query.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target.String(), nil)
	if err != nil {
		return ObjectPage{}, err
	}
	resp, err := s.do(req, emptySHA256)
	if err != nil {
		return ObjectPage{}, err
	}
	defer resp.Body.Close()
	if err = requireS3Success(resp, "LIST"); err != nil {
		return ObjectPage{}, err
	}
	var result struct {
		Contents []struct {
			Key, ETag, LastModified string
			Size                    int64
		} `xml:"Contents"`
		IsTruncated           bool   `xml:"IsTruncated"`
		NextContinuationToken string `xml:"NextContinuationToken"`
	}
	if err = xml.NewDecoder(resp.Body).Decode(&result); err != nil {
		return ObjectPage{}, fmt.Errorf("decode S3 LIST response: %w", err)
	}
	page := ObjectPage{NextToken: result.NextContinuationToken}
	for _, item := range result.Contents {
		page.Objects = append(page.Objects, Object{Key: item.Key, ETag: strings.Trim(item.ETag, "\""), LastModified: item.LastModified, Size: item.Size})
	}
	if result.IsTruncated && page.NextToken == "" {
		return ObjectPage{}, fmt.Errorf("truncated S3 LIST response has no continuation token")
	}
	return page, nil
}

func (s *S3Store) Download(ctx context.Context, bucket, key string, destination io.Writer) error {
	target, err := s.target(bucket, key)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target.String(), nil)
	if err != nil {
		return err
	}
	resp, err := s.do(req, emptySHA256)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if err = requireS3Success(resp, "GET"); err != nil {
		return err
	}
	_, err = io.Copy(destination, resp.Body)
	return err
}

func (s *S3Store) UploadIfAbsent(ctx context.Context, bucket, key string, body io.ReadSeeker, size int64, contentType string) error {
	target, err := s.target(bucket, key)
	if err != nil {
		return err
	}
	hash := sha256.New()
	written, err := io.Copy(hash, body)
	if err != nil {
		return err
	}
	if written != size {
		return fmt.Errorf("upload body size mismatch")
	}
	if _, err = body.Seek(0, io.SeekStart); err != nil {
		return err
	}
	payloadHash := hex.EncodeToString(hash.Sum(nil))
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, target.String(), body)
	if err != nil {
		return err
	}
	req.ContentLength = size
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("If-None-Match", "*")
	resp, err := s.do(req, payloadHash)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return requireS3Success(resp, "PUT")
}

func (s *S3Store) do(req *http.Request, payloadHash string) (*http.Response, error) {
	req.Header.Set("x-amz-content-sha256", payloadHash)
	credentials := aws.Credentials{AccessKeyID: s.cfg.AccessKey, SecretAccessKey: s.cfg.SecretKey, SessionToken: s.cfg.SessionToken}
	if err := s.signer.SignHTTP(req.Context(), credentials, req, payloadHash, "s3", s.cfg.Region, time.Now()); err != nil {
		return nil, err
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("S3 transport failed: %w", err)
	}
	return resp, nil
}

func (s *S3Store) target(bucket, key string) (*url.URL, error) {
	endpoint := s.cfg.Endpoint
	if endpoint == "" {
		endpoint = "https://s3." + s.cfg.Region + ".amazonaws.com"
	}
	target, err := url.Parse(endpoint)
	if err != nil {
		return nil, err
	}
	target.Path = "/" + bucket
	if key != "" {
		target.Path += "/" + strings.TrimPrefix(key, "/")
	}
	return target, nil
}

func requireS3Success(resp *http.Response, operation string) error {
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	var serviceError struct {
		Code, RequestID string
	}
	_ = xml.Unmarshal(body, &serviceError)
	detail := "status=" + strconv.Itoa(resp.StatusCode)
	if serviceError.Code != "" {
		detail += " code=" + serviceError.Code
	}
	if serviceError.RequestID != "" {
		detail += " request_id=" + serviceError.RequestID
	}
	return fmt.Errorf("S3 %s %s", operation, detail)
}

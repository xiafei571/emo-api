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
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/signer/v4"
)

type Uploader interface {
	Upload(context.Context, string, string) error
}

type s3Uploader struct {
	cfg    Config
	client *http.Client
	signer *v4.Signer
}

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
	if err = u.signer.SignHTTP(ctx, credentials, req, payloadHash, "s3", u.cfg.Region, time.Now(), func(o *v4.SignerOptions) { o.DisableURIPathEscaping = true }); err != nil {
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

package tracearchive

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestS3SignedPutChecksumAndNoRedirect(t *testing.T) {
	payload := []byte{31, 139, 8, 0, 255, 42}
	var requests atomic.Int32
	var redirect atomic.Bool
	s := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		assert.Equal(t, http.MethodPut, r.Method)
		assert.Equal(t, "/test-bucket/raw/v1/user=1/session=unknown/date=2026-09-08/req_test.jsonl.gz", r.URL.Path)
		assert.Contains(t, r.Header.Get("Authorization"), "Credential=test/")
		assert.Contains(t, r.Header.Get("Authorization"), "/us-east-1/s3/aws4_request")
		assert.Equal(t, "temporary-token", r.Header.Get("X-Amz-Security-Token"))
		sum := sha256.Sum256(payload)
		assert.Equal(t, base64.StdEncoding.EncodeToString(sum[:]), r.Header.Get("x-amz-checksum-sha256"))
		assert.Equal(t, hex.EncodeToString(sum[:]), r.Header.Get("x-amz-content-sha256"))
		assert.Equal(t, "application/gzip", r.Header.Get("Content-Type"))
		assert.Empty(t, r.Header.Get("Content-Encoding"))
		b, err := io.ReadAll(r.Body)
		assert.NoError(t, err)
		assert.True(t, bytes.Equal(payload, b))
		if redirect.Load() {
			w.Header().Set("Location", "/redirect-target")
			w.WriteHeader(307)
			return
		}
		w.WriteHeader(200)
	}))
	defer s.Close()
	cfg := testConfig(t)
	cfg.Endpoint = s.URL
	cfg.SessionToken = "temporary-token"
	u := NewS3Uploader(cfg).(*s3Uploader)
	u.client.Transport = s.Client().Transport
	file := filepath.Join(t.TempDir(), "request.jsonl.gz")
	require.NoError(t, os.WriteFile(file, payload, 0600))
	key := "user=1/session=unknown/date=2026-09-08/req_test.jsonl.gz"
	require.NoError(t, u.Upload(context.Background(), key, file))
	redirect.Store(true)
	require.ErrorContains(t, u.Upload(context.Background(), key, file), "status=307")
	assert.Equal(t, int32(2), requests.Load(), "must not follow redirects with credentials")
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	require.Error(t, u.Upload(ctx, key, file))
}

func TestSignS3RequestUsesStandardPathEscaping(t *testing.T) {
	const target = "https://s3.us-east-1.amazonaws.com/test-bucket/raw/v1/user=1/session=test/date=2026-09-09/request.jsonl.gz"
	const payloadHash = "d039141f2ff4fdb8f3353d7836193293677127535438e103fc60c09a4d42d9e7"
	credentials := aws.Credentials{AccessKeyID: "test", SecretAccessKey: "secret"}
	signedAt := time.Date(2026, 9, 9, 2, 17, 37, 0, time.UTC)
	standard, err := http.NewRequest(http.MethodPut, target, nil)
	require.NoError(t, err)
	require.NoError(t, signS3Request(context.Background(), v4.NewSigner(), credentials, standard, payloadHash, "us-east-1", signedAt))
	disabled, err := http.NewRequest(http.MethodPut, target, nil)
	require.NoError(t, err)
	require.NoError(t, v4.NewSigner().SignHTTP(context.Background(), credentials, disabled, payloadHash, "s3", "us-east-1", signedAt, func(options *v4.SignerOptions) {
		options.DisableURIPathEscaping = true
	}))
	assert.NotEqual(t, disabled.Header.Get("Authorization"), standard.Header.Get("Authorization"), "keys containing '=' require standard SigV4 path escaping")
}

func TestS3UploadReportsSafeServiceError(t *testing.T) {
	s := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`<Error><Code>InvalidAccessKeyId</Code><Message>sensitive detail</Message><RequestId>request-123</RequestId></Error>`))
	}))
	defer s.Close()
	cfg := testConfig(t)
	cfg.Endpoint = s.URL
	u := NewS3Uploader(cfg).(*s3Uploader)
	u.client.Transport = s.Client().Transport
	file := filepath.Join(t.TempDir(), "request.jsonl.gz")
	require.NoError(t, os.WriteFile(file, []byte("payload"), 0600))
	err := u.Upload(context.Background(), "request.jsonl.gz", file)
	require.ErrorContains(t, err, "status=403 code=InvalidAccessKeyId request_id=request-123")
	assert.NotContains(t, err.Error(), "sensitive detail")
}

func TestS3InventoryPaginatesAndAggregatesWithoutReadingObjects(t *testing.T) {
	var requests atomic.Int32
	s := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		request := requests.Add(1)
		assert.Equal(t, http.MethodGet, r.Method)
		assert.Equal(t, "/test-bucket", r.URL.Path)
		assert.Equal(t, "raw/v1/", r.URL.Query().Get("prefix"))
		assert.Contains(t, r.Header.Get("Authorization"), "/us-east-1/s3/aws4_request")
		w.Header().Set("Content-Type", "application/xml")
		if request == 1 {
			assert.Empty(t, r.URL.Query().Get("continuation-token"))
			_, _ = w.Write([]byte(`<ListBucketResult><IsTruncated>true</IsTruncated><NextContinuationToken>next page</NextContinuationToken><Contents><Key>raw/v1/user=1/session=unknown/date=2026-09-09/one.jsonl.gz</Key><LastModified>2026-09-09T01:00:00Z</LastModified><Size>100</Size></Contents></ListBucketResult>`))
			return
		}
		assert.Equal(t, "next page", r.URL.Query().Get("continuation-token"))
		_, _ = w.Write([]byte(`<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>raw/v1/user=2/session=session-a/date=2026-09-10/two.jsonl.gz</Key><LastModified>2026-09-10T02:00:00Z</LastModified><Size>250</Size></Contents><Contents><Key>raw/v1/marker</Key><LastModified>2026-09-10T02:01:00Z</LastModified><Size>1</Size></Contents></ListBucketResult>`))
	}))
	defer s.Close()
	cfg := testConfig(t)
	cfg.Endpoint = s.URL
	u := NewS3Uploader(cfg).(*s3Uploader)
	u.client.Transport = s.Client().Transport
	stats, err := u.Inventory(context.Background(), true)
	require.NoError(t, err)
	assert.Equal(t, int64(2), stats.Objects)
	assert.Equal(t, int64(350), stats.CompressedBytes)
	assert.Equal(t, int64(1), stats.UnknownSessionObjects)
	assert.Equal(t, int64(1), stats.KnownSessionObjects)
	assert.Equal(t, 2, stats.UniqueUsers)
	assert.Equal(t, 1, stats.UniqueKnownSessions)
	require.Len(t, stats.Daily, 2)
	assert.Equal(t, "2026-09-10", stats.Daily[0].Date)
	_, err = u.Inventory(context.Background(), false)
	require.NoError(t, err)
	assert.Equal(t, int32(2), requests.Load(), "cached inventory must not list S3 again")
}

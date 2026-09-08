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

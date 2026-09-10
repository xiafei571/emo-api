package tracedatasetbatch

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestS3StoreListsDownloadsAndUploadsWithSignedRequests(t *testing.T) {
	rawKey := "raw/v1/user=1/session=abc/date=2026-09-09/req_1.jsonl.gz"
	rawBody := []byte("raw-gzip")
	var uploaded []byte
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Contains(t, r.Header.Get("Authorization"), "Credential=test-key/")
		assert.NotEmpty(t, r.Header.Get("X-Amz-Date"))
		switch {
		case r.Method == http.MethodGet && r.URL.Query().Get("list-type") == "2":
			assert.Equal(t, "raw/v1/", r.URL.Query().Get("prefix"))
			w.Header().Set("Content-Type", "application/xml")
			_, _ = io.WriteString(w, `<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>`+rawKey+`</Key><LastModified>2026-09-09T00:00:00Z</LastModified><ETag>&quot;etag-1&quot;</ETag><Size>8</Size></Contents></ListBucketResult>`)
		case r.Method == http.MethodGet:
			assert.Equal(t, "/source/"+rawKey, r.URL.Path)
			_, _ = w.Write(rawBody)
		case r.Method == http.MethodPut:
			assert.Equal(t, "*", r.Header.Get("If-None-Match"))
			assert.Equal(t, "application/zstd", r.Header.Get("Content-Type"))
			uploaded, _ = io.ReadAll(r.Body)
			w.WriteHeader(http.StatusOK)
		default:
			w.WriteHeader(http.StatusBadRequest)
		}
	}))
	defer server.Close()

	cfg := Config{Region: "ap-northeast-1", Endpoint: server.URL, AccessKey: "test-key", SecretKey: "test-secret"}
	store := NewS3Store(cfg)
	store.client = server.Client()
	page, err := store.List(context.Background(), "source", "raw/v1/", "")
	require.NoError(t, err)
	require.Len(t, page.Objects, 1)
	assert.Equal(t, rawKey, page.Objects[0].Key)
	assert.Equal(t, "etag-1", page.Objects[0].ETag)

	var downloaded bytes.Buffer
	require.NoError(t, store.Download(context.Background(), "source", rawKey, &downloaded))
	assert.Equal(t, rawBody, downloaded.Bytes())

	payload := strings.NewReader("standardized")
	require.NoError(t, store.UploadIfAbsent(context.Background(), "destination", "standardized/v1/output.zst", payload, int64(payload.Len()), "application/zstd"))
	assert.Equal(t, []byte("standardized"), uploaded)
}

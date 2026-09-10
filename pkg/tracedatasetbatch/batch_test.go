package tracedatasetbatch

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/base64"
	"io"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/tracearchive"
	"github.com/QuantumNous/new-api/pkg/tracedataset"
	"github.com/klauspost/compress/zstd"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type memoryStore struct {
	objects     map[string][]byte
	uploads     map[string][]byte
	uploadOrder []string
}

func (s *memoryStore) List(_ context.Context, bucket, prefix, token string) (ObjectPage, error) {
	if token != "" {
		return ObjectPage{}, nil
	}
	var page ObjectPage
	for key, body := range s.objects {
		if strings.HasPrefix(key, prefix) {
			page.Objects = append(page.Objects, Object{Key: key, ETag: "etag", Size: int64(len(body))})
		}
	}
	return page, nil
}

func (s *memoryStore) Download(_ context.Context, bucket, key string, destination io.Writer) error {
	_, err := destination.Write(s.objects[key])
	return err
}

func (s *memoryStore) UploadIfAbsent(_ context.Context, bucket, key string, body io.ReadSeeker, size int64, contentType string) error {
	data, err := io.ReadAll(body)
	if err != nil {
		return err
	}
	if _, exists := s.uploads[key]; exists {
		return assert.AnError
	}
	s.uploads[key] = data
	s.uploadOrder = append(s.uploadOrder, key)
	return nil
}

func TestRunDownloadsBuildsAndPublishesManifestLast(t *testing.T) {
	raw := compressedRaw(t,
		[]byte(`{"client_metadata":{"session_id":"session-1"},"input":"hello","api_key":"secret"}`),
		[]byte(`{"output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"hi"}]}]}`),
	)
	store := &memoryStore{
		objects: map[string][]byte{
			"raw/v1/user=1/session=unknown/date=2026-09-09/req_1.jsonl.gz": raw,
			"raw/v1/README.txt": []byte("ignored"),
		},
		uploads: map[string][]byte{},
	}
	cfg := Config{
		SourceBucket: "source", SourcePrefix: "raw/v1", DestinationBucket: "destination",
		OutputPrefix: "standardized/v1", Region: "ap-northeast-1", AccessKey: "key", SecretKey: "secret",
		IdentityKey: []byte("0123456789abcdef0123456789abcdef"), TempDir: t.TempDir(),
		MaxObjects: 10, MaxSourceBytes: 1 << 20,
	}
	manifest, err := Run(context.Background(), cfg, store)
	require.NoError(t, err)
	assert.Equal(t, 1, manifest.Report.Exchanges)
	assert.Equal(t, 1, manifest.Report.Sessions)
	require.Len(t, store.uploadOrder, 3)
	assert.True(t, strings.HasSuffix(store.uploadOrder[0], "/exchanges.jsonl.zst"))
	assert.True(t, strings.HasSuffix(store.uploadOrder[1], "/sessions.jsonl.zst"))
	assert.True(t, strings.HasSuffix(store.uploadOrder[2], "/manifest.json"))

	var exchange tracedataset.Exchange
	decodeZstdLine(t, store.uploads[manifest.ExchangeObject], &exchange)
	assert.True(t, exchange.SessionKnown)
	request := exchange.ClientRequest.Data.(map[string]any)
	assert.Equal(t, "[REDACTED]", request["api_key"])
}

func compressedRaw(t *testing.T, request, response []byte) []byte {
	t.Helper()
	var buffer bytes.Buffer
	gz := gzip.NewWriter(&buffer)
	events := []tracearchive.Event{
		{SchemaVersion: 1, Type: "request.start", Seq: 0, Timestamp: "2026-09-09T00:00:00Z", Metadata: &tracearchive.Metadata{ArchiveID: "archive-1", RequestID: "request-1", UserID: 1, Path: "/v1/responses", ContentType: "application/json", SessionSource: "unknown"}},
		{SchemaVersion: 1, Type: "request.chunk", Seq: 1, Timestamp: "2026-09-09T00:00:01Z", BodyEncoding: "base64", BodyRaw: base64.StdEncoding.EncodeToString(request)},
		{SchemaVersion: 1, Type: "response.chunk", Seq: 2, Timestamp: "2026-09-09T00:00:02Z", BodyEncoding: "base64", BodyRaw: base64.StdEncoding.EncodeToString(response)},
		{SchemaVersion: 1, Type: "request.end", Seq: 3, Timestamp: "2026-09-09T00:00:03Z", End: &tracearchive.End{Status: 200, ContentType: "application/json", Model: "gpt-test", CaptureComplete: true, Reason: "handler_returned"}},
	}
	for _, event := range events {
		data, err := common.Marshal(event)
		require.NoError(t, err)
		_, err = gz.Write(append(data, '\n'))
		require.NoError(t, err)
	}
	require.NoError(t, gz.Close())
	return buffer.Bytes()
}

func decodeZstdLine(t *testing.T, data []byte, target any) {
	t.Helper()
	decoder, err := zstd.NewReader(bytes.NewReader(data))
	require.NoError(t, err)
	defer decoder.Close()
	decoded, err := io.ReadAll(decoder)
	require.NoError(t, err)
	require.NoError(t, common.Unmarshal(bytes.TrimSpace(decoded), target))
}

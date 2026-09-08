package tracearchive

import (
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type uploadFunc func(context.Context, string, string) error

func (f uploadFunc) Upload(ctx context.Context, key, file string) error { return f(ctx, key, file) }

func testConfig(t *testing.T) Config {
	return Config{Enabled: true, SpoolDir: t.TempDir(), Bucket: "test-bucket", Prefix: "raw/v1", Region: "us-east-1", AccessKey: "test", SecretKey: "test", Workers: 2, MaxRequestBytes: 1 << 20, MaxSpoolBytes: 16 << 20, ScanInterval: time.Second, UploadTimeout: time.Second}
}

func readEvents(t *testing.T, data []byte) []Event {
	t.Helper()
	var events []Event
	for _, line := range bytes.Split(bytes.TrimSpace(data), []byte{'\n'}) {
		var e Event
		require.NoError(t, common.Unmarshal(line, &e))
		assert.Equal(t, int64(len(events)), e.Seq)
		assert.Equal(t, 1, e.SchemaVersion)
		events = append(events, e)
	}
	return events
}

func rawBody(t *testing.T, events []Event, kind string) []byte {
	t.Helper()
	var out []byte
	for _, e := range events {
		if e.Type != kind {
			continue
		}
		assert.Equal(t, "base64", e.BodyEncoding)
		b, err := base64.StdEncoding.DecodeString(e.BodyRaw)
		require.NoError(t, err)
		out = append(out, b...)
	}
	return out
}

func TestArchiveLosslessUploadRetryAndRecovery(t *testing.T) {
	cfg := testConfig(t)
	var keys []string
	var uploaded []byte
	fail := true
	u := uploadFunc(func(_ context.Context, key, file string) error {
		keys = append(keys, key)
		if fail {
			return fmt.Errorf("temporary unavailable")
		}
		f, err := os.Open(file)
		require.NoError(t, err)
		defer f.Close()
		z, err := gzip.NewReader(f)
		require.NoError(t, err)
		defer z.Close()
		uploaded, err = io.ReadAll(z)
		require.NoError(t, err)
		return nil
	})
	a, err := Open(cfg, u)
	require.NoError(t, err)
	now := time.Date(2026, 9, 8, 2, 0, 0, 0, time.UTC)
	r, err := a.Begin(Metadata{UserID: 42, APIKeyID: 7, SessionID: "../../session/日本語", SessionSource: "header:X-EMO-Session-ID", Method: "POST", Path: "/v1/responses"}, now)
	require.NoError(t, err)
	request := append(bytes.Repeat([]byte("字"), 12000), 0, 255)
	response := []byte("data: {\"text\":\"hello\"}\n\ndata: [DONE]\n\n")
	r.Append("request.chunk", request)
	r.Append("response.chunk", response[:7])
	r.Append("response.chunk", response[7:])
	r.SetUsage(Usage{PromptTokens: 5, CompletionTokens: 9, Quota: 2})
	r.Finish(End{Status: 200, CaptureComplete: true, Reason: "handler_returned"})
	ready := strings.TrimSuffix(r.path, ".open") + ".ready"
	require.Error(t, a.upload(ready))
	packed := archiveStem(ready) + ".jsonl.gz"
	require.FileExists(t, packed)
	a.Close()
	fail = false
	a, err = Open(cfg, u)
	require.NoError(t, err)
	defer a.Close()
	require.NoError(t, a.upload(packed))
	require.Len(t, keys, 2)
	assert.Equal(t, keys[0], keys[1])
	expectedPrefix := fmt.Sprintf("user=42/session=%x/date=2026-09-08/req_", sha256.Sum256([]byte("../../session/日本語")))
	assert.True(t, strings.HasPrefix(keys[0], expectedPrefix))
	events := readEvents(t, uploaded)
	assert.Equal(t, request, rawBody(t, events, "request.chunk"))
	assert.Equal(t, response, rawBody(t, events, "response.chunk"))
	assert.Equal(t, "../../session/日本語", events[0].Metadata.SessionID)
	last := events[len(events)-1]
	require.NotNil(t, last.End)
	assert.True(t, last.End.CaptureComplete)
	assert.Equal(t, 9, last.End.Usage.CompletionTokens)
	assert.NoFileExists(t, packed)
	assert.Zero(t, a.Stats().SpoolBytes)
}

func TestCrashRecoveryAndExclusiveSpool(t *testing.T) {
	for _, completed := range []bool{false, true} {
		t.Run(fmt.Sprint(completed), func(t *testing.T) {
			cfg := testConfig(t)
			u := uploadFunc(func(context.Context, string, string) error { return nil })
			a, err := Open(cfg, u)
			require.NoError(t, err)
			_, err = Open(cfg, u)
			require.Error(t, err, "two processes must not upload the same spool")
			r, err := a.Begin(Metadata{UserID: 1}, time.Now())
			require.NoError(t, err)
			r.Append("request.chunk", []byte("original"))
			if completed {
				require.NoError(t, r.write(Event{Type: "request.end", End: &End{CaptureComplete: true, Reason: "handler_returned"}}))
			}
			_, err = r.f.WriteString("{\"partial\":")
			require.NoError(t, err)
			require.NoError(t, r.f.Close())
			a.Close()
			a, err = Open(cfg, u)
			require.NoError(t, err)
			defer a.Close()
			data, err := os.ReadFile(strings.TrimSuffix(r.path, ".open") + ".ready")
			require.NoError(t, err)
			events := readEvents(t, data)
			require.Len(t, events, 3)
			assert.Equal(t, "unknown", events[0].Metadata.SessionSource)
			assert.Equal(t, completed, events[2].End.CaptureComplete)
			if !completed {
				assert.Equal(t, "process_interrupted", events[2].End.Reason)
			}
			assert.Equal(t, int64(len(data)), a.Stats().SpoolBytes)
		})
	}
}

func TestArchiveLimitsMarkIncompleteAndDoNotGrowUnbounded(t *testing.T) {
	cfg := testConfig(t)
	cfg.MaxRequestBytes = 4096
	a, err := Open(cfg, uploadFunc(func(context.Context, string, string) error { return nil }))
	require.NoError(t, err)
	defer a.Close()
	r, err := a.Begin(Metadata{UserID: 1}, time.Now())
	require.NoError(t, err)
	r.Append("request.chunk", []byte("first"))
	r.Append("response.chunk", bytes.Repeat([]byte{'x'}, 8192))
	r.Finish(End{Status: 200, CaptureComplete: true})
	data, err := os.ReadFile(strings.TrimSuffix(r.path, ".open") + ".ready")
	require.NoError(t, err)
	events := readEvents(t, data)
	last := events[len(events)-1].End
	assert.False(t, last.CaptureComplete)
	assert.Equal(t, "request_limit", last.CaptureError)
	assert.Less(t, len(data), int(cfg.MaxRequestBytes))
	a.bytes.Store(cfg.MaxSpoolBytes)
	_, err = a.Begin(Metadata{UserID: 1}, time.Now())
	require.Error(t, err)
	_, err = a.Begin(Metadata{UserID: 0}, time.Now())
	require.Error(t, err)
}

func TestWorkersUploadFinalizedRequests(t *testing.T) {
	cfg := testConfig(t)
	seen := make(chan string, 1)
	a, err := Open(cfg, uploadFunc(func(_ context.Context, key, _ string) error { seen <- key; return nil }))
	require.NoError(t, err)
	a.Start()
	defer a.Close()
	r, err := a.Begin(Metadata{UserID: 9}, time.Now())
	require.NoError(t, err)
	r.Append("response.chunk", []byte("ok"))
	r.Finish(End{CaptureComplete: true})
	select {
	case key := <-seen:
		assert.Contains(t, key, "user=9/session=unknown/")
	case <-time.After(5 * time.Second):
		t.Fatal("finalized request was not asynchronously uploaded")
	}
}

func TestConfigurationRejectsUnsafeStorage(t *testing.T) {
	for _, endpoint := range []string{"http://s3.example", "https://user:secret@s3.example", "https://s3.example/path"} {
		cfg := testConfig(t)
		cfg.Endpoint = endpoint
		require.Error(t, cfg.Validate())
	}
	cfg := testConfig(t)
	cfg.Prefix = "raw/../other"
	require.Error(t, cfg.Validate())
	t.Setenv("TRACE_ARCHIVE_ENABLED", "false")
	t.Setenv("TRACE_ARCHIVE_SECRET_ACCESS_KEY", "")
	got, err := ConfigFromEnv()
	require.NoError(t, err)
	assert.False(t, got.Enabled)
	cfg = testConfig(t)
	require.NoError(t, os.Symlink(t.TempDir(), filepath.Join(cfg.SpoolDir, "escape")))
	_, err = Open(cfg, uploadFunc(func(context.Context, string, string) error { return nil }))
	require.Error(t, err)
}

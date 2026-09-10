package middleware

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/tracearchive"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type unusedTraceUploader struct{}

func (unusedTraceUploader) Upload(context.Context, string, string) error {
	return fmt.Errorf("no external upload in middleware tests")
}

func traceFixture(t *testing.T) (*tracearchive.Archive, string) {
	t.Helper()
	dir := t.TempDir()
	a, err := tracearchive.Open(tracearchive.Config{SpoolDir: dir, Bucket: "test", Prefix: "raw/v1", Region: "us-east-1", AccessKey: "test", SecretKey: "test", Workers: 1, MaxRequestBytes: 1 << 20, MaxSpoolBytes: 16 << 20, ScanInterval: time.Second, UploadTimeout: time.Second}, unusedTraceUploader{})
	require.NoError(t, err)
	t.Cleanup(a.Close)
	return a, dir
}

func capturedTrace(t *testing.T, dir string) ([]tracearchive.Event, map[string][]byte) {
	t.Helper()
	var files []string
	require.NoError(t, filepath.WalkDir(dir, func(path string, e fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if strings.HasSuffix(path, ".ready") {
			files = append(files, path)
		}
		return nil
	}))
	require.Len(t, files, 1)
	data, err := os.ReadFile(files[0])
	require.NoError(t, err)
	var events []tracearchive.Event
	bodies := map[string][]byte{}
	for _, line := range bytes.Split(bytes.TrimSpace(data), []byte{'\n'}) {
		var e tracearchive.Event
		require.NoError(t, common.Unmarshal(line, &e))
		events = append(events, e)
		if e.BodyEncoding == "base64" {
			b, err := base64.StdEncoding.DecodeString(e.BodyRaw)
			require.NoError(t, err)
			bodies[e.Type] = append(bodies[e.Type], b...)
		}
	}
	assert.NotContains(t, string(data), "do-not-store-secret")
	return events, bodies
}

func TestRawTracePreservesHTTPAndBodyReuse(t *testing.T) {
	oldLogConsume := common.LogConsumeEnabled
	common.LogConsumeEnabled = false
	defer func() { common.LogConsumeEnabled = oldLogConsume }()
	a, dir := traceFixture(t)
	g := gin.New()
	g.Use(func(c *gin.Context) { c.Set("id", 17); c.Set("token_id", 8) }, RawTraceArchive(a))
	body := []byte(`{"model":"test","input":"日本語","tools":[]}`)
	response := "data: {\"delta\":\"hello\"}\n\ndata: [DONE]\n\n"
	g.POST("/v1/responses", func(c *gin.Context) {
		b, err := io.ReadAll(c.Request.Body)
		require.NoError(t, err)
		assert.Equal(t, body, b)
		// Simulate downstream cached body and content-length rewriting, without recapturing it.
		c.Request.Body = io.NopCloser(bytes.NewReader(b))
		c.Request.ContentLength = 1
		b, err = io.ReadAll(c.Request.Body)
		require.NoError(t, err)
		assert.Equal(t, body, b)
		model.RecordConsumeLog(c, 17, model.RecordConsumeLogParams{PromptTokens: 11, CompletionTokens: 3})
		c.Header("Content-Type", "text/event-stream")
		c.Status(http.StatusAccepted)
		_, err = c.Writer.WriteString(response[:12])
		require.NoError(t, err)
		c.Writer.Flush()
		_, err = c.Writer.Write([]byte(response[12:]))
		require.NoError(t, err)
		assert.NotNil(t, c.Writer.(*traceWriter).Unwrap())
	})
	req := httptest.NewRequest("POST", "/v1/responses?key=do-not-store-secret", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer do-not-store-secret")
	req.Header.Set("Cookie", "do-not-store-secret")
	req.Header.Set("X-EMO-Session-ID", "session-42")
	w := httptest.NewRecorder()
	g.ServeHTTP(w, req)
	assert.Equal(t, 202, w.Code)
	assert.Equal(t, response, w.Body.String())
	assert.True(t, w.Flushed)
	events, bodies := capturedTrace(t, dir)
	assert.Equal(t, body, bodies["request.chunk"])
	assert.Equal(t, []byte(response), bodies["response.chunk"])
	assert.Equal(t, "session-42", events[0].Metadata.SessionID)
	assert.Equal(t, 17, events[0].Metadata.UserID)
	end := events[len(events)-1].End
	require.NotNil(t, end)
	assert.True(t, end.CaptureComplete)
	assert.Equal(t, 3, end.Usage.CompletionTokens)
	assert.Equal(t, "unknown", end.StreamEndReason)
}

func TestRawTraceResolvesCodexSessionFromResponsesBody(t *testing.T) {
	a, dir := traceFixture(t)
	g := gin.New()
	g.Use(func(c *gin.Context) { c.Set("id", 17); c.Set("token_id", 8) }, RawTraceArchive(a))
	body := []byte(`{"model":"gpt-5.6-sol","client_metadata":{"session_id":"codex-session","thread_id":"codex-thread"},"prompt_cache_key":"cache-key","input":[]}`)
	g.POST("/v1/responses", func(c *gin.Context) {
		actual, err := io.ReadAll(c.Request.Body)
		require.NoError(t, err)
		assert.Equal(t, body, actual)
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/responses", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	w := httptest.NewRecorder()
	g.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	events, bodies := capturedTrace(t, dir)
	assert.Equal(t, body, bodies["request.chunk"])
	require.NotNil(t, events[0].Metadata)
	assert.Equal(t, "codex-session", events[0].Metadata.SessionID)
	assert.Equal(t, "body:client_metadata.session_id", events[0].Metadata.SessionSource)
}

func TestRawTraceSessionHeaderOverridesResponsesBody(t *testing.T) {
	a, dir := traceFixture(t)
	g := gin.New()
	g.Use(func(c *gin.Context) { c.Set("id", 17) }, RawTraceArchive(a))
	body := []byte(`{"client_metadata":{"session_id":"body-session"}}`)
	g.POST("/v1/responses", func(c *gin.Context) {
		actual, err := io.ReadAll(c.Request.Body)
		require.NoError(t, err)
		assert.Equal(t, body, actual)
		c.Status(http.StatusNoContent)
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/responses", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-EMO-Session-ID", "header-session")
	w := httptest.NewRecorder()
	g.ServeHTTP(w, req)

	events, _ := capturedTrace(t, dir)
	require.NotNil(t, events[0].Metadata)
	assert.Equal(t, "header-session", events[0].Metadata.SessionID)
	assert.Equal(t, "header:X-EMO-Session-ID", events[0].Metadata.SessionSource)
}

func TestTraceSessionBodyFallbackOrder(t *testing.T) {
	for _, test := range []struct {
		name, body, session, source string
	}{
		{"thread", `{"client_metadata":{"thread_id":"thread-id"},"prompt_cache_key":"cache-id"}`, "thread-id", "body:client_metadata.thread_id"},
		{"cache", `{"prompt_cache_key":"cache-id"}`, "cache-id", "body:prompt_cache_key"},
		{"chat-not-guessed", `{"session_id":"custom-id","messages":[]}`, "", "unknown"},
	} {
		t.Run(test.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			path := "/v1/responses"
			if test.name == "chat-not-guessed" {
				path = "/v1/chat/completions"
			}
			c.Request = httptest.NewRequest(http.MethodPost, path, strings.NewReader(test.body))
			c.Request.Header.Set("Content-Type", "application/json")
			session, source := traceSession(c)
			assert.Equal(t, test.session, session)
			assert.Equal(t, test.source, source)
			restored, err := io.ReadAll(c.Request.Body)
			require.NoError(t, err)
			assert.Equal(t, test.body, string(restored))
		})
	}
}

func TestRawTraceFailureAndCancellation(t *testing.T) {
	for _, mode := range []string{"unread", "cancelled", "panic"} {
		t.Run(mode, func(t *testing.T) {
			a, dir := traceFixture(t)
			g := gin.New()
			g.Use(gin.Recovery(), func(c *gin.Context) { c.Set("id", 1) }, RawTraceArchive(a))
			g.POST("/v1/responses", func(c *gin.Context) {
				if mode == "panic" {
					panic("test panic")
				}
				c.String(200, "unchanged")
			})
			req := httptest.NewRequest("POST", "/v1/responses", strings.NewReader("request"))
			if mode == "cancelled" {
				ctx, cancel := context.WithCancel(req.Context())
				cancel()
				req = req.WithContext(ctx)
			}
			w := httptest.NewRecorder()
			g.ServeHTTP(w, req)
			events, _ := capturedTrace(t, dir)
			end := events[len(events)-1].End
			assert.False(t, end.CaptureComplete)
			want := map[string]string{"unread": "body_not_fully_observed", "cancelled": "client_cancelled", "panic": "handler_panic"}
			assert.Equal(t, want[mode], end.Reason)
			if mode == "panic" {
				assert.Equal(t, 500, w.Code)
			} else {
				assert.Equal(t, "unchanged", w.Body.String())
			}
		})
	}
}

func TestRawTraceCompletedStreamIsNotRelabelledCancelled(t *testing.T) {
	a, dir := traceFixture(t)
	ctx, cancel := context.WithCancel(context.Background())
	req := httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader("{}"))
	req = req.WithContext(ctx)
	// Simulate transport cleanup after a complete terminal event but before the
	// archive middleware's deferred finalizer runs.
	g := gin.New()
	g.Use(func(c *gin.Context) { c.Set("id", 1) }, RawTraceArchive(a))
	g.POST("/v1/responses", func(c *gin.Context) {
		_, err := io.ReadAll(c.Request.Body)
		require.NoError(t, err)
		status := relaycommon.NewStreamStatus()
		status.SetEndReason(relaycommon.StreamEndReasonDone, nil)
		c.Set(tracearchive.StreamContextKey, status)
		c.Header("Content-Type", "text/event-stream")
		_, err = c.Writer.WriteString("data: [DONE]\n\n")
		require.NoError(t, err)
		cancel()
	})
	w := httptest.NewRecorder()
	g.ServeHTTP(w, req)
	events, _ := capturedTrace(t, dir)
	end := events[len(events)-1].End
	require.NotNil(t, end)
	assert.True(t, end.CaptureComplete)
	assert.Equal(t, "handler_returned", end.Reason)
	assert.Equal(t, "done", end.StreamEndReason)
}

func TestRawTraceDisabledOrUnauthenticatedIsTransparent(t *testing.T) {
	for _, disabled := range []bool{true, false} {
		t.Run(fmt.Sprint(disabled), func(t *testing.T) {
			a, _ := traceFixture(t)
			g := gin.New()
			if disabled {
				g.Use(func(c *gin.Context) { c.Set("id", 1) }, RawTraceArchive(nil))
			} else {
				g.Use(RawTraceArchive(a))
			}
			g.POST("/v1/responses", func(c *gin.Context) {
				b, err := io.ReadAll(c.Request.Body)
				require.NoError(t, err)
				c.Data(200, "application/json", b)
			})
			w := httptest.NewRecorder()
			g.ServeHTTP(w, httptest.NewRequest("POST", "/v1/responses", strings.NewReader("original")))
			assert.Equal(t, "original", w.Body.String())
			assert.Zero(t, a.Stats().Started)
		})
	}
}

func TestRawTraceLocalStorageFailureDoesNotFailRequest(t *testing.T) {
	a, dir := traceFixture(t)
	// Break only the archive destination, not the API transport.
	require.NoError(t, os.Rename(dir, dir+"-offline"))
	t.Cleanup(func() { require.NoError(t, os.Remove(dir)); require.NoError(t, os.Rename(dir+"-offline", dir)) })
	require.NoError(t, os.WriteFile(dir, []byte("not a directory"), 0600))
	g := gin.New()
	g.Use(func(c *gin.Context) { c.Set("id", 1) }, RawTraceArchive(a))
	g.POST("/v1/responses", func(c *gin.Context) {
		b, err := io.ReadAll(c.Request.Body)
		require.NoError(t, err)
		c.Data(201, "application/octet-stream", b)
	})
	w := httptest.NewRecorder()
	g.ServeHTTP(w, httptest.NewRequest("POST", "/v1/responses", strings.NewReader("untouched")))
	assert.Equal(t, 201, w.Code)
	assert.Equal(t, "untouched", w.Body.String())
	assert.Equal(t, int64(1), a.Stats().Failures)
}

type traceFailReader struct{}

func (traceFailReader) Read([]byte) (int, error) { return 0, io.ErrUnexpectedEOF }

type traceFailWriter struct{ gin.ResponseWriter }

func (w traceFailWriter) Write(p []byte) (int, error) {
	n, _ := w.ResponseWriter.Write(p[:2])
	return n, io.ErrClosedPipe
}

func TestRawTraceTransportErrorsPreserveObservedBytes(t *testing.T) {
	a, dir := traceFixture(t)
	g := gin.New()
	g.Use(func(c *gin.Context) { c.Set("id", 1); c.Writer = traceFailWriter{c.Writer} }, RawTraceArchive(a))
	g.POST("/v1/responses", func(c *gin.Context) {
		b, err := io.ReadAll(c.Request.Body)
		assert.Equal(t, "partial", string(b))
		require.ErrorIs(t, err, io.ErrUnexpectedEOF)
		n, err := c.Writer.Write([]byte("response"))
		assert.Equal(t, 2, n)
		require.ErrorIs(t, err, io.ErrClosedPipe)
	})
	req := httptest.NewRequest("POST", "/v1/responses", io.MultiReader(strings.NewReader("partial"), traceFailReader{}))
	w := httptest.NewRecorder()
	g.ServeHTTP(w, req)
	assert.Equal(t, "re", w.Body.String())
	events, bodies := capturedTrace(t, dir)
	assert.Equal(t, []byte("partial"), bodies["request.chunk"])
	assert.Equal(t, []byte("re"), bodies["response.chunk"])
	end := events[len(events)-1].End
	assert.False(t, end.CaptureComplete)
	assert.Equal(t, "client_write_failed", end.Reason)
}

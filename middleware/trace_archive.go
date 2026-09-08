package middleware

import (
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/pkg/tracearchive"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

// Initialized once before routes are registered; nil means disabled.
var AgentTraceArchive *tracearchive.Archive

func RawTraceArchive(a *tracearchive.Archive) gin.HandlerFunc {
	return func(c *gin.Context) {
		if a == nil || c.Request.Method != http.MethodPost || c.GetInt("id") <= 0 {
			c.Next()
			return
		}
		started := time.Now()
		originalLength := c.Request.ContentLength
		session, source := c.GetHeader("X-EMO-Session-ID"), "header:X-EMO-Session-ID"
		if session == "" {
			session, source = c.GetHeader("session_id"), "header:session_id"
		}
		recorder, err := a.Begin(tracearchive.Metadata{
			RequestID: c.GetString(common.RequestIdKey), UserID: c.GetInt("id"), APIKeyID: c.GetInt("token_id"),
			SessionID: session, SessionSource: source, Method: c.Request.Method, Path: c.Request.URL.Path,
			ContentType: c.GetHeader("Content-Type"), ContentLength: c.Request.ContentLength,
		}, started)
		if err != nil {
			a.CaptureSkipped()
			c.Next()
			return
		}
		c.Set(tracearchive.ContextKey, recorder)
		body := &traceBody{ReadCloser: c.Request.Body, recorder: recorder}
		if c.Request.Body != nil {
			c.Request.Body = body
		} else {
			body.eof = true
		}
		originalWriter := c.Writer
		writer := &traceWriter{ResponseWriter: originalWriter, recorder: recorder}
		c.Writer = writer
		defer func() {
			panicValue := recover()
			end := tracearchive.End{
				Status: writer.Status(), ContentType: writer.Header().Get("Content-Type"),
				Model: common.GetContextKeyString(c, constant.ContextKeyOriginalModel),
				Group: common.GetContextKeyString(c, constant.ContextKeyUsingGroup), ChannelID: c.GetInt("channel_id"),
				UpstreamRequestID: c.GetString(common.UpstreamRequestIdKey), DurationMS: time.Since(started).Milliseconds(),
				RequestBytes: body.bytes, ResponseBytes: writer.bytes, Reason: "handler_returned",
				CaptureComplete: !body.failed && !writer.failed && (body.eof || (originalLength >= 0 && body.bytes == originalLength)),
			}
			if v, exists := c.Get(tracearchive.StreamContextKey); exists {
				if stream, ok := v.(*relaycommon.StreamStatus); ok && stream != nil {
					end.StreamEndReason = string(stream.EndReason)
					end.StreamErrorCount = stream.TotalErrorCount()
				}
			} else if strings.HasPrefix(end.ContentType, "text/event-stream") {
				end.StreamEndReason = "unknown"
			}
			if !end.CaptureComplete {
				end.Reason = "body_not_fully_observed"
			}
			if writer.failed {
				end.Reason = "client_write_failed"
			}
			if c.Request.Context().Err() != nil {
				end.Reason, end.CaptureComplete = "client_cancelled", false
			}
			if panicValue != nil {
				end.Reason, end.CaptureComplete, end.Status = "handler_panic", false, http.StatusInternalServerError
			}
			recorder.Finish(end)
			c.Writer = originalWriter
			if panicValue != nil {
				panic(panicValue)
			}
		}()
		c.Next()
	}
}

type traceBody struct {
	io.ReadCloser
	recorder    *tracearchive.Recorder
	bytes       int64
	eof, failed bool
}

func (r *traceBody) Read(p []byte) (int, error) {
	n, err := r.ReadCloser.Read(p)
	if n > 0 {
		r.bytes += int64(n)
		r.recorder.Append("request.chunk", p[:n])
	}
	if err == io.EOF {
		r.eof = true
	} else if err != nil {
		r.failed = true
	}
	return n, err
}

type traceWriter struct {
	gin.ResponseWriter
	recorder *tracearchive.Recorder
	mu       sync.Mutex
	bytes    int64
	failed   bool
}

func (w *traceWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	n, err := w.ResponseWriter.Write(p)
	if n > 0 {
		w.bytes += int64(n)
		w.recorder.Append("response.chunk", p[:n])
	}
	if err != nil {
		w.failed = true
	}
	return n, err
}

func (w *traceWriter) WriteString(s string) (int, error) {
	// Route through the same byte capture path; Gin's WriteString otherwise bypasses Write.
	return w.Write([]byte(s))
}

func (w *traceWriter) Flush() {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.ResponseWriter.Flush()
}

func (w *traceWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

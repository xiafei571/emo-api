package tracearchive

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/google/uuid"
)

const ContextKey = "emo.trace_archive"
const StreamContextKey = "emo.trace_archive.stream"
const chunkSize = 32 << 10

type Metadata struct {
	ArchiveID     string `json:"archive_id"`
	RequestID     string `json:"request_id"`
	UserID        int    `json:"user_id"`
	APIKeyID      int    `json:"api_key_id"`
	SessionID     string `json:"session_id,omitempty"`
	SessionSource string `json:"session_source"`
	Method        string `json:"method"`
	Path          string `json:"path"`
	ContentType   string `json:"content_type"`
	ContentLength int64  `json:"content_length"`
}

type End struct {
	Status            int    `json:"http_status"`
	ContentType       string `json:"content_type"`
	Model             string `json:"model,omitempty"`
	Group             string `json:"group,omitempty"`
	ChannelID         int    `json:"channel_id,omitempty"`
	UpstreamRequestID string `json:"upstream_request_id,omitempty"`
	DurationMS        int64  `json:"duration_ms"`
	RequestBytes      int64  `json:"request_bytes"`
	ResponseBytes     int64  `json:"response_bytes"`
	CaptureComplete   bool   `json:"capture_complete"`
	Reason            string `json:"reason"`
	CaptureError      string `json:"capture_error,omitempty"`
	StreamEndReason   string `json:"stream_end_reason,omitempty"`
	StreamErrorCount  int    `json:"stream_error_count,omitempty"`
	Usage             *Usage `json:"usage,omitempty"`
}

type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	Quota            int `json:"quota"`
}

type Event struct {
	SchemaVersion int       `json:"schema_version"`
	Type          string    `json:"type"`
	Seq           int64     `json:"seq"`
	Timestamp     string    `json:"timestamp"`
	Metadata      *Metadata `json:"metadata,omitempty"`
	BodyEncoding  string    `json:"body_encoding,omitempty"`
	BodyRaw       string    `json:"body_raw,omitempty"`
	End           *End      `json:"end,omitempty"`
}

type Recorder struct {
	mu        sync.Mutex
	a         *Archive
	f         *os.File
	path      string
	seq, size int64
	err       string
	usage     *Usage
}

// Begin never trusts a client-provided user ID or filesystem path. Call only after authentication.
func (a *Archive) Begin(meta Metadata, now time.Time) (*Recorder, error) {
	if meta.UserID <= 0 {
		return nil, fmt.Errorf("trace archive requires authenticated user")
	}
	meta.ArchiveID = uuid.NewString()
	session := "unknown"
	if meta.SessionID != "" && len(meta.SessionID) <= 256 && !strings.ContainsAny(meta.SessionID, "\r\n\x00") {
		sum := sha256.Sum256([]byte(meta.SessionID))
		session = hex.EncodeToString(sum[:])
	} else {
		meta.SessionID, meta.SessionSource = "", "unknown"
	}
	dir := filepath.Join(a.cfg.SpoolDir, "user="+strconv.Itoa(meta.UserID), "session="+session, "date="+now.UTC().Format("2006-01-02"))
	if a.bytes.Load() >= a.cfg.MaxSpoolBytes*3/4 {
		return nil, fmt.Errorf("spool limit reached")
	}
	a.dirMu.Lock()
	defer a.dirMu.Unlock()
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, err
	}
	name := filepath.Join(dir, "req_"+meta.ArchiveID+".open")
	f, err := os.OpenFile(name, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		a.pruneParents(dir)
		return nil, err
	}
	r := &Recorder{a: a, f: f, path: name}
	if err := r.write(Event{Type: "request.start", Metadata: &meta}); err != nil {
		_ = f.Close()
		_ = a.remove(name)
		a.pruneParents(dir)
		return nil, err
	}
	a.started.Add(1)
	return r, nil
}

func (r *Recorder) write(e Event) error {
	e.SchemaVersion, e.Seq, e.Timestamp = 1, r.seq, time.Now().UTC().Format(time.RFC3339Nano)
	data, err := common.Marshal(e)
	if err != nil {
		return err
	}
	data = append(data, '\n')
	if e.Type == "request.start" && len(data) > min(64<<10, int(r.a.cfg.MaxRequestBytes)-1024) {
		return fmt.Errorf("archive metadata limit")
	}
	limit := r.a.cfg.MaxSpoolBytes * 3 / 4
	if e.Type == "request.end" {
		limit = r.a.cfg.MaxSpoolBytes
	}
	if !r.a.reserveTo(int64(len(data)), limit) {
		return fmt.Errorf("spool_limit")
	}
	n, err := r.f.Write(data)
	r.a.bytes.Add(int64(n - len(data)))
	r.size += int64(n)
	if err == nil && n != len(data) {
		err = io.ErrShortWrite
	}
	if err == nil {
		r.seq++
	}
	return err
}

func (r *Recorder) Append(kind string, p []byte) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.f == nil || r.err != "" {
		return
	}
	for len(p) > 0 {
		n := min(len(p), chunkSize)
		// Includes conservative event envelope overhead and leaves room for request.end.
		if r.size+int64(base64.StdEncoding.EncodedLen(n))+1024 > r.a.cfg.MaxRequestBytes {
			r.err = "request_limit"
			r.a.failure("capture_truncated", r.err)
			return
		}
		if err := r.write(Event{Type: kind, BodyEncoding: "base64", BodyRaw: base64.StdEncoding.EncodeToString(p[:n])}); err != nil {
			r.err = "local_write_failed"
			r.a.failure("capture_write_failed", err.Error())
			return
		}
		p = p[n:]
	}
}

func (r *Recorder) SetUsage(usage Usage) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.usage = &usage
}

func (r *Recorder) Finish(end End) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.f == nil {
		return
	}
	end.Usage = r.usage
	end.CaptureError = r.err
	end.CaptureComplete = end.CaptureComplete && r.err == ""
	// A failed write can leave a partial JSON line. Repair before adding a terminal event.
	if r.err == "local_write_failed" {
		_ = r.f.Close()
		r.f = nil
		end.Reason = "local_capture_failed"
		if err := r.a.recoverOpen(r.path, &end); err != nil {
			r.a.failure("recovery_failed", err.Error())
		} else {
			r.a.finished.Add(1)
			r.a.wake()
		}
		return
	}
	err := r.write(Event{Type: "request.end", End: &end})
	if err == nil {
		err = r.f.Sync()
	}
	closeErr := r.f.Close()
	r.f = nil
	if err == nil {
		err = closeErr
	}
	if err == nil {
		err = durableRename(r.path, strings.TrimSuffix(r.path, ".open")+".ready")
	}
	if err != nil {
		r.a.failure("capture_finalize_failed", err.Error())
		return
	}
	r.a.finished.Add(1)
	r.a.wake()
}

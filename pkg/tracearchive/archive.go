package tracearchive

import (
	"bufio"
	"compress/gzip"
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
)

type retryState struct {
	attempts int
	after    time.Time
}

type Archive struct {
	cfg                                          Config
	uploader                                     Uploader
	lock                                         *os.File
	cancel                                       context.CancelFunc
	ctx                                          context.Context
	wg                                           sync.WaitGroup
	notify                                       chan struct{}
	jobs                                         chan string
	mu                                           sync.Mutex
	packMu                                       sync.Mutex
	dirMu                                        sync.Mutex
	busy                                         map[string]bool
	retries                                      map[string]retryState
	bytes, started, finished, uploaded, failures atomic.Int64
}

type Stats struct {
	SpoolBytes int64 `json:"spool_bytes"`
	Started    int64 `json:"started"`
	Finished   int64 `json:"finished"`
	Uploaded   int64 `json:"uploaded"`
	Failures   int64 `json:"failures"`
}

func (a *Archive) Stats() Stats {
	return Stats{a.bytes.Load(), a.started.Load(), a.finished.Load(), a.uploaded.Load(), a.failures.Load()}
}

// Open performs recovery before any requests or background workers can access the spool.
func Open(cfg Config, uploader Uploader) (*Archive, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	if uploader == nil {
		return nil, fmt.Errorf("archive uploader is required")
	}
	root, err := filepath.Abs(cfg.SpoolDir)
	if err != nil {
		return nil, err
	}
	cfg.SpoolDir = root
	if err = os.MkdirAll(root, 0700); err != nil {
		return nil, err
	}
	if err = os.Chmod(root, 0700); err != nil {
		return nil, err
	}
	lock, err := acquireLock(filepath.Join(root, ".lock"))
	if err != nil {
		return nil, fmt.Errorf("archive spool lock: %w", err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	a := &Archive{cfg: cfg, uploader: uploader, lock: lock, ctx: ctx, cancel: cancel,
		notify: make(chan struct{}, 1), jobs: make(chan string, cfg.Workers), busy: map[string]bool{}, retries: map[string]retryState{}}
	var openFiles, temps []string
	err = filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.Type()&os.ModeSymlink != 0 {
			return fmt.Errorf("symlinks are not allowed in archive spool")
		}
		if entry.IsDir() {
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		if !info.Mode().IsRegular() {
			return fmt.Errorf("non-regular file in archive spool")
		}
		if entry.Name() == ".lock" {
			return nil
		}
		a.bytes.Add(info.Size())
		if strings.HasSuffix(path, ".open") {
			openFiles = append(openFiles, path)
		}
		if strings.HasSuffix(path, ".gz.tmp") {
			temps = append(temps, path)
		}
		return nil
	})
	if err == nil {
		for _, path := range temps {
			if e := a.remove(path); e != nil {
				err = e
				break
			}
		}
	}
	if err == nil {
		for _, path := range openFiles {
			if e := a.recoverOpen(path, nil); e != nil {
				a.failure("recovery_failed", e.Error())
			}
		}
	}
	if err != nil {
		cancel()
		_ = lock.Close()
		return nil, err
	}
	return a, nil
}

func (a *Archive) Start() {
	a.wg.Add(1 + a.cfg.Workers)
	go func() {
		defer a.wg.Done()
		ticker := time.NewTicker(a.cfg.ScanInterval)
		defer ticker.Stop()
		for {
			a.scan()
			select {
			case <-a.ctx.Done():
				return
			case <-ticker.C:
			case <-a.notify:
			}
		}
	}()
	for i := 0; i < a.cfg.Workers; i++ {
		go func() {
			defer a.wg.Done()
			for {
				select {
				case <-a.ctx.Done():
					return
				case path := <-a.jobs:
					err := a.upload(path)
					stem := archiveStem(path)
					a.mu.Lock()
					delete(a.busy, stem)
					if err == nil {
						delete(a.retries, stem)
					} else {
						r := a.retries[stem]
						r.attempts++
						delay := min(a.cfg.ScanInterval*time.Duration(1<<min(r.attempts-1, 5)), 5*time.Minute)
						r.after = time.Now().Add(delay)
						a.retries[stem] = r
					}
					a.mu.Unlock()
					if err != nil && a.ctx.Err() == nil {
						a.failure("upload_failed", err.Error())
					}
				}
			}
		}()
	}
}

func (a *Archive) Close() {
	a.cancel()
	a.wg.Wait()
	_ = a.lock.Close()
	common.SysLog(fmt.Sprintf("trace_archive stopped stats=%+v", a.Stats()))
}

func (a *Archive) failure(event, detail string) {
	n := a.failures.Add(1)
	// Limit outage log volume; the monotonic count records every failed operation.
	if n <= 10 || n%100 == 0 {
		common.SysError(fmt.Sprintf("trace_archive event=%s failures=%d detail=%s", event, n, detail))
	}
}

func (a *Archive) CaptureSkipped() {
	a.failure("capture_skipped", "unable to create request archive; check spool capacity/permissions")
}

func (a *Archive) reserveTo(n, limit int64) bool {
	for {
		old := a.bytes.Load()
		if n > limit-old {
			return false
		}
		if a.bytes.CompareAndSwap(old, old+n) {
			return true
		}
	}
}

func (a *Archive) remove(path string) error {
	info, err := os.Stat(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	if err = os.Remove(path); err != nil {
		return err
	}
	a.bytes.Add(-info.Size())
	return nil
}

func (a *Archive) wake() {
	select {
	case a.notify <- struct{}{}:
	default:
	}
}

func archiveStem(path string) string {
	return strings.TrimSuffix(strings.TrimSuffix(path, ".ready"), ".jsonl.gz")
}

func (a *Archive) scan() {
	err := filepath.WalkDir(a.cfg.SpoolDir, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			if errors.Is(walkErr, os.ErrNotExist) {
				return nil
			}
			return walkErr
		}
		if a.ctx.Err() != nil {
			return fs.SkipAll
		}
		if entry.IsDir() || !entry.Type().IsRegular() || (!strings.HasSuffix(path, ".ready") && !strings.HasSuffix(path, ".jsonl.gz")) {
			return nil
		}
		stem := archiveStem(path)
		a.mu.Lock()
		defer a.mu.Unlock()
		if a.busy[stem] || time.Now().Before(a.retries[stem].after) {
			return nil
		}
		// WalkDir may still hold an entry that an upload worker has already removed.
		if _, err := os.Stat(path); errors.Is(err, os.ErrNotExist) {
			return nil
		} else if err != nil {
			return err
		}
		select {
		case a.jobs <- path:
			a.busy[stem] = true
		default:
		}
		return nil
	})
	if err != nil {
		a.failure("spool_scan_failed", err.Error())
	}
}

type quotaWriter struct {
	a *Archive
	f *os.File
}

func (w quotaWriter) Write(p []byte) (int, error) {
	if err := w.a.ctx.Err(); err != nil {
		return 0, err
	}
	if !w.a.reserveTo(int64(len(p)), w.a.cfg.MaxSpoolBytes) {
		return 0, fmt.Errorf("compression spool limit")
	}
	n, err := w.f.Write(p)
	w.a.bytes.Add(int64(n - len(p)))
	return n, err
}

func (a *Archive) upload(path string) error {
	stem := archiveStem(path)
	packed := stem + ".jsonl.gz"
	if _, err := os.Stat(packed); errors.Is(err, os.ErrNotExist) {
		if err = a.compress(stem+".ready", packed); err != nil {
			return err
		}
	} else if err != nil {
		return err
	}
	// A crash between the gzip rename and source deletion leaves both files; prefer the durable gzip.
	if err := a.remove(stem + ".ready"); err != nil {
		return err
	}
	key, err := filepath.Rel(a.cfg.SpoolDir, packed)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(a.ctx, a.cfg.UploadTimeout)
	defer cancel()
	if err = a.uploader.Upload(ctx, filepath.ToSlash(key), packed); err != nil {
		return err
	}
	if err = a.remove(packed); err != nil {
		return err
	}
	a.uploaded.Add(1)
	a.dirMu.Lock()
	a.pruneParents(filepath.Dir(packed))
	a.dirMu.Unlock()
	return nil
}

// Call under dirMu so a new request cannot race directory creation with cleanup.
func (a *Archive) pruneParents(dir string) {
	for dir != a.cfg.SpoolDir {
		if err := os.Remove(dir); err != nil {
			return
		}
		dir = filepath.Dir(dir)
	}
}

func (a *Archive) compress(source, target string) (err error) {
	// Reserve headroom for one compression at a time, independently of upload concurrency.
	a.packMu.Lock()
	defer a.packMu.Unlock()
	if err := a.ctx.Err(); err != nil {
		return err
	}
	in, err := os.Open(source)
	if err != nil {
		return err
	}
	defer in.Close()
	temp := target + ".tmp"
	out, err := os.OpenFile(temp, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	defer func() {
		_ = out.Close()
		if err != nil {
			_ = a.remove(temp)
		}
	}()
	z, err := gzip.NewWriterLevel(quotaWriter{a, out}, gzip.BestSpeed)
	if err != nil {
		return err
	}
	if _, err = io.Copy(z, in); err != nil {
		_ = z.Close()
		return err
	}
	if err = z.Close(); err != nil {
		return err
	}
	if err = out.Sync(); err != nil {
		return err
	}
	if err = out.Close(); err != nil {
		return err
	}
	return durableRename(temp, target)
}

func durableRename(source, target string) error {
	if err := os.Rename(source, target); err != nil {
		return err
	}
	dir, err := os.Open(filepath.Dir(target))
	if err != nil {
		return err
	}
	defer dir.Close()
	return dir.Sync()
}

// Only called at startup (with exclusive spool lock), or after closing this request's writer.
func (a *Archive) recoverOpen(path string, terminal *End) error {
	f, err := os.OpenFile(path, os.O_RDWR, 0600)
	if err != nil {
		return err
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		return err
	}
	reader := bufio.NewReaderSize(f, 128<<10)
	var offset, seq int64
	lastType := ""
	for {
		line, readErr := reader.ReadSlice('\n')
		if readErr != nil {
			break
		}
		var event Event
		if common.Unmarshal(line, &event) != nil || event.SchemaVersion != 1 || event.Seq != seq || (seq == 0 && event.Type != "request.start") {
			break
		}
		offset += int64(len(line))
		seq++
		lastType = event.Type
		if lastType == "request.end" {
			break
		}
	}
	if seq == 0 {
		_ = f.Close()
		if info.Size() == 0 {
			return a.remove(path)
		}
		return durableRename(path, strings.TrimSuffix(path, ".open")+".corrupt")
	}
	if err = f.Truncate(offset); err != nil {
		return err
	}
	a.bytes.Add(offset - info.Size())
	if _, err = f.Seek(offset, io.SeekStart); err != nil {
		return err
	}
	r := &Recorder{a: a, f: f, seq: seq, size: offset}
	if lastType != "request.end" {
		if terminal == nil {
			terminal = &End{Reason: "process_interrupted", CaptureComplete: false}
		}
		if err = r.write(Event{Type: "request.end", End: terminal}); err != nil {
			return err
		}
	}
	if err = f.Sync(); err != nil {
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	return durableRename(path, strings.TrimSuffix(path, ".open")+".ready")
}

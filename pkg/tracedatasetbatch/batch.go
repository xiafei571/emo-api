package tracedatasetbatch

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/tracedataset"
	"github.com/google/uuid"
)

type Manifest struct {
	Schema            string              `json:"schema"`
	RunID             string              `json:"run_id"`
	StartedAt         string              `json:"started_at"`
	CompletedAt       string              `json:"completed_at"`
	SourceBucket      string              `json:"source_bucket"`
	SourcePrefix      string              `json:"source_prefix"`
	DestinationBucket string              `json:"destination_bucket"`
	OutputPrefix      string              `json:"output_prefix"`
	SourceObjects     []Object            `json:"source_objects"`
	SourceBytes       int64               `json:"source_bytes"`
	ExchangeObject    string              `json:"exchange_object"`
	SessionObject     string              `json:"session_object"`
	Report            tracedataset.Report `json:"report"`
}

func Run(ctx context.Context, cfg Config, store ObjectStore) (Manifest, error) {
	if err := cfg.Validate(); err != nil {
		return Manifest{}, err
	}
	started := time.Now().UTC()
	runID := started.Format("20060102T150405Z") + "-" + uuid.NewString()
	manifest := Manifest{
		Schema: "emo-trace-dataset-run/1", RunID: runID, StartedAt: started.Format(time.RFC3339Nano),
		SourceBucket: cfg.SourceBucket, SourcePrefix: strings.TrimSuffix(cfg.SourcePrefix, "/"),
		DestinationBucket: cfg.DestinationBucket,
	}
	objects, total, err := listRawObjects(ctx, cfg, store)
	if err != nil {
		return manifest, err
	}
	if len(objects) == 0 {
		return manifest, fmt.Errorf("no raw .jsonl.gz objects under %s", cfg.SourcePrefix)
	}
	manifest.SourceObjects, manifest.SourceBytes = objects, total

	root, err := os.MkdirTemp(cfg.TempDir, "emo-trace-dataset-batch-")
	if err != nil {
		return manifest, err
	}
	defer os.RemoveAll(root)
	inputDir := filepath.Join(root, "raw")
	if err = downloadRawObjects(ctx, cfg, store, objects, inputDir); err != nil {
		return manifest, err
	}
	exchangePath := filepath.Join(root, "exchanges.jsonl.zst")
	sessionPath := filepath.Join(root, "sessions.jsonl.zst")
	manifest.Report, err = tracedataset.Build(tracedataset.BuildOptions{
		InputDir: inputDir, ExchangeOutput: exchangePath, SessionOutput: sessionPath,
		IdentityKey: cfg.IdentityKey, TempDir: root,
	})
	if err != nil {
		return manifest, err
	}

	runPrefix := strings.TrimSuffix(cfg.OutputPrefix, "/") + "/run_date=" + started.Format("2006-01-02") + "/run_id=" + runID
	manifest.OutputPrefix = runPrefix
	manifest.ExchangeObject = runPrefix + "/exchanges.jsonl.zst"
	manifest.SessionObject = runPrefix + "/sessions.jsonl.zst"
	if err = uploadFile(ctx, store, cfg.DestinationBucket, manifest.ExchangeObject, exchangePath, "application/zstd"); err != nil {
		return manifest, err
	}
	if err = uploadFile(ctx, store, cfg.DestinationBucket, manifest.SessionObject, sessionPath, "application/zstd"); err != nil {
		return manifest, err
	}
	manifest.CompletedAt = time.Now().UTC().Format(time.RFC3339Nano)
	manifestPath := filepath.Join(root, "manifest.json")
	data, err := common.Marshal(manifest)
	if err != nil {
		return manifest, err
	}
	data = append(data, '\n')
	if err = os.WriteFile(manifestPath, data, 0600); err != nil {
		return manifest, err
	}
	// Upload the manifest last; its presence is the commit marker for a complete run.
	if err = uploadFile(ctx, store, cfg.DestinationBucket, runPrefix+"/manifest.json", manifestPath, "application/json"); err != nil {
		return manifest, err
	}
	return manifest, nil
}

func listRawObjects(ctx context.Context, cfg Config, store ObjectStore) ([]Object, int64, error) {
	prefix := strings.TrimSuffix(cfg.SourcePrefix, "/") + "/"
	var objects []Object
	var total int64
	for token := ""; ; {
		page, err := store.List(ctx, cfg.SourceBucket, prefix, token)
		if err != nil {
			return nil, total, fmt.Errorf("list raw objects: %w", err)
		}
		for _, object := range page.Objects {
			if !strings.HasSuffix(object.Key, ".jsonl.gz") {
				continue
			}
			objects = append(objects, object)
			total += object.Size
			if len(objects) > cfg.MaxObjects {
				return nil, total, fmt.Errorf("source exceeds object limit %d", cfg.MaxObjects)
			}
			if total > cfg.MaxSourceBytes {
				return nil, total, fmt.Errorf("source exceeds byte limit %d", cfg.MaxSourceBytes)
			}
		}
		if page.NextToken == "" {
			break
		}
		if page.NextToken == token {
			return nil, total, fmt.Errorf("S3 pagination token did not advance")
		}
		token = page.NextToken
	}
	return objects, total, nil
}

func downloadRawObjects(ctx context.Context, cfg Config, store ObjectStore, objects []Object, inputDir string) error {
	prefix := strings.TrimSuffix(cfg.SourcePrefix, "/") + "/"
	for _, object := range objects {
		relative := strings.TrimPrefix(object.Key, prefix)
		if relative == object.Key || relative == "" || strings.Contains(relative, "\\") || filepath.IsAbs(relative) || filepath.Clean(relative) != relative {
			return fmt.Errorf("unsafe source object key %q", object.Key)
		}
		path := filepath.Join(inputDir, filepath.FromSlash(relative))
		if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
			return err
		}
		file, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
		if err != nil {
			return err
		}
		downloadErr := store.Download(ctx, cfg.SourceBucket, object.Key, file)
		closeErr := file.Close()
		if downloadErr != nil {
			return fmt.Errorf("download %s: %w", object.Key, downloadErr)
		}
		if closeErr != nil {
			return closeErr
		}
		info, err := os.Stat(path)
		if err != nil {
			return err
		}
		if info.Size() != object.Size {
			return fmt.Errorf("download %s size mismatch: got %d want %d", object.Key, info.Size(), object.Size)
		}
	}
	return nil
}

func uploadFile(ctx context.Context, store ObjectStore, bucket, key, path, contentType string) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return err
	}
	if err = store.UploadIfAbsent(ctx, bucket, key, file, info.Size(), contentType); err != nil {
		return fmt.Errorf("upload %s: %w", key, err)
	}
	return nil
}

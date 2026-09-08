package tracedataset

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"

	"github.com/QuantumNous/new-api/common"
	"github.com/klauspost/compress/zstd"
)

type datasetWriter struct {
	finalPath string
	tempPath  string
	file      *os.File
	encoder   *zstd.Encoder
	buffer    *bufio.Writer
}

func newDatasetWriter(path string) (*datasetWriter, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return nil, err
	}
	file, err := os.CreateTemp(filepath.Dir(path), "."+filepath.Base(path)+".tmp-")
	if err != nil {
		return nil, err
	}
	if err = file.Chmod(0600); err != nil {
		_ = file.Close()
		_ = os.Remove(file.Name())
		return nil, err
	}
	encoder, err := zstd.NewWriter(file, zstd.WithEncoderLevel(zstd.SpeedBetterCompression))
	if err != nil {
		_ = file.Close()
		_ = os.Remove(file.Name())
		return nil, err
	}
	return &datasetWriter{finalPath: path, tempPath: file.Name(), file: file, encoder: encoder, buffer: bufio.NewWriterSize(encoder, 256<<10)}, nil
}

func (w *datasetWriter) Write(value any) error {
	data, err := common.Marshal(value)
	if err != nil {
		return err
	}
	data = append(data, '\n')
	_, err = w.buffer.Write(data)
	return err
}

func (w *datasetWriter) Commit() error {
	if w.file == nil {
		return fmt.Errorf("dataset writer already closed")
	}
	if err := w.buffer.Flush(); err != nil {
		w.Abort()
		return err
	}
	if err := w.encoder.Close(); err != nil {
		w.Abort()
		return err
	}
	if err := w.file.Sync(); err != nil {
		w.Abort()
		return err
	}
	if err := w.file.Close(); err != nil {
		w.file = nil
		_ = os.Remove(w.tempPath)
		return err
	}
	w.file = nil
	if err := os.Rename(w.tempPath, w.finalPath); err != nil {
		_ = os.Remove(w.tempPath)
		return err
	}
	return nil
}

func (w *datasetWriter) Abort() {
	if w.file != nil {
		_ = w.buffer.Flush()
		w.encoder.Close()
		_ = w.file.Close()
		w.file = nil
	}
	_ = os.Remove(w.tempPath)
}

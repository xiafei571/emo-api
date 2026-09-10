package tracedatasetbatch

import (
	"context"
	"io"
)

type Object struct {
	Key          string `json:"key"`
	ETag         string `json:"etag,omitempty"`
	LastModified string `json:"last_modified,omitempty"`
	Size         int64  `json:"size"`
}

type ObjectPage struct {
	Objects   []Object
	NextToken string
}

type ObjectStore interface {
	List(context.Context, string, string, string) (ObjectPage, error)
	Download(context.Context, string, string, io.Writer) error
	UploadIfAbsent(context.Context, string, string, io.ReadSeeker, int64, string) error
}

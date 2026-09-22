package model

import (
	"context"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/pkg/tracearchive"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTraceArchiveInventoryIsIncrementalAndIdempotent(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&TraceArchiveObject{}))
	require.NoError(t, DB.Exec("DELETE FROM trace_archive_objects").Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Exec("DELETE FROM trace_archive_objects").Error)
	})

	store := TraceArchiveInventoryStore{}
	objects := []tracearchive.ArchivedObject{
		{
			Key:             "raw/v1/user=7/session=unknown/date=2026-09-21/req_a.jsonl.gz",
			CompressedBytes: 100,
			UploadedAt:      time.Date(2026, 9, 21, 1, 0, 0, 0, time.UTC),
		},
		{
			Key:             "raw/v1/user=7/session=session-a/date=2026-09-22/req_b.jsonl.gz",
			CompressedBytes: 250,
			UploadedAt:      time.Date(2026, 9, 22, 2, 0, 0, 0, time.UTC),
		},
		{
			Key:             "raw/v1/user=8/session=session-a/date=2026-09-22/req_c.jsonl.gz",
			CompressedBytes: 300,
			UploadedAt:      time.Date(2026, 9, 22, 3, 0, 0, 0, time.UTC),
		},
	}
	require.NoError(t, store.RecordUploadedObjects(context.Background(), objects))
	require.NoError(t, store.RecordUploadedObjects(context.Background(), objects))

	stats, err := store.Inventory(context.Background())
	require.NoError(t, err)
	assert.Equal(t, int64(3), stats.Objects)
	assert.Equal(t, int64(650), stats.CompressedBytes)
	assert.Equal(t, int64(1), stats.UnknownSessionObjects)
	assert.Equal(t, int64(2), stats.KnownSessionObjects)
	assert.Equal(t, 2, stats.UniqueUsers)
	assert.Equal(t, 1, stats.UniqueKnownSessions)
	assert.Equal(t, objects[0].UploadedAt, stats.FirstUploadedAt)
	assert.Equal(t, objects[2].UploadedAt, stats.LastUploadedAt)
	require.Len(t, stats.Daily, 2)
	assert.Equal(t, "2026-09-22", stats.Daily[0].Date)
	assert.Equal(t, int64(2), stats.Daily[0].Objects)
	assert.Equal(t, int64(550), stats.Daily[0].CompressedBytes)
}

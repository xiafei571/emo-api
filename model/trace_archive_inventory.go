package model

import (
	"context"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/pkg/tracearchive"

	"gorm.io/gorm/clause"
)

const traceArchiveInventoryBatchSize = 100

type TraceArchiveObject struct {
	ObjectKey       string `gorm:"type:varchar(512);primaryKey"`
	CompressedBytes int64  `gorm:"not null"`
	UserID          int    `gorm:"not null;index"`
	SessionID       string `gorm:"type:varchar(64);not null;index"`
	ArchiveDate     string `gorm:"type:varchar(10);not null;index"`
	UploadedAt      int64  `gorm:"not null;index"`
}

type TraceArchiveInventoryStore struct{}

func (TraceArchiveInventoryStore) RecordUploadedObjects(ctx context.Context, objects []tracearchive.ArchivedObject) error {
	rows := make([]TraceArchiveObject, 0, len(objects))
	for _, object := range objects {
		if !strings.HasSuffix(object.Key, ".jsonl.gz") || object.CompressedBytes < 0 {
			continue
		}
		userID, sessionID, archiveDate := traceArchiveObjectComponents(object.Key)
		if userID <= 0 || sessionID == "" || archiveDate == "" {
			continue
		}
		uploadedAt := object.UploadedAt.UTC().Unix()
		if object.UploadedAt.IsZero() {
			uploadedAt = time.Now().UTC().Unix()
		}
		rows = append(rows, TraceArchiveObject{
			ObjectKey: object.Key, CompressedBytes: object.CompressedBytes, UserID: userID,
			SessionID: sessionID, ArchiveDate: archiveDate, UploadedAt: uploadedAt,
		})
	}
	for start := 0; start < len(rows); start += traceArchiveInventoryBatchSize {
		end := min(start+traceArchiveInventoryBatchSize, len(rows))
		if err := DB.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(rows[start:end]).Error; err != nil {
			return err
		}
	}
	return nil
}

func (TraceArchiveInventoryStore) Inventory(ctx context.Context) (tracearchive.InventoryStats, error) {
	var aggregate struct {
		Objects         int64
		CompressedBytes int64
		FirstUploadedAt int64
		LastUploadedAt  int64
	}
	if err := DB.WithContext(ctx).Model(&TraceArchiveObject{}).
		Select("COUNT(*) AS objects, COALESCE(SUM(compressed_bytes), 0) AS compressed_bytes, COALESCE(MIN(uploaded_at), 0) AS first_uploaded_at, COALESCE(MAX(uploaded_at), 0) AS last_uploaded_at").
		Scan(&aggregate).Error; err != nil {
		return tracearchive.InventoryStats{}, err
	}

	var knownSessions, unknownSessions, uniqueUsers, uniqueKnownSessions int64
	if err := DB.WithContext(ctx).Model(&TraceArchiveObject{}).Where("session_id <> ?", "unknown").Count(&knownSessions).Error; err != nil {
		return tracearchive.InventoryStats{}, err
	}
	if err := DB.WithContext(ctx).Model(&TraceArchiveObject{}).Where("session_id = ?", "unknown").Count(&unknownSessions).Error; err != nil {
		return tracearchive.InventoryStats{}, err
	}
	if err := DB.WithContext(ctx).Model(&TraceArchiveObject{}).Distinct("user_id").Count(&uniqueUsers).Error; err != nil {
		return tracearchive.InventoryStats{}, err
	}
	if err := DB.WithContext(ctx).Model(&TraceArchiveObject{}).Where("session_id <> ?", "unknown").Distinct("session_id").Count(&uniqueKnownSessions).Error; err != nil {
		return tracearchive.InventoryStats{}, err
	}

	var daily []tracearchive.DailyInventoryStats
	if err := DB.WithContext(ctx).Model(&TraceArchiveObject{}).
		Select("archive_date AS date, COUNT(*) AS objects, COALESCE(SUM(compressed_bytes), 0) AS compressed_bytes").
		Group("archive_date").Order("archive_date DESC").Scan(&daily).Error; err != nil {
		return tracearchive.InventoryStats{}, err
	}

	stats := tracearchive.InventoryStats{
		Objects: aggregate.Objects, CompressedBytes: aggregate.CompressedBytes,
		KnownSessionObjects: knownSessions, UnknownSessionObjects: unknownSessions,
		UniqueUsers: int(uniqueUsers), UniqueKnownSessions: int(uniqueKnownSessions),
		CalculatedAt: time.Now().UTC(), Daily: daily,
	}
	if aggregate.FirstUploadedAt > 0 {
		stats.FirstUploadedAt = time.Unix(aggregate.FirstUploadedAt, 0).UTC()
	}
	if aggregate.LastUploadedAt > 0 {
		stats.LastUploadedAt = time.Unix(aggregate.LastUploadedAt, 0).UTC()
	}
	return stats, nil
}

func traceArchiveObjectComponents(key string) (int, string, string) {
	var userID int
	var sessionID, archiveDate string
	for _, component := range strings.Split(key, "/") {
		switch {
		case strings.HasPrefix(component, "user="):
			userID, _ = strconv.Atoi(strings.TrimPrefix(component, "user="))
		case strings.HasPrefix(component, "session="):
			sessionID = strings.TrimPrefix(component, "session=")
		case strings.HasPrefix(component, "date="):
			archiveDate = strings.TrimPrefix(component, "date=")
		}
	}
	return userID, sessionID, archiveDate
}

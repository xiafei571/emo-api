package tracearchive

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Enabled                                    bool
	SpoolDir, Bucket, Prefix, Region, Endpoint string
	AccessKey, SecretKey, SessionToken         string
	Workers                                    int
	MaxRequestBytes, MaxSpoolBytes             int64
	ScanInterval, UploadTimeout                time.Duration
}

func ConfigFromEnv() (Config, error) {
	c := Config{SpoolDir: "./data/agent-traces", Prefix: "raw/v1", Region: "us-east-1", Workers: 2,
		MaxRequestBytes: 64 << 20, MaxSpoolBytes: 5120 << 20, ScanInterval: 15 * time.Second, UploadTimeout: 120 * time.Second}
	if v := os.Getenv("TRACE_ARCHIVE_ENABLED"); v != "" {
		var err error
		c.Enabled, err = strconv.ParseBool(v)
		if err != nil {
			return c, fmt.Errorf("TRACE_ARCHIVE_ENABLED must be a boolean")
		}
	}
	if !c.Enabled {
		return c, nil
	}
	for name, target := range map[string]*string{
		"SPOOL_DIR": &c.SpoolDir, "BUCKET": &c.Bucket, "PREFIX": &c.Prefix, "REGION": &c.Region,
		"ENDPOINT": &c.Endpoint, "ACCESS_KEY_ID": &c.AccessKey, "SECRET_ACCESS_KEY": &c.SecretKey, "SESSION_TOKEN": &c.SessionToken,
	} {
		if v := os.Getenv("TRACE_ARCHIVE_" + name); v != "" {
			*target = v
		}
	}
	for _, setting := range []struct {
		name     string
		min, max int64
		apply    func(int64)
	}{
		{"WORKERS", 1, 16, func(n int64) { c.Workers = int(n) }},
		{"MAX_REQUEST_MB", 1, 1024, func(n int64) { c.MaxRequestBytes = n << 20 }},
		{"MAX_SPOOL_MB", 4, 1048576, func(n int64) { c.MaxSpoolBytes = n << 20 }},
		{"SCAN_SECONDS", 1, 3600, func(n int64) { c.ScanInterval = time.Duration(n) * time.Second }},
		{"UPLOAD_TIMEOUT_SECONDS", 1, 3600, func(n int64) { c.UploadTimeout = time.Duration(n) * time.Second }},
	} {
		if v := os.Getenv("TRACE_ARCHIVE_" + setting.name); v != "" {
			n, err := strconv.ParseInt(v, 10, 64)
			if err != nil || n < setting.min || n > setting.max {
				return c, fmt.Errorf("TRACE_ARCHIVE_%s must be between %d and %d", setting.name, setting.min, setting.max)
			}
			setting.apply(n)
		}
	}
	return c, c.Validate()
}

func (c Config) Validate() error {
	if c.Bucket == "" || strings.ContainsAny(c.Bucket, "/\\?#:@ \t\r\n") {
		return fmt.Errorf("TRACE_ARCHIVE_BUCKET is required and must be a bucket name")
	}
	if c.AccessKey == "" || c.SecretKey == "" {
		return fmt.Errorf("TRACE_ARCHIVE_ACCESS_KEY_ID and TRACE_ARCHIVE_SECRET_ACCESS_KEY are required")
	}
	if c.Region == "" || strings.ContainsAny(c.Region, "/\\?#:@ \t\r\n") {
		return fmt.Errorf("invalid TRACE_ARCHIVE_REGION")
	}
	if c.SpoolDir == "" || c.Prefix == "" || strings.HasPrefix(c.Prefix, "/") || strings.Contains(c.Prefix, "\\") {
		return fmt.Errorf("invalid archive spool directory or prefix")
	}
	for _, part := range strings.Split(c.Prefix, "/") {
		if part == "" || part == "." || part == ".." {
			return fmt.Errorf("invalid TRACE_ARCHIVE_PREFIX component")
		}
	}
	if c.Endpoint != "" {
		u, err := url.Parse(c.Endpoint)
		if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || (u.Path != "" && u.Path != "/") {
			return fmt.Errorf("TRACE_ARCHIVE_ENDPOINT must be an HTTPS origin without credentials, path or query")
		}
	}
	if c.Workers < 1 || c.Workers > 16 || c.MaxRequestBytes < 1 || c.MaxSpoolBytes < 8*c.MaxRequestBytes || c.ScanInterval <= 0 || c.UploadTimeout <= 0 {
		return fmt.Errorf("invalid archive limits; spool must be at least eight times the request limit")
	}
	return nil
}

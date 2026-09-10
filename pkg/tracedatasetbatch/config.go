package tracedatasetbatch

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	SourceBucket, SourcePrefix         string
	DestinationBucket, OutputPrefix    string
	Region, Endpoint                   string
	AccessKey, SecretKey, SessionToken string
	IdentityKey                        []byte
	TempDir                            string
	MaxObjects                         int
	MaxSourceBytes                     int64
}

func ConfigFromEnv() (Config, error) {
	c := Config{
		SourcePrefix: "raw/v1", OutputPrefix: "standardized/v1", Region: "us-east-1",
		TempDir: os.TempDir(), MaxObjects: 100000, MaxSourceBytes: 100 << 30,
	}
	for name, target := range map[string]*string{
		"SOURCE_BUCKET": &c.SourceBucket, "SOURCE_PREFIX": &c.SourcePrefix,
		"DESTINATION_BUCKET": &c.DestinationBucket, "OUTPUT_PREFIX": &c.OutputPrefix,
		"REGION": &c.Region, "ENDPOINT": &c.Endpoint, "ACCESS_KEY_ID": &c.AccessKey,
		"SECRET_ACCESS_KEY": &c.SecretKey, "SESSION_TOKEN": &c.SessionToken, "TEMP_DIR": &c.TempDir,
	} {
		if value := os.Getenv("TRACE_DATASET_" + name); value != "" {
			*target = value
		}
	}
	c.IdentityKey = []byte(os.Getenv("TRACE_DATASET_IDENTITY_KEY"))
	if c.DestinationBucket == "" {
		c.DestinationBucket = c.SourceBucket
	}
	if value := os.Getenv("TRACE_DATASET_MAX_OBJECTS"); value != "" {
		n, err := strconv.Atoi(value)
		if err != nil || n < 1 || n > 1000000 {
			return c, fmt.Errorf("TRACE_DATASET_MAX_OBJECTS must be between 1 and 1000000")
		}
		c.MaxObjects = n
	}
	if value := os.Getenv("TRACE_DATASET_MAX_SOURCE_GB"); value != "" {
		n, err := strconv.ParseInt(value, 10, 64)
		if err != nil || n < 1 || n > 10240 {
			return c, fmt.Errorf("TRACE_DATASET_MAX_SOURCE_GB must be between 1 and 10240")
		}
		c.MaxSourceBytes = n << 30
	}
	return c, c.Validate()
}

func (c Config) Validate() error {
	for name, bucket := range map[string]string{"source": c.SourceBucket, "destination": c.DestinationBucket} {
		if bucket == "" || strings.ContainsAny(bucket, "/\\?#:@ \t\r\n") {
			return fmt.Errorf("invalid %s bucket", name)
		}
	}
	for name, prefix := range map[string]string{"source": c.SourcePrefix, "output": c.OutputPrefix} {
		if prefix == "" || strings.HasPrefix(prefix, "/") || strings.Contains(prefix, "\\") {
			return fmt.Errorf("invalid %s prefix", name)
		}
		for _, part := range strings.Split(strings.TrimSuffix(prefix, "/"), "/") {
			if part == "" || part == "." || part == ".." {
				return fmt.Errorf("invalid %s prefix", name)
			}
		}
	}
	sourcePrefix := strings.TrimSuffix(c.SourcePrefix, "/")
	outputPrefix := strings.TrimSuffix(c.OutputPrefix, "/")
	if c.SourceBucket == c.DestinationBucket && (sourcePrefix == outputPrefix || strings.HasPrefix(outputPrefix, sourcePrefix+"/") || strings.HasPrefix(sourcePrefix, outputPrefix+"/")) {
		return fmt.Errorf("source and output prefixes must not overlap in the same bucket")
	}
	if c.Region == "" || c.AccessKey == "" || c.SecretKey == "" {
		return fmt.Errorf("region and S3 credentials are required")
	}
	if len(c.IdentityKey) < 32 {
		return fmt.Errorf("TRACE_DATASET_IDENTITY_KEY must contain at least 32 bytes")
	}
	if c.TempDir == "" || c.MaxObjects < 1 || c.MaxSourceBytes < 1 {
		return fmt.Errorf("invalid batch limits or temporary directory")
	}
	if c.Endpoint != "" {
		u, err := url.Parse(c.Endpoint)
		if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || (u.Path != "" && u.Path != "/") {
			return fmt.Errorf("TRACE_DATASET_ENDPOINT must be an HTTPS origin")
		}
	}
	return nil
}

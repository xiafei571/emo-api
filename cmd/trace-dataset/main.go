package main

import (
	"bytes"
	"flag"
	"fmt"
	"os"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/tracedataset"
)

func main() {
	input := flag.String("input", "", "directory containing EMO raw .jsonl.gz or .ready files")
	exchanges := flag.String("exchanges", "", "output path for emo-llm-exchange JSONL zstd")
	sessions := flag.String("sessions", "", "output path for emo-llm-session JSONL zstd")
	keyFile := flag.String("identity-key-file", "", "file containing at least 32 bytes used for stable HMAC pseudonyms")
	tempDir := flag.String("temp-dir", "", "optional temporary working directory")
	flag.Parse()
	if *keyFile == "" {
		fatal(fmt.Errorf("identity-key-file is required"))
	}
	key, err := os.ReadFile(*keyFile)
	if err != nil {
		fatal(fmt.Errorf("read identity key: %w", err))
	}
	report, err := tracedataset.Build(tracedataset.BuildOptions{
		InputDir: *input, ExchangeOutput: *exchanges, SessionOutput: *sessions,
		IdentityKey: bytes.TrimSpace(key), TempDir: *tempDir,
	})
	if err != nil {
		fatal(err)
	}
	data, err := common.Marshal(report)
	if err != nil {
		fatal(err)
	}
	fmt.Println(string(data))
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, "trace dataset build failed:", err)
	os.Exit(1)
}

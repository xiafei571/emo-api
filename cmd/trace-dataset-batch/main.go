package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/tracedatasetbatch"
)

func main() {
	cfg, err := tracedatasetbatch.ConfigFromEnv()
	if err != nil {
		fatal(err)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	manifest, err := tracedatasetbatch.Run(ctx, cfg, tracedatasetbatch.NewS3Store(cfg))
	if err != nil {
		fatal(err)
	}
	data, err := common.Marshal(manifest)
	if err != nil {
		fatal(err)
	}
	fmt.Println(string(data))
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, "trace dataset batch failed:", err)
	os.Exit(1)
}

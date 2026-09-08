package tracedataset

import (
	"bufio"
	"compress/gzip"
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/tracearchive"
)

type rawExchange struct {
	start    tracearchive.Event
	end      tracearchive.Event
	request  []byte
	response []byte
}

func readRawExchange(path string) (result rawExchange, err error) {
	f, err := os.Open(path)
	if err != nil {
		return result, err
	}
	defer f.Close()
	var reader io.Reader = f
	var gz *gzip.Reader
	if strings.HasSuffix(path, ".gz") {
		gz, err = gzip.NewReader(f)
		if err != nil {
			return result, err
		}
		defer gz.Close()
		reader = gz
	}
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 64<<10), 2<<20)
	var seq int64
	for scanner.Scan() {
		var event tracearchive.Event
		if err = common.Unmarshal(scanner.Bytes(), &event); err != nil {
			return result, fmt.Errorf("decode seq %d: %w", seq, err)
		}
		if event.SchemaVersion != 1 || event.Seq != seq {
			return result, fmt.Errorf("invalid event sequence at %d", seq)
		}
		seq++
		switch event.Type {
		case "request.start":
			if seq != 1 || event.Metadata == nil {
				return result, fmt.Errorf("invalid request.start")
			}
			result.start = event
		case "request.chunk", "response.chunk":
			if event.BodyEncoding != "base64" {
				return result, fmt.Errorf("unsupported body encoding %q", event.BodyEncoding)
			}
			chunk, decodeErr := base64.StdEncoding.DecodeString(event.BodyRaw)
			if decodeErr != nil {
				return result, fmt.Errorf("decode body seq %d: %w", event.Seq, decodeErr)
			}
			if event.Type == "request.chunk" {
				result.request = append(result.request, chunk...)
			} else {
				result.response = append(result.response, chunk...)
			}
		case "request.end":
			if event.End == nil {
				return result, fmt.Errorf("request.end missing end data")
			}
			result.end = event
		default:
			return result, fmt.Errorf("unsupported event type %q", event.Type)
		}
	}
	if err = scanner.Err(); err != nil {
		return result, err
	}
	if result.start.Metadata == nil || result.end.End == nil {
		return result, fmt.Errorf("incomplete raw exchange")
	}
	return result, nil
}

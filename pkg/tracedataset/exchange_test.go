package tracedataset

import (
	"testing"

	"github.com/QuantumNous/new-api/pkg/tracearchive"
	"github.com/stretchr/testify/assert"
)

func TestExchangeRepairsLegacyFalseClientCancellation(t *testing.T) {
	request := []byte(`{"input":"hello"}`)
	response := []byte(`{"output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"hi"}]}]}`)
	raw := rawExchange{
		start: tracearchive.Event{Timestamp: "2026-09-09T00:00:00Z", Metadata: &tracearchive.Metadata{
			ArchiveID: "archive", UserID: 1, Path: "/v1/responses", ContentType: "application/json", ContentLength: int64(len(request)),
		}},
		end: tracearchive.Event{Timestamp: "2026-09-09T00:00:01Z", End: &tracearchive.End{
			Status: 200, ContentType: "application/json", CaptureComplete: false, Reason: "client_cancelled",
			RequestBytes: int64(len(request)), ResponseBytes: int64(len(response)),
		}},
		request: request, response: response,
	}
	exchange := exchangeFromRaw(raw, "raw.jsonl.gz", make([]byte, 32))
	assert.Equal(t, "completed", exchange.Status)
	assert.True(t, exchange.CaptureComplete)
	assert.True(t, exchange.CaptureRecovered)
	assert.Equal(t, "legacy_false_client_cancelled_complete_json", exchange.CaptureRecovery)
	assert.Equal(t, "client_cancelled", exchange.TerminationReason)
}

func TestExchangeDoesNotRepairIncompleteOrStreamingCancellation(t *testing.T) {
	request := []byte(`{"input":"hello"}`)
	response := []byte(`{"output":[]}`)
	for _, contentType := range []string{"application/json", "text/event-stream"} {
		raw := rawExchange{
			start:   tracearchive.Event{Metadata: &tracearchive.Metadata{UserID: 1, Path: "/v1/responses", ContentLength: int64(len(request))}},
			end:     tracearchive.Event{End: &tracearchive.End{Status: 200, ContentType: contentType, Reason: "client_cancelled", RequestBytes: int64(len(request)), ResponseBytes: int64(len(response) + 1)}},
			request: request, response: response,
		}
		exchange := exchangeFromRaw(raw, "raw.jsonl.gz", make([]byte, 32))
		assert.Equal(t, "cancelled", exchange.Status)
		assert.False(t, exchange.CaptureComplete)
		assert.False(t, exchange.CaptureRecovered)
	}
}

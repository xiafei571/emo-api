package tracedataset

import (
	"bufio"
	"compress/gzip"
	"encoding/base64"
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/tracearchive"
	"github.com/klauspost/compress/zstd"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildCreatesOwnExchangeAndSessionSchemas(t *testing.T) {
	root := t.TempDir()
	input := filepath.Join(root, "raw")
	require.NoError(t, os.MkdirAll(input, 0700))
	request := []byte(`{"model":"gpt-test","instructions":"Be concise","input":[{"role":"user","content":[{"type":"input_text","text":"hello"}]}],"api_key":"must-not-survive"}`)
	response := []byte("event: response.completed\ndata: {\"type\":\"response.completed\",\"response\":{\"output\":[{\"type\":\"message\",\"role\":\"assistant\",\"content\":[{\"type\":\"output_text\",\"text\":\"hi\"}]}],\"usage\":{\"input_tokens\":4,\"output_tokens\":2}}}\n\n")
	writeRaw(t, filepath.Join(input, "one.jsonl.gz"), "session-one", request, response)

	exchangePath := filepath.Join(root, "out", "exchanges.jsonl.zst")
	sessionPath := filepath.Join(root, "out", "sessions.jsonl.zst")
	report, err := Build(BuildOptions{
		InputDir: input, ExchangeOutput: exchangePath, SessionOutput: sessionPath,
		IdentityKey: []byte("0123456789abcdef0123456789abcdef"),
	})
	require.NoError(t, err)
	assert.Equal(t, Report{RawFiles: 1, Exchanges: 1, Sessions: 1}, report)

	var exchange Exchange
	readZstdJSONLine(t, exchangePath, &exchange)
	assert.Equal(t, "emo-agent-exchange/1", exchange.Schema)
	assert.NotEqual(t, "7", exchange.UserID)
	assert.NotEqual(t, "session-one", exchange.SessionID)
	assert.Equal(t, 4, exchange.Usage.InputTokens)
	requestObject, ok := exchange.ClientRequest.Data.(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "[REDACTED]", requestObject["api_key"])

	var session Session
	readZstdJSONLine(t, sessionPath, &session)
	assert.Equal(t, "emo-agent-session/1", session.Schema)
	assert.Equal(t, 1, session.Metadata.IncludedRequests)
	require.Len(t, session.Messages, 3)
	assert.Equal(t, "system", session.Messages[0].Role)
	assert.Equal(t, "user", session.Messages[1].Role)
	assert.Equal(t, "assistant", session.Messages[2].Role)
}

func TestBuildKeepsUnknownSessionOnlyInExchangeDataset(t *testing.T) {
	root := t.TempDir()
	input := filepath.Join(root, "raw")
	require.NoError(t, os.MkdirAll(input, 0700))
	writeRaw(t, filepath.Join(input, "unknown.jsonl.gz"), "", []byte(`{"input":"hello"}`), []byte(`{"output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"hi"}]}]}`))
	report, err := Build(BuildOptions{
		InputDir: input, ExchangeOutput: filepath.Join(root, "exchanges.jsonl.zst"),
		SessionOutput: filepath.Join(root, "sessions.jsonl.zst"), IdentityKey: make([]byte, 32),
	})
	require.NoError(t, err)
	assert.Equal(t, 1, report.Exchanges)
	assert.Equal(t, 1, report.UnknownSessions)
	assert.Zero(t, report.Sessions)
}

func TestBuildRejectsIncompleteRawWithoutPublishingOutputs(t *testing.T) {
	root := t.TempDir()
	input := filepath.Join(root, "raw")
	require.NoError(t, os.MkdirAll(input, 0700))
	require.NoError(t, os.WriteFile(filepath.Join(input, "broken.ready"), []byte("not-json\n"), 0600))
	exchangePath := filepath.Join(root, "exchanges.jsonl.zst")
	sessionPath := filepath.Join(root, "sessions.jsonl.zst")
	report, err := Build(BuildOptions{InputDir: input, ExchangeOutput: exchangePath, SessionOutput: sessionPath, IdentityKey: make([]byte, 32)})
	require.Error(t, err)
	assert.Equal(t, 1, report.RejectedRawFiles)
	_, exchangeErr := os.Stat(exchangePath)
	_, sessionErr := os.Stat(sessionPath)
	assert.ErrorIs(t, exchangeErr, os.ErrNotExist)
	assert.ErrorIs(t, sessionErr, os.ErrNotExist)
}

func TestAssembleSessionReusesFullRequestHistoryWithoutDuplicates(t *testing.T) {
	firstRequest := Payload{Encoding: "json", Data: map[string]any{
		"input": []any{map[string]any{"role": "user", "content": "first"}},
	}}
	secondRequest := Payload{Encoding: "json", Data: map[string]any{
		"input": []any{
			map[string]any{"role": "user", "content": "first"},
			map[string]any{"role": "assistant", "content": "answer one"},
			map[string]any{"role": "user", "content": "second"},
		},
	}}
	firstResponse := Payload{Encoding: "json", Data: map[string]any{
		"output": []any{map[string]any{"type": "message", "role": "assistant", "content": []any{map[string]any{"type": "output_text", "text": "answer one"}}}},
	}}
	secondResponse := Payload{Encoding: "json", Data: map[string]any{
		"output": []any{map[string]any{"type": "message", "role": "assistant", "content": []any{map[string]any{"type": "output_text", "text": "answer two"}}}},
	}}
	base := Exchange{
		Schema: "emo-agent-exchange/1", UserID: "user", SessionID: "session", SessionKnown: true,
		Protocol: "openai_responses", Status: "completed", StatusCode: 200, MeaningfulOutput: true,
		CaptureComplete: true, TerminationReason: "completed", NormalizationStatus: "normalized",
	}
	first := base
	first.StartedAt, first.CompletedAt, first.ClientRequest, first.ClientResponse = "2026-09-08T01:00:00Z", "2026-09-08T01:00:01Z", firstRequest, firstResponse
	second := base
	second.StartedAt, second.CompletedAt, second.ClientRequest, second.ClientResponse = "2026-09-08T01:01:00Z", "2026-09-08T01:01:01Z", secondRequest, secondResponse

	session, ok, err := assembleSession([]Exchange{first, second})
	require.NoError(t, err)
	require.True(t, ok)
	require.Len(t, session.Messages, 4)
	assert.Equal(t, []string{"user", "assistant", "user", "assistant"}, []string{
		session.Messages[0].Role, session.Messages[1].Role, session.Messages[2].Role, session.Messages[3].Role,
	})
	assert.Equal(t, 2, session.Metadata.IncludedRequests)
	assert.Empty(t, session.Metadata.NormalizationNotes)
}

func writeRaw(t *testing.T, path, sessionID string, request, response []byte) {
	t.Helper()
	file, err := os.Create(path)
	require.NoError(t, err)
	zip := gzip.NewWriter(file)
	events := []tracearchive.Event{
		{SchemaVersion: 1, Type: "request.start", Seq: 0, Timestamp: "2026-09-08T01:00:00Z", Metadata: &tracearchive.Metadata{ArchiveID: "archive-one", RequestID: "request-one", UserID: 7, SessionID: sessionID, Path: "/v1/responses", ContentType: "application/json"}},
		{SchemaVersion: 1, Type: "request.chunk", Seq: 1, Timestamp: "2026-09-08T01:00:00Z", BodyEncoding: "base64", BodyRaw: base64.StdEncoding.EncodeToString(request)},
		{SchemaVersion: 1, Type: "response.chunk", Seq: 2, Timestamp: "2026-09-08T01:00:01Z", BodyEncoding: "base64", BodyRaw: base64.StdEncoding.EncodeToString(response)},
		{SchemaVersion: 1, Type: "request.end", Seq: 3, Timestamp: "2026-09-08T01:00:01Z", End: &tracearchive.End{Status: 200, Model: "gpt-test", CaptureComplete: true, Reason: "completed", ContentType: "text/event-stream"}},
	}
	for _, event := range events {
		data, marshalErr := common.Marshal(event)
		require.NoError(t, marshalErr)
		_, err = zip.Write(append(data, '\n'))
		require.NoError(t, err)
	}
	require.NoError(t, zip.Close())
	require.NoError(t, file.Close())
}

func readZstdJSONLine(t *testing.T, path string, target any) {
	t.Helper()
	file, err := os.Open(path)
	require.NoError(t, err)
	defer file.Close()
	decoder, err := zstd.NewReader(file)
	require.NoError(t, err)
	defer decoder.Close()
	reader := bufio.NewReader(decoder)
	line, err := reader.ReadBytes('\n')
	require.NoError(t, err)
	require.NoError(t, common.Unmarshal(line, target))
	remaining, err := io.ReadAll(reader)
	require.NoError(t, err)
	assert.Empty(t, remaining)
}

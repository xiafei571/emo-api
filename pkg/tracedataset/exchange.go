package tracedataset

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"path/filepath"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/tracearchive"
	"github.com/tidwall/gjson"
)

func exchangeFromRaw(raw rawExchange, sourcePath string, identityKey []byte) Exchange {
	meta, end := raw.start.Metadata, raw.end.End
	request := payloadFromBytes(raw.request)
	response := payloadFromBytes(raw.response)
	usage := Usage{}
	if end.Usage != nil {
		usage.InputTokens = end.Usage.PromptTokens
		usage.OutputTokens = end.Usage.CompletionTokens
		usage.Quota = end.Usage.Quota
	}
	augmentUsage(&usage, raw.response)
	usage.TotalTokens = usage.InputTokens + usage.OutputTokens
	captureComplete, captureRecovery := effectiveCapture(raw)
	status := "failed"
	if end.Reason == "client_cancelled" && !captureComplete {
		status = "cancelled"
	} else if end.Status >= 200 && end.Status < 400 && captureComplete {
		status = "completed"
	}
	protocol := protocolForPath(meta.Path)
	rawSessionID, sessionSource := datasetSessionIdentity(meta, protocol, request)
	sessionID := ""
	if rawSessionID != "" {
		sessionID = pseudonym(identityKey, "session:"+rawSessionID)
	}
	responseMessages := normalizeResponse(protocol, response)
	return Exchange{
		Schema: "emo-llm-exchange/1", UserID: pseudonym(identityKey, fmt.Sprintf("user:%d", meta.UserID)),
		SessionID: sessionID, SessionKnown: sessionID != "", ArchiveID: meta.ArchiveID, RequestID: meta.RequestID,
		Model: end.Model, Protocol: protocol, Status: status, StatusCode: end.Status,
		StartedAt: raw.start.Timestamp, CompletedAt: raw.end.Timestamp,
		MeaningfulOutput: status == "completed" && messagesMeaningful(responseMessages),
		CaptureComplete:  captureComplete, CaptureRecovered: captureRecovery != "", CaptureRecovery: captureRecovery,
		TerminationReason: end.Reason, StreamEndReason: end.StreamEndReason,
		Usage: usage, ClientRequest: request, ClientResponse: response,
		Source: ExchangeSource{Path: filepath.ToSlash(sourcePath), ContentType: meta.ContentType,
			ResponseContentType: end.ContentType, SessionSource: sessionSource},
		NormalizationStatus: normalizationStatus(protocol, request, responseMessages),
	}
}

// Older middleware versions marked a request client_cancelled whenever the Go
// request context was cancelled during normal cleanup. A complete, valid,
// non-streaming JSON response can be repaired without guessing at missing bytes.
func effectiveCapture(raw rawExchange) (bool, string) {
	meta, end := raw.start.Metadata, raw.end.End
	if end.CaptureComplete {
		return true, ""
	}
	if end.Reason != "client_cancelled" || end.CaptureError != "" || end.Status < 200 || end.Status >= 400 ||
		strings.HasPrefix(strings.ToLower(end.ContentType), "text/event-stream") || !gjson.ValidBytes(raw.response) ||
		int64(len(raw.request)) != end.RequestBytes || int64(len(raw.response)) != end.ResponseBytes {
		return false, ""
	}
	if meta.ContentLength >= 0 && meta.ContentLength != int64(len(raw.request)) {
		return false, ""
	}
	return true, "legacy_false_client_cancelled_complete_json"
}

func datasetSessionIdentity(meta *tracearchive.Metadata, protocol string, request Payload) (string, string) {
	if meta.SessionID != "" {
		return meta.SessionID, meta.SessionSource
	}
	if protocol != "openai_responses" || request.Encoding != "json" {
		return "", "unknown"
	}
	root, ok := request.Data.(map[string]any)
	if !ok {
		return "", "unknown"
	}
	clientMetadata, _ := root["client_metadata"].(map[string]any)
	for _, candidate := range []struct {
		value  any
		source string
	}{
		{clientMetadata["session_id"], "body:client_metadata.session_id"},
		{clientMetadata["thread_id"], "body:client_metadata.thread_id"},
		{root["prompt_cache_key"], "body:prompt_cache_key"},
	} {
		if value, ok := candidate.value.(string); ok && value != "" && len(value) <= 256 && !strings.ContainsAny(value, "\r\n\x00") {
			return value, candidate.source
		}
	}
	return "", "unknown"
}

func pseudonym(key []byte, value string) string {
	h := hmac.New(sha256.New, key)
	_, _ = h.Write([]byte(value))
	return hex.EncodeToString(h.Sum(nil))
}

func payloadFromBytes(data []byte) Payload {
	var value any
	if len(data) > 0 && common.Unmarshal(data, &value) == nil {
		return Payload{Encoding: "json", Data: redactValue(value)}
	}
	if utf8.Valid(data) {
		return Payload{Encoding: "utf-8", Data: string(data)}
	}
	return Payload{Encoding: "base64", Data: base64.StdEncoding.EncodeToString(data)}
}

func redactValue(value any) any {
	switch typed := value.(type) {
	case map[string]any:
		out := make(map[string]any, len(typed))
		for key, child := range typed {
			lower := strings.ToLower(strings.ReplaceAll(key, "-", "_"))
			if lower == "authorization" || lower == "cookie" || lower == "api_key" || lower == "apikey" || lower == "access_token" || lower == "refresh_token" || lower == "password" || lower == "secret" || lower == "secret_key" {
				out[key] = "[REDACTED]"
			} else {
				out[key] = redactValue(child)
			}
		}
		return out
	case []any:
		out := make([]any, len(typed))
		for i, child := range typed {
			out[i] = redactValue(child)
		}
		return out
	default:
		return value
	}
}

func protocolForPath(path string) string {
	switch {
	case strings.Contains(path, "/responses"):
		return "openai_responses"
	case strings.Contains(path, "/chat/completions"):
		return "openai_chat"
	case strings.Contains(path, "/messages"):
		return "anthropic_messages"
	case strings.HasPrefix(path, "/v1beta/models/"):
		return "gemini_generate_content"
	default:
		return "http_raw"
	}
}

func normalizationStatus(protocol string, request Payload, response []Message) string {
	if protocol == "http_raw" || request.Encoding != "json" {
		return "raw_only"
	}
	if len(response) == 0 {
		return "request_only"
	}
	return "normalized"
}

func augmentUsage(usage *Usage, body []byte) {
	visit := func(data []byte) {
		for _, path := range []struct {
			path   string
			target *int
		}{
			{"usage.input_tokens", &usage.InputTokens}, {"usage.prompt_tokens", &usage.InputTokens},
			{"usage.output_tokens", &usage.OutputTokens}, {"usage.completion_tokens", &usage.OutputTokens},
			{"usage.input_tokens_details.cached_tokens", &usage.CacheReadTokens}, {"usage.prompt_tokens_details.cached_tokens", &usage.CacheReadTokens},
			{"usage.cache_read_input_tokens", &usage.CacheReadTokens}, {"usage.cache_creation_input_tokens", &usage.CacheCreationTokens},
			{"response.usage.input_tokens", &usage.InputTokens}, {"response.usage.output_tokens", &usage.OutputTokens},
			{"response.usage.input_tokens_details.cached_tokens", &usage.CacheReadTokens},
		} {
			result := gjson.GetBytes(data, path.path)
			if result.Exists() && int(result.Int()) > *path.target {
				*path.target = int(result.Int())
			}
		}
	}
	visit(body)
	for _, line := range strings.Split(string(body), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "data:") {
			data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
			if data != "" && data != "[DONE]" {
				visit([]byte(data))
			}
		}
	}
}

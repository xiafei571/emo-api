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
	status := "failed"
	if end.Reason == "client_cancelled" {
		status = "cancelled"
	} else if end.Status >= 200 && end.Status < 400 && end.CaptureComplete {
		status = "completed"
	}
	sessionID := ""
	if meta.SessionID != "" {
		sessionID = pseudonym(identityKey, "session:"+meta.SessionID)
	}
	protocol := protocolForPath(meta.Path)
	responseMessages := normalizeResponse(protocol, response)
	return Exchange{
		Schema: "emo-agent-exchange/1", UserID: pseudonym(identityKey, fmt.Sprintf("user:%d", meta.UserID)),
		SessionID: sessionID, SessionKnown: sessionID != "", ArchiveID: meta.ArchiveID, RequestID: meta.RequestID,
		Model: end.Model, Protocol: protocol, Status: status, StatusCode: end.Status,
		StartedAt: raw.start.Timestamp, CompletedAt: raw.end.Timestamp,
		MeaningfulOutput: status == "completed" && messagesMeaningful(responseMessages),
		CaptureComplete:  end.CaptureComplete, TerminationReason: end.Reason, StreamEndReason: end.StreamEndReason,
		Usage: usage, ClientRequest: request, ClientResponse: response,
		Source:              ExchangeSource{Path: filepath.ToSlash(sourcePath), ContentType: meta.ContentType, ResponseContentType: end.ContentType},
		NormalizationStatus: normalizationStatus(protocol, request, responseMessages),
	}
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

package tracedataset

import (
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

func normalizeRequest(_ string, payload Payload) ([]Message, []Tool) {
	root, ok := payload.Data.(map[string]any)
	if payload.Encoding != "json" || !ok {
		return nil, nil
	}
	tools := normalizeTools(root["tools"])
	var messages []Message
	if system := root["system"]; system != nil {
		messages = append(messages, Message{Role: "system", Content: normalizeContent(system)})
	}
	if instructions := stringValue(root["instructions"]); instructions != "" {
		messages = append(messages, Message{Role: "system", Content: instructions})
	}
	if raw, ok := root["messages"].([]any); ok {
		for _, item := range raw {
			messages = append(messages, normalizeMessage(item)...)
		}
		return messages, tools
	}
	if input, exists := root["input"]; exists {
		if text, ok := input.(string); ok {
			messages = append(messages, Message{Role: "user", Content: text})
		} else if items, ok := input.([]any); ok {
			for _, item := range items {
				messages = append(messages, normalizeMessage(item)...)
			}
		}
		return messages, tools
	}
	if contents, ok := root["contents"].([]any); ok {
		for _, item := range contents {
			messages = append(messages, normalizeGeminiMessage(item)...)
		}
	}
	return messages, tools
}

func normalizeResponse(protocol string, payload Payload) []Message {
	if payload.Encoding == "json" {
		if root, ok := payload.Data.(map[string]any); ok {
			return normalizeResponseObject(protocol, root)
		}
		if array, ok := payload.Data.([]any); ok {
			var messages []Message
			for _, item := range array {
				if root, ok := item.(map[string]any); ok {
					messages = append(messages, normalizeResponseObject(protocol, root)...)
				}
			}
			return messages
		}
	}
	if payload.Encoding != "utf-8" {
		return nil
	}
	text, _ := payload.Data.(string)
	var final []Message
	var deltas strings.Builder
	toolDeltas := map[int]*ToolCall{}
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "" || data == "[DONE]" {
			continue
		}
		var root map[string]any
		if common.Unmarshal([]byte(data), &root) != nil {
			continue
		}
		if response, ok := root["response"].(map[string]any); ok {
			if candidate := normalizeResponseObject(protocol, response); len(candidate) > 0 {
				final = candidate
			}
		}
		if candidate := normalizeResponseObject(protocol, root); len(candidate) > 0 {
			final = candidate
		}
		appendSSEDelta(root, &deltas, toolDeltas)
	}
	if len(final) > 0 {
		return final
	}
	message := Message{Role: "assistant", Content: deltas.String()}
	indexes := make([]int, 0, len(toolDeltas))
	for index := range toolDeltas {
		indexes = append(indexes, index)
	}
	sort.Ints(indexes)
	for _, index := range indexes {
		message.ToolCalls = append(message.ToolCalls, *toolDeltas[index])
	}
	if messagesMeaningful([]Message{message}) {
		return []Message{message}
	}
	return nil
}

func normalizeResponseObject(protocol string, root map[string]any) []Message {
	if response, ok := root["response"].(map[string]any); ok {
		return normalizeResponseObject(protocol, response)
	}
	if choices, ok := root["choices"].([]any); ok && len(choices) > 0 {
		if choice, ok := choices[0].(map[string]any); ok {
			if message := choice["message"]; message != nil {
				return normalizeMessage(message)
			}
			if delta := choice["delta"]; delta != nil {
				return normalizeMessage(map[string]any{
					"role": "assistant", "content": mapValue(delta, "content"), "tool_calls": mapValue(delta, "tool_calls"),
				})
			}
		}
	}
	if output, ok := root["output"].([]any); ok {
		var result []Message
		for _, item := range output {
			result = append(result, normalizeMessage(item)...)
		}
		return result
	}
	if content, ok := root["content"].([]any); ok {
		return normalizeMessage(map[string]any{"role": "assistant", "content": content})
	}
	if candidates, ok := root["candidates"].([]any); ok && len(candidates) > 0 {
		if candidate, ok := candidates[0].(map[string]any); ok {
			return normalizeGeminiMessage(candidate["content"])
		}
	}
	return nil
}

func normalizeMessage(value any) []Message {
	item, ok := value.(map[string]any)
	if !ok {
		return nil
	}
	typeName := stringValue(item["type"])
	switch typeName {
	case "function_call", "custom_tool_call":
		id := stringValue(item["call_id"])
		if id == "" {
			id = stringValue(item["id"])
		}
		return []Message{{
			Role: "assistant", Content: "",
			ToolCalls: []ToolCall{{ID: id, Type: "function", Function: ToolFunction{
				Name: stringValue(item["name"]), Arguments: jsonString(item["arguments"]),
			}}},
		}}
	case "function_call_output", "custom_tool_call_output":
		return []Message{{Role: "tool", ToolCallID: stringValue(item["call_id"]), Content: normalizeContent(item["output"])}}
	}
	role := stringValue(item["role"])
	if role == "model" {
		role = "assistant"
	}
	if role == "" && typeName == "message" {
		role = "assistant"
	}
	if role == "" {
		return nil
	}
	message := Message{Role: role, Content: normalizeContent(item["content"]), ToolCallID: stringValue(item["tool_call_id"])}
	if calls, ok := item["tool_calls"].([]any); ok {
		for _, call := range calls {
			if normalized, ok := normalizeToolCall(call); ok {
				message.ToolCalls = append(message.ToolCalls, normalized)
			}
		}
	}
	if parts, ok := item["content"].([]any); ok {
		for _, part := range parts {
			block, _ := part.(map[string]any)
			switch stringValue(block["type"]) {
			case "tool_use":
				message.ToolCalls = append(message.ToolCalls, ToolCall{
					ID: stringValue(block["id"]), Type: "function",
					Function: ToolFunction{Name: stringValue(block["name"]), Arguments: jsonString(block["input"])},
				})
			case "tool_result":
				return []Message{{Role: "tool", ToolCallID: stringValue(block["tool_use_id"]), Content: normalizeContent(block["content"])}}
			}
		}
	}
	return []Message{message}
}

func normalizeGeminiMessage(value any) []Message {
	item, ok := value.(map[string]any)
	if !ok {
		return nil
	}
	role := stringValue(item["role"])
	if role == "model" || role == "" {
		role = "assistant"
	}
	message := Message{Role: role, Content: ""}
	var text strings.Builder
	if parts, ok := item["parts"].([]any); ok {
		for _, raw := range parts {
			part, _ := raw.(map[string]any)
			text.WriteString(stringValue(part["text"]))
			if call, ok := part["functionCall"].(map[string]any); ok {
				message.ToolCalls = append(message.ToolCalls, ToolCall{
					ID: stringValue(call["id"]), Type: "function",
					Function: ToolFunction{Name: stringValue(call["name"]), Arguments: jsonString(call["args"])},
				})
			}
			if response, ok := part["functionResponse"].(map[string]any); ok {
				return []Message{{Role: "tool", ToolCallID: stringValue(response["id"]), Content: normalizeContent(response["response"])}}
			}
		}
	}
	message.Content = text.String()
	return []Message{message}
}

func normalizeToolCall(value any) (ToolCall, bool) {
	item, ok := value.(map[string]any)
	if !ok {
		return ToolCall{}, false
	}
	fn, _ := item["function"].(map[string]any)
	if fn == nil {
		fn = item
	}
	name := stringValue(fn["name"])
	if name == "" {
		return ToolCall{}, false
	}
	return ToolCall{ID: stringValue(item["id"]), Type: "function", Function: ToolFunction{Name: name, Arguments: jsonString(fn["arguments"])}}, true
}

func normalizeTools(value any) []Tool {
	var result []Tool
	items, _ := value.([]any)
	for _, raw := range items {
		item, _ := raw.(map[string]any)
		if declarations, ok := item["functionDeclarations"].([]any); ok {
			for _, declaration := range declarations {
				if tool := normalizeTool(declaration); tool.Name != "" {
					result = append(result, tool)
				}
			}
			continue
		}
		if fn, ok := item["function"].(map[string]any); ok {
			item = fn
		}
		if tool := normalizeTool(item); tool.Name != "" {
			result = append(result, tool)
		}
	}
	return result
}

func normalizeTool(value any) Tool {
	item, _ := value.(map[string]any)
	parameters := item["parameters"]
	if parameters == nil {
		parameters = item["input_schema"]
	}
	return Tool{Name: stringValue(item["name"]), Description: stringValue(item["description"]), Parameters: parameters}
}

func normalizeContent(value any) any {
	if value == nil {
		return ""
	}
	if text, ok := value.(string); ok {
		return text
	}
	if parts, ok := value.([]any); ok {
		var normalized []any
		var text strings.Builder
		textOnly := true
		for _, raw := range parts {
			part, ok := raw.(map[string]any)
			if !ok {
				textOnly = false
				normalized = append(normalized, raw)
				continue
			}
			kind := stringValue(part["type"])
			if kind == "text" || kind == "input_text" || kind == "output_text" {
				value := stringValue(part["text"])
				text.WriteString(value)
				normalized = append(normalized, map[string]any{"type": "text", "text": value})
			} else {
				textOnly = false
				normalized = append(normalized, part)
			}
		}
		if textOnly {
			return text.String()
		}
		if len(normalized) > 0 {
			return normalized
		}
	}
	return value
}

func appendSSEDelta(root map[string]any, text *strings.Builder, calls map[int]*ToolCall) {
	if delta, ok := root["delta"].(string); ok && strings.Contains(stringValue(root["type"]), "text.delta") {
		text.WriteString(delta)
	}
	if delta, ok := root["delta"].(map[string]any); ok {
		text.WriteString(stringValue(delta["text"]))
		if partial := stringValue(delta["partial_json"]); partial != "" {
			call := calls[0]
			if call == nil {
				call = &ToolCall{Type: "function"}
				calls[0] = call
			}
			call.Function.Arguments += partial
		}
	}
	choices, _ := root["choices"].([]any)
	if len(choices) == 0 {
		return
	}
	choice, _ := choices[0].(map[string]any)
	delta, _ := choice["delta"].(map[string]any)
	text.WriteString(stringValue(delta["content"]))
	rawCalls, _ := delta["tool_calls"].([]any)
	for _, raw := range rawCalls {
		item, _ := raw.(map[string]any)
		index, _ := strconv.Atoi(stringValue(item["index"]))
		call := calls[index]
		if call == nil {
			call = &ToolCall{Type: "function"}
			calls[index] = call
		}
		if id := stringValue(item["id"]); id != "" {
			call.ID = id
		}
		fn, _ := item["function"].(map[string]any)
		if name := stringValue(fn["name"]); name != "" {
			call.Function.Name = name
		}
		call.Function.Arguments += stringValue(fn["arguments"])
	}
}

func messagesMeaningful(messages []Message) bool {
	for _, message := range messages {
		if strings.TrimSpace(stringValue(message.Content)) != "" || len(message.ToolCalls) > 0 {
			return true
		}
	}
	return false
}

func stringValue(value any) string {
	if value == nil {
		return ""
	}
	if text, ok := value.(string); ok {
		return text
	}
	return fmt.Sprint(value)
}

func jsonString(value any) string {
	if text, ok := value.(string); ok {
		return text
	}
	data, err := common.Marshal(value)
	if err != nil {
		return ""
	}
	return string(data)
}

func mapValue(value any, key string) any {
	if item, ok := value.(map[string]any); ok {
		return item[key]
	}
	return nil
}

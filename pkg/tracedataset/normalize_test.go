package tracedataset

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeResponsesPreservesToolCallsAndOutputs(t *testing.T) {
	payload := Payload{Encoding: "json", Data: map[string]any{
		"input": []any{
			map[string]any{"role": "user", "content": "inspect the repository"},
			map[string]any{"type": "function_call", "call_id": "call-1", "name": "shell", "arguments": `{"cmd":"git status"}`},
			map[string]any{"type": "function_call_output", "call_id": "call-1", "output": "working tree clean"},
		},
	}}
	messages, _ := normalizeRequest("openai_responses", payload)
	require.Len(t, messages, 3)
	require.Len(t, messages[1].ToolCalls, 1)
	assert.Equal(t, "shell", messages[1].ToolCalls[0].Function.Name)
	assert.Equal(t, `{"cmd":"git status"}`, messages[1].ToolCalls[0].Function.Arguments)
	assert.Equal(t, "tool", messages[2].Role)
	assert.Equal(t, "call-1", messages[2].ToolCallID)
	assert.Equal(t, "working tree clean", messages[2].Content)
}

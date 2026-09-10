package tracedataset

type Payload struct {
	Encoding string `json:"encoding"`
	Data     any    `json:"data"`
}

type Usage struct {
	InputTokens         int `json:"input_tokens"`
	OutputTokens        int `json:"output_tokens"`
	CacheReadTokens     int `json:"cache_read_tokens"`
	CacheCreationTokens int `json:"cache_creation_tokens"`
	TotalTokens         int `json:"total_tokens"`
	Quota               int `json:"quota,omitempty"`
}

type Exchange struct {
	Schema              string         `json:"schema"`
	UserID              string         `json:"user_id"`
	SessionID           string         `json:"session_id,omitempty"`
	SessionKnown        bool           `json:"session_known"`
	ArchiveID           string         `json:"archive_id"`
	RequestID           string         `json:"request_id"`
	Model               string         `json:"model,omitempty"`
	Protocol            string         `json:"protocol"`
	Status              string         `json:"status"`
	StatusCode          int            `json:"status_code"`
	StartedAt           string         `json:"started_at"`
	CompletedAt         string         `json:"completed_at"`
	MeaningfulOutput    bool           `json:"meaningful_output"`
	CaptureComplete     bool           `json:"capture_complete"`
	CaptureRecovered    bool           `json:"capture_recovered,omitempty"`
	CaptureRecovery     string         `json:"capture_recovery,omitempty"`
	TerminationReason   string         `json:"termination_reason"`
	StreamEndReason     string         `json:"stream_end_reason,omitempty"`
	Usage               Usage          `json:"usage"`
	ClientRequest       Payload        `json:"client_request"`
	ClientResponse      Payload        `json:"client_response"`
	Source              ExchangeSource `json:"source"`
	NormalizationStatus string         `json:"normalization_status"`
}

type ExchangeSource struct {
	Path                string `json:"path"`
	ContentType         string `json:"content_type,omitempty"`
	ResponseContentType string `json:"response_content_type,omitempty"`
	SessionSource       string `json:"session_source"`
}

type Message struct {
	Role       string     `json:"role"`
	Content    any        `json:"content"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
	ItemID     string     `json:"item_id,omitempty"`
	Origin     string     `json:"origin,omitempty"`
}

type ToolCall struct {
	ID       string       `json:"id"`
	Type     string       `json:"type,omitempty"`
	Function ToolFunction `json:"function"`
}

type ToolFunction struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type Tool struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Parameters  any    `json:"parameters,omitempty"`
}

type Session struct {
	Schema    string          `json:"schema"`
	UserID    string          `json:"user_id"`
	SessionID string          `json:"session_id"`
	Model     string          `json:"model,omitempty"`
	Tools     []Tool          `json:"tools"`
	Messages  []Message       `json:"messages"`
	Metadata  SessionMetadata `json:"metadata"`
}

type SessionMetadata struct {
	SourceFormat       string   `json:"source_format"`
	StartedAt          string   `json:"started_at"`
	EndedAt            string   `json:"ended_at"`
	Status             string   `json:"status"`
	TerminationReason  string   `json:"termination_reason"`
	RequestCount       int      `json:"request_count"`
	IncludedRequests   int      `json:"included_requests"`
	Protocols          []string `json:"protocols"`
	NormalizationNotes []string `json:"normalization_notes,omitempty"`
}

type Report struct {
	RawFiles         int `json:"raw_files"`
	Exchanges        int `json:"exchanges"`
	Sessions         int `json:"sessions"`
	UnknownSessions  int `json:"unknown_sessions"`
	RejectedRawFiles int `json:"rejected_raw_files"`
	SkippedSessions  int `json:"skipped_sessions"`
}

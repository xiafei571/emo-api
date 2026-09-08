package tracedataset

import (
	"bufio"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

type BuildOptions struct {
	InputDir       string
	ExchangeOutput string
	SessionOutput  string
	IdentityKey    []byte
	TempDir        string
}

func Build(options BuildOptions) (report Report, err error) {
	if err = validateBuildOptions(options); err != nil {
		return report, err
	}
	paths, err := rawPaths(options.InputDir)
	if err != nil {
		return report, err
	}
	tempRoot, err := os.MkdirTemp(options.TempDir, "emo-trace-dataset-")
	if err != nil {
		return report, err
	}
	defer os.RemoveAll(tempRoot)

	exchangeWriter, err := newDatasetWriter(options.ExchangeOutput)
	if err != nil {
		return report, err
	}
	defer exchangeWriter.Abort()

	sessionFiles := map[string]string{}
	for _, path := range paths {
		report.RawFiles++
		raw, readErr := readRawExchange(path)
		if readErr != nil {
			report.RejectedRawFiles++
			return report, fmt.Errorf("read raw trace %s: %w", path, readErr)
		}
		relative, relErr := filepath.Rel(options.InputDir, path)
		if relErr != nil {
			return report, relErr
		}
		exchange := exchangeFromRaw(raw, relative, options.IdentityKey)
		if err = exchangeWriter.Write(exchange); err != nil {
			return report, err
		}
		report.Exchanges++
		if !exchange.SessionKnown {
			report.UnknownSessions++
			continue
		}
		key := exchange.UserID + "/" + exchange.SessionID
		spoolPath := filepath.Join(tempRoot, exchange.UserID, exchange.SessionID+".jsonl")
		if err = appendJSONLine(spoolPath, exchange); err != nil {
			return report, err
		}
		sessionFiles[key] = spoolPath
	}

	sessionWriter, err := newDatasetWriter(options.SessionOutput)
	if err != nil {
		return report, err
	}
	defer sessionWriter.Abort()
	keys := make([]string, 0, len(sessionFiles))
	for key := range sessionFiles {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		session, ok, buildErr := buildSession(sessionFiles[key])
		if buildErr != nil {
			return report, buildErr
		}
		if !ok {
			report.SkippedSessions++
			continue
		}
		if err = sessionWriter.Write(session); err != nil {
			return report, err
		}
		report.Sessions++
	}
	if err = sessionWriter.Commit(); err != nil {
		return report, err
	}
	if err = exchangeWriter.Commit(); err != nil {
		_ = os.Remove(options.SessionOutput)
		return report, err
	}
	return report, nil
}

func validateBuildOptions(options BuildOptions) error {
	if options.InputDir == "" || options.ExchangeOutput == "" || options.SessionOutput == "" {
		return fmt.Errorf("input, exchange output, and session output are required")
	}
	if len(options.IdentityKey) < 32 {
		return fmt.Errorf("identity key must contain at least 32 bytes")
	}
	if options.ExchangeOutput == options.SessionOutput {
		return fmt.Errorf("exchange and session outputs must be different")
	}
	return nil
}

func rawPaths(root string) ([]string, error) {
	var paths []string
	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.Type()&os.ModeSymlink != 0 {
			return fmt.Errorf("symlink is not allowed in input: %s", path)
		}
		if entry.IsDir() {
			return nil
		}
		if entry.Type().IsRegular() && (strings.HasSuffix(path, ".jsonl.gz") || strings.HasSuffix(path, ".ready")) {
			paths = append(paths, path)
		}
		return nil
	})
	sort.Strings(paths)
	return paths, err
}

func appendJSONLine(path string, value any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	file, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	data, err := common.Marshal(value)
	if err == nil {
		data = append(data, '\n')
		_, err = file.Write(data)
	}
	closeErr := file.Close()
	if err != nil {
		return err
	}
	return closeErr
}

func buildSession(path string) (Session, bool, error) {
	file, err := os.Open(path)
	if err != nil {
		return Session{}, false, err
	}
	defer file.Close()
	var exchanges []Exchange
	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 64<<10), 128<<20)
	for scanner.Scan() {
		var exchange Exchange
		if err = common.Unmarshal(scanner.Bytes(), &exchange); err != nil {
			return Session{}, false, err
		}
		exchanges = append(exchanges, exchange)
	}
	if err = scanner.Err(); err != nil {
		return Session{}, false, err
	}
	if len(exchanges) == 0 {
		return Session{}, false, nil
	}
	sort.SliceStable(exchanges, func(i, j int) bool { return exchanges[i].StartedAt < exchanges[j].StartedAt })
	return assembleSession(exchanges)
}

func assembleSession(exchanges []Exchange) (Session, bool, error) {
	first, last := exchanges[0], exchanges[len(exchanges)-1]
	session := Session{
		Schema: "emo-agent-session/1", UserID: first.UserID, SessionID: first.SessionID,
		Metadata: SessionMetadata{SourceFormat: "emo-agent-exchange/1", StartedAt: first.StartedAt, EndedAt: last.CompletedAt,
			Status: last.Status, TerminationReason: last.TerminationReason, RequestCount: len(exchanges)},
	}
	protocols := map[string]bool{}
	tools := map[string]Tool{}
	notes := map[string]bool{}
	for _, exchange := range exchanges {
		protocols[exchange.Protocol] = true
		if exchange.Status != "completed" || !exchange.CaptureComplete || !exchange.MeaningfulOutput || exchange.NormalizationStatus != "normalized" {
			notes["excluded_incomplete_or_unusable_exchange"] = true
			continue
		}
		requestMessages, requestTools := normalizeRequest(exchange.Protocol, exchange.ClientRequest)
		responseMessages := normalizeResponse(exchange.Protocol, exchange.ClientResponse)
		if len(requestMessages) == 0 || len(responseMessages) == 0 {
			notes["excluded_unnormalized_exchange"] = true
			continue
		}
		for _, tool := range requestTools {
			if tool.Name != "" {
				tools[tool.Name] = tool
			}
		}
		session.Messages = mergeRequestContext(session.Messages, requestMessages, notes)
		for _, message := range responseMessages {
			session.Messages = appendUniqueMessage(session.Messages, message)
		}
		session.Model = exchange.Model
		session.Metadata.IncludedRequests++
	}
	for protocol := range protocols {
		session.Metadata.Protocols = append(session.Metadata.Protocols, protocol)
	}
	sort.Strings(session.Metadata.Protocols)
	for _, tool := range tools {
		session.Tools = append(session.Tools, tool)
	}
	sort.Slice(session.Tools, func(i, j int) bool { return session.Tools[i].Name < session.Tools[j].Name })
	for note := range notes {
		session.Metadata.NormalizationNotes = append(session.Metadata.NormalizationNotes, note)
	}
	sort.Strings(session.Metadata.NormalizationNotes)
	if session.Metadata.IncludedRequests == 0 || !hasRole(session.Messages, "user") || !hasRole(session.Messages, "assistant") {
		return Session{}, false, nil
	}
	return session, true, nil
}

func mergeRequestContext(existing, request []Message, notes map[string]bool) []Message {
	if messageSlicePrefix(existing, request) {
		return append([]Message(nil), request...)
	}
	if messageSlicePrefix(request, existing) {
		return existing
	}
	for overlap := min(len(existing), len(request)); overlap > 0; overlap-- {
		if messageSlicesEqual(existing[len(existing)-overlap:], request[:overlap]) {
			return append(existing, request[overlap:]...)
		}
	}
	notes["non_overlapping_request_context"] = true
	for _, message := range request {
		existing = appendUniqueMessage(existing, message)
	}
	return existing
}

func appendUniqueMessage(messages []Message, message Message) []Message {
	if len(messages) > 0 && messagesEqual(messages[len(messages)-1], message) {
		return messages
	}
	return append(messages, message)
}

func messageSlicePrefix(prefix, all []Message) bool {
	return len(prefix) <= len(all) && messageSlicesEqual(prefix, all[:len(prefix)])
}

func messageSlicesEqual(left, right []Message) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if !messagesEqual(left[index], right[index]) {
			return false
		}
	}
	return true
}

func messagesEqual(left, right Message) bool {
	leftJSON, leftErr := common.Marshal(left)
	rightJSON, rightErr := common.Marshal(right)
	return leftErr == nil && rightErr == nil && string(leftJSON) == string(rightJSON)
}

func hasRole(messages []Message, role string) bool {
	for _, message := range messages {
		if message.Role == role && messagesMeaningful([]Message{message}) {
			return true
		}
	}
	return false
}

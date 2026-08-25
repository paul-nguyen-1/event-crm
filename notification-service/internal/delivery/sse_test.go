package delivery

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestSSEHandler_RejectsUnauthenticatedRequestsBeforeOpeningTheStream(t *testing.T) {
	registry := NewRegistry()
	handler := SSEHandler(registry, func(*http.Request) (string, bool) {
		return "", false
	}, "http://localhost:5173")

	req := httptest.NewRequest(http.MethodGet, "/sse", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestSSEHandler_RegistersTheConnectionAndReceivesDeliveredPayloads(t *testing.T) {
	registry := NewRegistry()
	handler := SSEHandler(registry, func(*http.Request) (string, bool) {
		return "user-1", true
	}, "http://localhost:5173")

	ctx, cancel := context.WithCancel(context.Background())
	req := httptest.NewRequest(http.MethodGet, "/sse", nil).WithContext(ctx)
	rec := httptest.NewRecorder()

	done := make(chan struct{})
	go func() {
		handler(rec, req)
		close(done)
	}()

	// Give the handler a moment to register before delivering.
	waitUntil(t, func() bool { return registry.Deliver("user-1", []byte(`{"hello":"world"}`)) })

	cancel()
	<-done

	body := rec.Body.String()
	if !strings.Contains(body, `data: {"hello":"world"}`) {
		t.Fatalf("expected SSE body to contain the delivered payload, got %q", body)
	}

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Fatalf("expected Access-Control-Allow-Origin to be set for the configured web origin, got %q", got)
	}
}

func waitUntil(t *testing.T, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatal("condition not met before timeout")
}

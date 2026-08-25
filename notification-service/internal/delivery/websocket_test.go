package delivery

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"nhooyr.io/websocket"
)

func TestWebSocketHandler_RejectsUnauthenticatedRequestBeforeUpgrade(t *testing.T) {
	registry := NewRegistry()
	handler := WebSocketHandler(registry, func(*http.Request) (string, bool) {
		return "", false
	}, "localhost")
	server := httptest.NewServer(handler)
	defer server.Close()

	req, _ := http.NewRequest(http.MethodGet, server.URL, nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

func TestWebSocketHandler_AcceptsAConnectionFromTheConfiguredWebOrigin(t *testing.T) {
	// Regression test: this is the exact bug caught during live 2.6
	// verification — the web app (localhost:5173) and this service
	// (localhost:8081, or an httptest port here) are different origins, and
	// nhooyr.io/websocket rejects cross-origin upgrades unless the frontend's
	// origin is explicitly allowed via OriginPatterns.
	registry := NewRegistry()
	handler := WebSocketHandler(registry, func(*http.Request) (string, bool) {
		return "user-1", true
	}, "app.example.com")
	server := httptest.NewServer(handler)
	defer server.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	conn, _, err := websocket.Dial(ctx, wsURL(server.URL), &websocket.DialOptions{
		HTTPHeader: http.Header{"Origin": {"http://app.example.com"}},
	})
	if err != nil {
		t.Fatalf("expected the configured origin to be accepted, got error: %v", err)
	}
	conn.Close(websocket.StatusNormalClosure, "")
}

func TestWebSocketHandler_RejectsAConnectionFromAnUnconfiguredOrigin(t *testing.T) {
	registry := NewRegistry()
	handler := WebSocketHandler(registry, func(*http.Request) (string, bool) {
		return "user-1", true
	}, "app.example.com")
	server := httptest.NewServer(handler)
	defer server.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_, _, err := websocket.Dial(ctx, wsURL(server.URL), &websocket.DialOptions{
		HTTPHeader: http.Header{"Origin": {"http://evil.example.com"}},
	})
	if err == nil {
		t.Fatal("expected a mismatched Origin to be rejected")
	}
}

func wsURL(httpURL string) string {
	return "ws" + httpURL[len("http"):]
}

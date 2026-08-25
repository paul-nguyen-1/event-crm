package delivery

import (
	"fmt"
	"net/http"
)

type sseConnection struct {
	w       http.ResponseWriter
	flusher http.Flusher
}

func (s *sseConnection) Send(payload []byte) error {
	if _, err := fmt.Fprintf(s.w, "data: %s\n\n", payload); err != nil {
		return err
	}
	s.flusher.Flush()
	return nil
}

// SSEHandler is the documented fallback transport for networks that block
// WebSocket upgrades. Same auth contract as WebSocketHandler: an
// unauthenticated request never opens the stream.
//
// webOrigin is the frontend's full origin (e.g. "http://localhost:5173"),
// sent as Access-Control-Allow-Origin — a cross-origin EventSource request
// is otherwise blocked by the browser's own CORS enforcement, same reasoning
// as WebSocketHandler's OriginPatterns.
func SSEHandler(registry *Registry, authenticate func(*http.Request) (userID string, ok bool), webOrigin string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := authenticate(r)
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming unsupported", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Access-Control-Allow-Origin", webOrigin)
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.WriteHeader(http.StatusOK)
		flusher.Flush()

		conn := &sseConnection{w: w, flusher: flusher}
		registry.Register(userID, conn)
		defer registry.Unregister(userID, conn)

		<-r.Context().Done()
	}
}

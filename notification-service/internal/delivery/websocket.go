package delivery

import (
	"context"
	"log"
	"net/http"

	"nhooyr.io/websocket"
)

type wsConnection struct {
	ctx  context.Context
	conn *websocket.Conn
}

func (w *wsConnection) Send(payload []byte) error {
	return w.conn.Write(w.ctx, websocket.MessageText, payload)
}

// WebSocketHandler upgrades an authenticated request to a WebSocket and
// keeps it registered in the registry until the connection closes.
// authenticate extracts and validates the caller's identity from the
// request (e.g. a JWT in a query parameter, since browsers can't attach
// custom headers to a WebSocket handshake); an unauthenticated request is
// rejected before the upgrade, not silently degraded.
//
// webOriginPattern is the frontend's origin (host:port, e.g.
// "localhost:5173"; globs like "*.example.com" are supported) — the web app
// and this service are different origins by design, and nhooyr.io/websocket
// rejects cross-origin upgrades unless explicitly allowed here.
func WebSocketHandler(registry *Registry, authenticate func(*http.Request) (userID string, ok bool), webOriginPattern string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := authenticate(r)
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
			OriginPatterns: []string{webOriginPattern},
		})
		if err != nil {
			log.Printf("websocket accept error for user %s: %v", userID, err)
			return
		}

		ctx := context.Background()
		wsConn := &wsConnection{ctx: ctx, conn: conn}
		registry.Register(userID, wsConn)
		defer registry.Unregister(userID, wsConn)

		// This connection only ever receives server-pushed reminders; it
		// doesn't need to read client messages, but reading (and discarding)
		// is how we detect the client going away so cleanup happens promptly.
		for {
			if _, _, err := conn.Read(ctx); err != nil {
				conn.Close(websocket.StatusNormalClosure, "")
				return
			}
		}
	}
}

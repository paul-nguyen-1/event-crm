package delivery

import "sync"

// Connection is one open transport (a WebSocket or an SSE stream) capable of
// pushing a raw message to whatever client is on the other end.
type Connection interface {
	Send(payload []byte) error
}

// Registry tracks open connections per user. A user may have more than one
// open connection (multiple tabs/devices), so delivery fans out to all of
// them.
type Registry struct {
	mu          sync.RWMutex
	connections map[string][]Connection
}

func NewRegistry() *Registry {
	return &Registry{connections: make(map[string][]Connection)}
}

func (r *Registry) Register(userID string, conn Connection) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.connections[userID] = append(r.connections[userID], conn)
}

func (r *Registry) Unregister(userID string, conn Connection) {
	r.mu.Lock()
	defer r.mu.Unlock()

	conns := r.connections[userID]
	for i, c := range conns {
		if c == conn {
			r.connections[userID] = append(conns[:i], conns[i+1:]...)
			break
		}
	}
	if len(r.connections[userID]) == 0 {
		delete(r.connections, userID)
	}
}

// Deliver sends payload to every open connection for userID. It reports
// whether at least one connection received it — a false return means the
// user simply has no open session right now, not an error.
func (r *Registry) Deliver(userID string, payload []byte) bool {
	r.mu.RLock()
	conns := append([]Connection(nil), r.connections[userID]...)
	r.mu.RUnlock()

	delivered := false
	for _, conn := range conns {
		if err := conn.Send(payload); err == nil {
			delivered = true
		}
	}
	return delivered
}

package delivery

import (
	"errors"
	"reflect"
	"testing"
)

type fakeConn struct {
	received [][]byte
	err      error
}

func (f *fakeConn) Send(payload []byte) error {
	if f.err != nil {
		return f.err
	}
	f.received = append(f.received, payload)
	return nil
}

func TestRegistry_DeliverToUserWithNoConnections(t *testing.T) {
	r := NewRegistry()

	delivered := r.Deliver("user-1", []byte("hello"))

	if delivered {
		t.Fatal("expected Deliver to report false when the user has no open connections")
	}
}

func TestRegistry_DeliverToASingleRegisteredConnection(t *testing.T) {
	r := NewRegistry()
	conn := &fakeConn{}
	r.Register("user-1", conn)

	delivered := r.Deliver("user-1", []byte("hello"))

	if !delivered {
		t.Fatal("expected Deliver to report true")
	}
	if !reflect.DeepEqual(conn.received, [][]byte{[]byte("hello")}) {
		t.Fatalf("expected connection to receive the payload, got %v", conn.received)
	}
}

func TestRegistry_FansOutToAllConnectionsForTheSameUser(t *testing.T) {
	r := NewRegistry()
	connA := &fakeConn{}
	connB := &fakeConn{}
	r.Register("user-1", connA)
	r.Register("user-1", connB)

	r.Deliver("user-1", []byte("hello"))

	if len(connA.received) != 1 || len(connB.received) != 1 {
		t.Fatalf("expected both connections to receive the payload, got A=%v B=%v", connA.received, connB.received)
	}
}

func TestRegistry_DeliverOnlyReachesTheTargetUser(t *testing.T) {
	r := NewRegistry()
	connA := &fakeConn{}
	connB := &fakeConn{}
	r.Register("user-1", connA)
	r.Register("user-2", connB)

	r.Deliver("user-1", []byte("hello"))

	if len(connA.received) != 1 {
		t.Fatalf("expected user-1's connection to receive the payload")
	}
	if len(connB.received) != 0 {
		t.Fatalf("expected user-2's connection to receive nothing, got %v", connB.received)
	}
}

func TestRegistry_UnregisterStopsFutureDelivery(t *testing.T) {
	r := NewRegistry()
	conn := &fakeConn{}
	r.Register("user-1", conn)
	r.Unregister("user-1", conn)

	delivered := r.Deliver("user-1", []byte("hello"))

	if delivered {
		t.Fatal("expected Deliver to report false after the only connection unregistered")
	}
}

func TestRegistry_UnregisterOnlyRemovesTheGivenConnection(t *testing.T) {
	r := NewRegistry()
	connA := &fakeConn{}
	connB := &fakeConn{}
	r.Register("user-1", connA)
	r.Register("user-1", connB)
	r.Unregister("user-1", connA)

	r.Deliver("user-1", []byte("hello"))

	if len(connA.received) != 0 {
		t.Fatal("expected the unregistered connection to receive nothing")
	}
	if len(connB.received) != 1 {
		t.Fatal("expected the still-registered connection to receive the payload")
	}
}

func TestRegistry_AFailingConnectionDoesNotStopDeliveryToOthers(t *testing.T) {
	r := NewRegistry()
	failing := &fakeConn{err: errors.New("write: broken pipe")}
	working := &fakeConn{}
	r.Register("user-1", failing)
	r.Register("user-1", working)

	delivered := r.Deliver("user-1", []byte("hello"))

	if !delivered {
		t.Fatal("expected Deliver to report true since at least one connection succeeded")
	}
	if len(working.received) != 1 {
		t.Fatal("expected the working connection to still receive the payload")
	}
}

func TestRegistry_DeliverReportsFalseWhenEveryConnectionFails(t *testing.T) {
	r := NewRegistry()
	failing := &fakeConn{err: errors.New("write: broken pipe")}
	r.Register("user-1", failing)

	delivered := r.Deliver("user-1", []byte("hello"))

	if delivered {
		t.Fatal("expected Deliver to report false when every connection failed")
	}
}

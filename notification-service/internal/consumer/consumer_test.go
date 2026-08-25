package consumer

import (
	"context"
	"errors"
	"testing"
)

type fakeDedup struct {
	seenEventIDs map[string]bool
	calls        []string
}

func newFakeDedup() *fakeDedup {
	return &fakeDedup{seenEventIDs: make(map[string]bool)}
}

func (f *fakeDedup) MarkIfNew(_ context.Context, eventID string) bool {
	f.calls = append(f.calls, eventID)
	seen := f.seenEventIDs[eventID]
	f.seenEventIDs[eventID] = true
	return seen
}

type fakeDeliverer struct {
	delivered   bool
	calls       int
	lastUserID  string
	lastPayload []byte
}

func (f *fakeDeliverer) Deliver(userID string, payload []byte) bool {
	f.calls++
	f.lastUserID = userID
	f.lastPayload = payload
	return f.delivered
}

type fakeReceipts struct {
	published []string
	err       error
}

func (f *fakeReceipts) PublishReceipt(reminderID string) error {
	if f.err != nil {
		return f.err
	}
	f.published = append(f.published, reminderID)
	return nil
}

func newHandler(dedup *fakeDedup, delivery *fakeDeliverer, receipts *fakeReceipts) *Handler {
	return &Handler{Dedup: dedup, Delivery: delivery, Receipts: receipts}
}

func TestHandleMessage_NewEventDeliveredPublishesReceipt(t *testing.T) {
	dedup := newFakeDedup()
	delivery := &fakeDeliverer{delivered: true}
	receipts := &fakeReceipts{}
	h := newHandler(dedup, delivery, receipts)

	body := []byte(`{"eventId":"e1","userId":"u1","reminderId":"r1"}`)
	err := h.HandleMessage(context.Background(), body)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if delivery.calls != 1 || delivery.lastUserID != "u1" {
		t.Fatalf("expected delivery to be attempted for u1, got calls=%d user=%s", delivery.calls, delivery.lastUserID)
	}
	if string(delivery.lastPayload) != string(body) {
		t.Fatal("expected the raw message body to be forwarded unmodified")
	}
	if len(receipts.published) != 1 || receipts.published[0] != "r1" {
		t.Fatalf("expected a receipt published for r1, got %v", receipts.published)
	}
}

func TestHandleMessage_NoOpenConnectionSkipsReceipt(t *testing.T) {
	dedup := newFakeDedup()
	delivery := &fakeDeliverer{delivered: false}
	receipts := &fakeReceipts{}
	h := newHandler(dedup, delivery, receipts)

	body := []byte(`{"eventId":"e1","userId":"u1","reminderId":"r1"}`)
	err := h.HandleMessage(context.Background(), body)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(receipts.published) != 0 {
		t.Fatalf("expected no receipt when nothing was delivered, got %v", receipts.published)
	}
}

func TestHandleMessage_AlreadySeenEventSkipsDeliveryButRepublishesReceipt(t *testing.T) {
	// This is the idempotency guarantee: a redelivered message (e.g. after a
	// restart before the original ack landed) must not push a duplicate to
	// the client, but the receipt still needs to go out in case the crash
	// happened between the original delivery and its receipt.
	dedup := newFakeDedup()
	delivery := &fakeDeliverer{delivered: true}
	receipts := &fakeReceipts{}
	h := newHandler(dedup, delivery, receipts)
	body := []byte(`{"eventId":"e1","userId":"u1","reminderId":"r1"}`)

	_ = h.HandleMessage(context.Background(), body)
	delivery.calls = 0
	err := h.HandleMessage(context.Background(), body)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if delivery.calls != 0 {
		t.Fatalf("expected delivery to be skipped on the second (duplicate) message, got %d calls", delivery.calls)
	}
	if len(receipts.published) != 2 {
		t.Fatalf("expected a receipt on both the original and the duplicate delivery, got %v", receipts.published)
	}
}

func TestHandleMessage_MalformedJSONReturnsError(t *testing.T) {
	h := newHandler(newFakeDedup(), &fakeDeliverer{}, &fakeReceipts{})

	err := h.HandleMessage(context.Background(), []byte("not json"))

	if err == nil {
		t.Fatal("expected an error for a malformed message")
	}
}

func TestHandleMessage_MissingEventIDReturnsError(t *testing.T) {
	h := newHandler(newFakeDedup(), &fakeDeliverer{}, &fakeReceipts{})

	err := h.HandleMessage(context.Background(), []byte(`{"userId":"u1"}`))

	if err == nil {
		t.Fatal("expected an error for a message missing eventId")
	}
}

func TestHandleMessage_MissingUserIDReturnsError(t *testing.T) {
	h := newHandler(newFakeDedup(), &fakeDeliverer{}, &fakeReceipts{})

	err := h.HandleMessage(context.Background(), []byte(`{"eventId":"e1"}`))

	if err == nil {
		t.Fatal("expected an error for a message missing userId")
	}
}

func TestHandleMessage_NoReminderIDMeansNoReceiptAttempt(t *testing.T) {
	dedup := newFakeDedup()
	delivery := &fakeDeliverer{delivered: true}
	receipts := &fakeReceipts{}
	h := newHandler(dedup, delivery, receipts)

	body := []byte(`{"eventId":"e1","userId":"u1"}`)
	err := h.HandleMessage(context.Background(), body)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(receipts.published) != 0 {
		t.Fatalf("expected no receipt attempt without a reminderId, got %v", receipts.published)
	}
}

func TestHandleMessage_ReceiptPublishFailureDoesNotFailTheMessage(t *testing.T) {
	// A receipt publish failure shouldn't cause the delivery message itself
	// to be nacked/redelivered — that would risk a duplicate push next time.
	dedup := newFakeDedup()
	delivery := &fakeDeliverer{delivered: true}
	receipts := &fakeReceipts{err: errors.New("amqp publish failed")}
	h := newHandler(dedup, delivery, receipts)

	body := []byte(`{"eventId":"e1","userId":"u1","reminderId":"r1"}`)
	err := h.HandleMessage(context.Background(), body)

	if err != nil {
		t.Fatalf("expected no error even when the receipt publish fails, got %v", err)
	}
}

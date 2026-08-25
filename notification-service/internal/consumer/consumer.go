package consumer

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
)

// envelope carries only the fields this service needs for routing and
// idempotency. Everything else in the message (title, body, deepLink,
// channel, ...) is content NestJS already decided on — this service
// forwards the raw bytes to the client unmodified rather than parsing and
// re-shaping them, per the "Go only decides how to deliver" boundary.
type envelope struct {
	EventID    string `json:"eventId"`
	UserID     string `json:"userId"`
	ReminderID string `json:"reminderId"`
}

// Deduper reports whether an eventID has already been claimed by a prior
// call, atomically claiming it if not.
type Deduper interface {
	MarkIfNew(ctx context.Context, eventID string) (alreadySeen bool)
}

// Deliverer pushes a raw payload to a user's open connection(s), reporting
// whether at least one connection received it.
type Deliverer interface {
	Deliver(userID string, payload []byte) (delivered bool)
}

// ReceiptPublisher confirms a successful in-app delivery back to NestJS.
type ReceiptPublisher interface {
	PublishReceipt(reminderID string) error
}

type Handler struct {
	Dedup    Deduper
	Delivery Deliverer
	Receipts ReceiptPublisher
}

// HandleMessage processes one delivery-queue message. It returns an error
// only for a message so malformed it can never be processed (the caller
// should nack it without requeue) — every other outcome (no open
// connection, an already-seen event, a receipt-publish failure) is handled
// internally and reported via logging, so the caller should still ack.
//
// No branching on event type or channel happens here: every message on
// this queue gets the same treatment, by design — a different *decision*
// for a different event type belongs in NestJS, not here.
func (h *Handler) HandleMessage(ctx context.Context, body []byte) error {
	var env envelope
	if err := json.Unmarshal(body, &env); err != nil {
		return fmt.Errorf("malformed message: %w", err)
	}
	if env.EventID == "" || env.UserID == "" {
		return fmt.Errorf("message missing eventId or userId")
	}

	alreadySeen := h.Dedup.MarkIfNew(ctx, env.EventID)
	if alreadySeen {
		// Redelivery of a message we already handled (e.g. this service
		// restarted before acking). Skip re-delivery to avoid a duplicate
		// push, but still (re-)publish the receipt: if the crash happened
		// between the original delivery and its receipt, this is what
		// closes that gap. Publishing it twice is harmless — NestJS's
		// receipts consumer treats it as an idempotent status update.
		h.publishReceiptIfReminder(env)
		log.Printf("event %s already delivered, skipping duplicate push", env.EventID)
		return nil
	}

	delivered := h.Delivery.Deliver(env.UserID, body)
	if delivered {
		h.publishReceiptIfReminder(env)
	} else {
		log.Printf("event %s: user %s has no open connection, nothing to deliver", env.EventID, env.UserID)
	}

	return nil
}

func (h *Handler) publishReceiptIfReminder(env envelope) {
	if env.ReminderID == "" {
		return
	}
	if err := h.Receipts.PublishReceipt(env.ReminderID); err != nil {
		log.Printf("failed to publish delivery receipt for reminder %s: %v", env.ReminderID, err)
	}
}

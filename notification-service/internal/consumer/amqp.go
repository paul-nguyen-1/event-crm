package consumer

import (
	"context"
	"encoding/json"
	"log"

	amqp "github.com/rabbitmq/amqp091-go"
)

// Run consumes queueName, delegating each message to handler. It blocks
// until the delivery channel closes (e.g. the connection dropping).
func Run(ch *amqp.Channel, queueName string, handler *Handler) error {
	msgs, err := ch.Consume(queueName, "", false, false, false, false, nil)
	if err != nil {
		return err
	}

	for msg := range msgs {
		if err := handler.HandleMessage(context.Background(), msg.Body); err != nil {
			log.Printf("dropping unprocessable message: %v", err)
			_ = msg.Nack(false, false)
			continue
		}
		_ = msg.Ack(false)
	}

	return nil
}

// AMQPReceiptPublisher publishes delivery confirmations to the receipts
// queue NestJS consumes (declared durable in Phase 2.1; published here via
// the default exchange using the queue name as the routing key).
type AMQPReceiptPublisher struct {
	Channel   *amqp.Channel
	QueueName string
}

func (p *AMQPReceiptPublisher) PublishReceipt(reminderID string) error {
	body, err := json.Marshal(struct {
		ReminderID string `json:"reminderId"`
	}{ReminderID: reminderID})
	if err != nil {
		return err
	}
	return p.Channel.Publish("", p.QueueName, false, false, amqp.Publishing{
		ContentType:  "application/json",
		Body:         body,
		DeliveryMode: amqp.Persistent,
	})
}

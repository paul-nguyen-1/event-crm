package main

import (
	"context"
	"log"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/joho/godotenv"
	amqp "github.com/rabbitmq/amqp091-go"
	"github.com/redis/go-redis/v9"

	"notification-service/internal/auth"
	"notification-service/internal/consumer"
	"notification-service/internal/dedup"
	"notification-service/internal/delivery"
)

const (
	domainEventsExchange = "domain.events"
	deliveryQueueName    = "notification-service.delivery"
	deliveryRoutingKey   = "reminder.due"
	receiptsQueueName    = "notification-service.receipts"
)

func main() {
	_ = godotenv.Load()

	rabbitURL := requireEnv("RABBITMQ_URL")
	redisURL := requireEnv("REDIS_URL")
	jwtSecret := requireEnv("JWT_ACCESS_SECRET")
	webOrigin := requireEnv("WEB_ORIGIN")

	webOriginURL, err := url.Parse(webOrigin)
	if err != nil || webOriginURL.Host == "" {
		log.Fatalf("invalid WEB_ORIGIN %q: must be a full origin like http://localhost:5173", webOrigin)
	}

	amqpConn, amqpChannel := connectRabbitMQ(rabbitURL)
	defer amqpChannel.Close()
	defer amqpConn.Close()

	redisClient := connectRedis(redisURL)
	defer redisClient.Close()

	registry := delivery.NewRegistry()
	dedupCache := dedup.NewCache(redisClient, dedup.DefaultTTL)
	handler := &consumer.Handler{
		Dedup:    dedupCache,
		Delivery: registry,
		Receipts: &consumer.AMQPReceiptPublisher{Channel: amqpChannel, QueueName: receiptsQueueName},
	}

	go func() {
		if err := consumer.Run(amqpChannel, deliveryQueueName, handler); err != nil {
			log.Fatalf("consumer stopped: %v", err)
		}
	}()

	authenticate := func(r *http.Request) (string, bool) {
		token := r.URL.Query().Get("token")
		if token == "" {
			return "", false
		}
		userID, err := auth.ValidateToken(token, jwtSecret)
		if err != nil {
			return "", false
		}
		return userID, true
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})
	mux.HandleFunc("/ws", delivery.WebSocketHandler(registry, authenticate, webOriginURL.Host))
	mux.HandleFunc("/sse", delivery.SSEHandler(registry, authenticate, webOrigin))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("notification-service listening on :%s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("http server error: %v", err)
	}
}

func requireEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("missing required env var %s", key)
	}
	return v
}

// connectRabbitMQ dials RabbitMQ and declares the broker topology this
// service depends on: the shared domain.events topic exchange (already
// declared by the NestJS outbox relay; asserting it here is idempotent and
// lets this service boot independently), the delivery queue this service
// consumes from, and the receipts queue it publishes confirmations to.
func connectRabbitMQ(url string) (*amqp.Connection, *amqp.Channel) {
	conn, err := amqp.Dial(url)
	if err != nil {
		log.Fatalf("rabbitmq connect error: %v", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		log.Fatalf("rabbitmq channel error: %v", err)
	}

	if err := ch.ExchangeDeclare(domainEventsExchange, "topic", true, false, false, false, nil); err != nil {
		log.Fatalf("exchange declare error: %v", err)
	}

	deliveryQueue, err := ch.QueueDeclare(deliveryQueueName, true, false, false, false, nil)
	if err != nil {
		log.Fatalf("delivery queue declare error: %v", err)
	}
	if err := ch.QueueBind(deliveryQueue.Name, deliveryRoutingKey, domainEventsExchange, false, nil); err != nil {
		log.Fatalf("delivery queue bind error: %v", err)
	}

	if _, err := ch.QueueDeclare(receiptsQueueName, true, false, false, false, nil); err != nil {
		log.Fatalf("receipts queue declare error: %v", err)
	}

	return conn, ch
}

func connectRedis(url string) *redis.Client {
	opts, err := redis.ParseURL(url)
	if err != nil {
		log.Fatalf("invalid REDIS_URL: %v", err)
	}

	client := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		log.Fatalf("redis connect error: %v", err)
	}

	return client
}

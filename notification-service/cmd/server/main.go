package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/joho/godotenv"
	amqp "github.com/rabbitmq/amqp091-go"
	"github.com/redis/go-redis/v9"

	"notification-service/internal/auth"
	"notification-service/internal/consumer"
	"notification-service/internal/dedup"
	"notification-service/internal/delivery"
	"notification-service/internal/metrics"
)

const metricsInterval = 60 * time.Second

const (
	domainEventsExchange = "domain.events"
	deliveryQueueName    = "notification-service.delivery"
	deliveryRoutingKey   = "reminder.due"
	receiptsQueueName    = "notification-service.receipts"
)

func main() {
	_ = godotenv.Load()

	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	// Empty Dsn disables the client without erroring — sends become no-ops
	// until a real per-service Sentry project DSN is configured.
	if err := sentry.Init(sentry.ClientOptions{Dsn: os.Getenv("SENTRY_DSN")}); err != nil {
		slog.Error("sentry init failed", "error", err)
	}
	defer sentry.Flush(2 * time.Second)

	rabbitURL := requireEnv("RABBITMQ_URL")
	redisURL := requireEnv("REDIS_URL")
	jwtSecret := requireEnv("JWT_ACCESS_SECRET")
	webOrigin := requireEnv("WEB_ORIGIN")

	webOriginURL, err := url.Parse(webOrigin)
	if err != nil || webOriginURL.Host == "" {
		fatalf("invalid WEB_ORIGIN %q: must be a full origin like http://localhost:5173", webOrigin)
	}

	amqpConn, amqpChannel := connectRabbitMQ(rabbitURL)
	defer amqpChannel.Close()
	defer amqpConn.Close()

	redisClient := connectRedis(redisURL)
	defer redisClient.Close()

	registry := delivery.NewRegistry()
	stopMetrics := metrics.StartPeriodicLogger(registry, metricsInterval)
	defer stopMetrics()

	dedupCache := dedup.NewCache(redisClient, dedup.DefaultTTL)
	handler := &consumer.Handler{
		Dedup:    dedupCache,
		Delivery: registry,
		Receipts: &consumer.AMQPReceiptPublisher{Channel: amqpChannel, QueueName: receiptsQueueName},
	}

	go func() {
		if err := consumer.Run(amqpChannel, deliveryQueueName, handler); err != nil {
			fatalf("consumer stopped: %v", err)
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

	slog.Info("notification-service listening", "port", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		fatalf("http server error: %v", err)
	}
}

// fatalf logs a structured error and exits — a JSON-logging equivalent of
// log.Fatalf. Callers that don't check for a return afterward are relying
// on this to actually terminate the process, same as log.Fatalf did.
func fatalf(format string, args ...any) {
	slog.Error(fmt.Sprintf(format, args...))
	os.Exit(1)
}

func requireEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		fatalf("missing required env var %s", key)
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
		fatalf("rabbitmq connect error: %v", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		fatalf("rabbitmq channel error: %v", err)
	}

	if err := ch.ExchangeDeclare(domainEventsExchange, "topic", true, false, false, false, nil); err != nil {
		fatalf("exchange declare error: %v", err)
	}

	deliveryQueue, err := ch.QueueDeclare(deliveryQueueName, true, false, false, false, nil)
	if err != nil {
		fatalf("delivery queue declare error: %v", err)
	}
	if err := ch.QueueBind(deliveryQueue.Name, deliveryRoutingKey, domainEventsExchange, false, nil); err != nil {
		fatalf("delivery queue bind error: %v", err)
	}

	if _, err := ch.QueueDeclare(receiptsQueueName, true, false, false, false, nil); err != nil {
		fatalf("receipts queue declare error: %v", err)
	}

	return conn, ch
}

func connectRedis(url string) *redis.Client {
	opts, err := redis.ParseURL(url)
	if err != nil {
		fatalf("invalid REDIS_URL: %v", err)
	}

	client := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		fatalf("redis connect error: %v", err)
	}

	return client
}

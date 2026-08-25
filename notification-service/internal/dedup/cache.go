package dedup

import (
	"context"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

const keyPrefix = "notification-service:delivered:"

// DefaultTTL for a delivered-event marker. Only needs to outlive the window
// in which RabbitMQ might redeliver the same message (e.g. a consumer
// restart before an ack lands) — not a long-term delivery log.
const DefaultTTL = 10 * time.Minute

type Cache struct {
	client *redis.Client
	ttl    time.Duration
}

func NewCache(client *redis.Client, ttl time.Duration) *Cache {
	return &Cache{client: client, ttl: ttl}
}

// MarkIfNew atomically checks whether eventID has been seen before and, if
// not, marks it seen. It returns alreadySeen=true only when a prior call
// already claimed this eventID.
//
// On a Redis error, it fails open — reports alreadySeen=false so delivery
// proceeds. A missed dedup (rare, occasional duplicate push) is preferable
// to Redis briefly being unavailable silently blocking every delivery.
func (c *Cache) MarkIfNew(ctx context.Context, eventID string) (alreadySeen bool) {
	set, err := c.client.SetNX(ctx, keyPrefix+eventID, "1", c.ttl).Result()
	if err != nil {
		log.Printf("dedup cache error for event %s, delivering anyway: %v", eventID, err)
		return false
	}
	return !set
}

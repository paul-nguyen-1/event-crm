package dedup

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
)

func testClient(t *testing.T) *redis.Client {
	t.Helper()
	_ = godotenv.Load("../../.env")

	url := os.Getenv("REDIS_URL")
	if url == "" {
		url = "redis://localhost:6380"
	}
	opts, err := redis.ParseURL(url)
	if err != nil {
		t.Fatalf("invalid REDIS_URL %q: %v", url, err)
	}
	client := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		t.Skipf("skipping: redis not reachable at %s: %v", url, err)
	}
	return client
}

func uniqueEventID(t *testing.T) string {
	t.Helper()
	return fmt.Sprintf("test-%s-%d", t.Name(), time.Now().UnixNano())
}

func TestCache_MarkIfNew_FirstCallReportsNotSeen(t *testing.T) {
	client := testClient(t)
	defer client.Close()
	cache := NewCache(client, time.Minute)
	eventID := uniqueEventID(t)
	defer client.Del(context.Background(), keyPrefix+eventID)

	alreadySeen := cache.MarkIfNew(context.Background(), eventID)

	if alreadySeen {
		t.Fatal("expected the first call for a fresh eventID to report alreadySeen=false")
	}
}

func TestCache_MarkIfNew_SecondCallReportsSeen(t *testing.T) {
	client := testClient(t)
	defer client.Close()
	cache := NewCache(client, time.Minute)
	eventID := uniqueEventID(t)
	defer client.Del(context.Background(), keyPrefix+eventID)
	ctx := context.Background()

	cache.MarkIfNew(ctx, eventID)
	alreadySeen := cache.MarkIfNew(ctx, eventID)

	if !alreadySeen {
		t.Fatal("expected a repeated call for the same eventID to report alreadySeen=true")
	}
}

func TestCache_MarkIfNew_DistinctEventIDsAreIndependent(t *testing.T) {
	client := testClient(t)
	defer client.Close()
	cache := NewCache(client, time.Minute)
	eventA := uniqueEventID(t) + "-a"
	eventB := uniqueEventID(t) + "-b"
	defer client.Del(context.Background(), keyPrefix+eventA, keyPrefix+eventB)
	ctx := context.Background()

	cache.MarkIfNew(ctx, eventA)
	alreadySeenB := cache.MarkIfNew(ctx, eventB)

	if alreadySeenB {
		t.Fatal("expected a different eventID to be unaffected by a previously marked one")
	}
}

func TestCache_MarkIfNew_ExpiresAfterTTL(t *testing.T) {
	client := testClient(t)
	defer client.Close()
	cache := NewCache(client, 50*time.Millisecond)
	eventID := uniqueEventID(t)
	defer client.Del(context.Background(), keyPrefix+eventID)
	ctx := context.Background()

	cache.MarkIfNew(ctx, eventID)
	time.Sleep(150 * time.Millisecond)
	alreadySeen := cache.MarkIfNew(ctx, eventID)

	if alreadySeen {
		t.Fatal("expected the marker to have expired, allowing the eventID to be treated as new again")
	}
}

func TestCache_MarkIfNew_FailsOpenWhenRedisIsUnreachable(t *testing.T) {
	// Deliberately unreachable: a client pointed at a closed port must not
	// block delivery — the documented failure mode is "deliver anyway".
	opts, _ := redis.ParseURL("redis://localhost:1")
	client := redis.NewClient(opts)
	defer client.Close()
	cache := NewCache(client, time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()
	alreadySeen := cache.MarkIfNew(ctx, "any-event")

	if alreadySeen {
		t.Fatal("expected fail-open behavior (alreadySeen=false) when Redis is unreachable")
	}
}

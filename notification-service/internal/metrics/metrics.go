// Package metrics collects a handful of in-process counters and logs a
// periodic JSON summary — per the Phase 2 observability decision to log
// minimal metrics rather than stand up a Prometheus/Grafana stack before
// there's real traffic to justify one.
package metrics

import (
	"log/slog"
	"sync/atomic"
	"time"
)

var (
	consumed        atomic.Int64
	dedupHits       atomic.Int64
	dedupMisses     atomic.Int64
	deliveryLatency atomic.Int64 // sum of nanoseconds, for a mean
	deliveryCount   atomic.Int64
)

// IncConsumed records one delivery-queue message handled.
func IncConsumed() { consumed.Add(1) }

// IncDedupHit records an event the dedup cache had already seen.
func IncDedupHit() { dedupHits.Add(1) }

// IncDedupMiss records an event the dedup cache had not seen before.
func IncDedupMiss() { dedupMisses.Add(1) }

// RecordDeliveryLatency records the time from receiving a message to
// finishing its delivery attempt.
func RecordDeliveryLatency(d time.Duration) {
	deliveryLatency.Add(d.Nanoseconds())
	deliveryCount.Add(1)
}

// ConnectionCounter reports the number of currently open connections
// (satisfied by delivery.Registry).
type ConnectionCounter interface {
	Count() int
}

// StartPeriodicLogger logs one structured summary line every interval and
// resets the counters it flushed. Returns a stop function.
func StartPeriodicLogger(registry ConnectionCounter, interval time.Duration) (stop func()) {
	ticker := time.NewTicker(interval)
	done := make(chan struct{})

	go func() {
		for {
			select {
			case <-ticker.C:
				flush(registry, interval)
			case <-done:
				return
			}
		}
	}()

	return func() {
		ticker.Stop()
		close(done)
	}
}

func flush(registry ConnectionCounter, interval time.Duration) {
	c := consumed.Swap(0)
	hits := dedupHits.Swap(0)
	misses := dedupMisses.Swap(0)
	latencySum := deliveryLatency.Swap(0)
	latencyCount := deliveryCount.Swap(0)

	var hitRate float64
	if total := hits + misses; total > 0 {
		hitRate = float64(hits) / float64(total)
	}
	var avgLatencyMs float64
	if latencyCount > 0 {
		avgLatencyMs = float64(latencySum) / float64(latencyCount) / float64(time.Millisecond)
	}

	slog.Info("metrics",
		"intervalSeconds", interval.Seconds(),
		"activeConnections", registry.Count(),
		"messagesConsumed", c,
		"dedupHitRate", hitRate,
		"avgDeliveryLatencyMs", avgLatencyMs,
	)
}

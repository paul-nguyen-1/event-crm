import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.floor((p / 100) * sorted.length),
  );
  return sorted[index];
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Minimal metrics: request/query durations collected in memory and logged
 * as one structured summary per interval, per the Phase 2 observability
 * decision to log periodically rather than stand up Prometheus/Grafana
 * before there's real traffic to justify a dashboard.
 */
@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private requestDurationsMs: number[] = [];
  private queryDurationsMs: number[] = [];

  recordRequest(durationMs: number) {
    this.requestDurationsMs.push(durationMs);
  }

  recordQuery(durationMs: number) {
    this.queryDurationsMs.push(durationMs);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  flush() {
    const requests = this.requestDurationsMs.splice(0);
    const queries = this.queryDurationsMs.splice(0);
    const sortedRequests = [...requests].sort((a, b) => a - b);

    this.logger.log({
      message: 'metrics',
      requestCount: requests.length,
      avgRequestLatencyMs: Math.round(average(requests)),
      p95RequestLatencyMs: Math.round(percentile(sortedRequests, 95)),
      queryCount: queries.length,
      avgQueryDurationMs: Math.round(average(queries)),
    });
  }
}

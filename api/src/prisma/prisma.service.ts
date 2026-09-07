import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { MetricsService } from '../observability/metrics.service';

// The generated client's LogOpts generic is inferred from the object passed
// to its constructor, which doesn't flow through a subclass's `extends`
// clause — so $on('query', ...) isn't visible on `this` without this
// narrowly-typed escape hatch (matching the `log` config passed to super()
// below, nothing broader).
interface QueryEventEmitter {
  $on(event: 'query', callback: (event: { duration: number }) => void): void;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private readonly metrics: MetricsService) {
    super({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
      log: [{ emit: 'event', level: 'query' }],
    });
  }

  async onModuleInit() {
    (this as unknown as QueryEventEmitter).$on('query', (e) => {
      this.metrics.recordQuery(e.duration);
    });
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

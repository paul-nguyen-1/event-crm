import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as amqp from 'amqplib';
import { PrismaService } from '../prisma/prisma.service';

const EXCHANGE = 'domain.events';

@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private connection?: amqp.ChannelModel;
  private channel?: amqp.Channel;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    this.connection = await amqp.connect(process.env.RABBITMQ_URL!);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(EXCHANGE, 'topic', { durable: true });
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async relay() {
    const events = await this.prisma.domainEvent.findMany({
      where: { published: false },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    for (const event of events) {
      const envelope = {
        eventId: event.id,
        type: event.type,
        payload: event.payload,
        occurredAt: event.createdAt.toISOString(),
        schemaVersion: 1,
      };

      this.channel!.publish(
        EXCHANGE,
        event.type,
        Buffer.from(JSON.stringify(envelope)),
        {
          persistent: true,
        },
      );

      await this.prisma.domainEvent.update({
        where: { id: event.id },
        data: { published: true },
      });

      this.logger.log(`Published domain event ${event.id} (${event.type})`);
    }
  }
}

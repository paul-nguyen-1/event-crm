import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as amqp from 'amqplib';
import { PrismaService } from '../prisma/prisma.service';

const RECEIPTS_QUEUE = 'notification-service.receipts';

interface DeliveryReceipt {
  reminderId: string;
}

/**
 * Consumes in-app delivery confirmations published by the Go
 * notification-service. Email's sentStatus is set via Resend's own response
 * path instead — this queue only ever carries in-app receipts.
 */
@Injectable()
export class NotificationsReceiptsConsumerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(
    NotificationsReceiptsConsumerService.name,
  );
  private connection?: amqp.ChannelModel;
  private channel?: amqp.Channel;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    this.connection = await amqp.connect(process.env.RABBITMQ_URL!);
    this.channel = await this.connection.createChannel();
    await this.channel.assertQueue(RECEIPTS_QUEUE, { durable: true });

    await this.channel.consume(RECEIPTS_QUEUE, (msg) => {
      if (!msg) return;
      void this.handle(msg);
    });
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }

  private async handle(msg: amqp.ConsumeMessage) {
    try {
      const receipt = JSON.parse(msg.content.toString()) as DeliveryReceipt;
      await this.prisma.reminder.update({
        where: { id: receipt.reminderId },
        data: { sentStatus: true },
      });
      this.logger.log(
        `In-app delivery confirmed for reminder ${receipt.reminderId}`,
      );
      this.channel!.ack(msg);
    } catch (err) {
      this.logger.error(`Failed to process delivery receipt: ${err}`);
      this.channel!.nack(msg, false, false);
    }
  }
}

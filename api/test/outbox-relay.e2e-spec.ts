import { Test, TestingModule } from '@nestjs/testing';
import * as amqp from 'amqplib';
import { PrismaService } from '../src/prisma/prisma.service';
import { OutboxService } from '../src/outbox/outbox.service';
import { OutboxRelayService } from '../src/outbox/outbox-relay.service';

const EXCHANGE = 'domain.events';

describe('Outbox relay -> real RabbitMQ (integration)', () => {
  let prisma: PrismaService;
  let outbox: OutboxService;
  let relay: OutboxRelayService;
  let consumerConnection: amqp.ChannelModel;
  let consumerChannel: amqp.Channel;
  let queueName: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService, OutboxService, OutboxRelayService],
    }).compile();

    prisma = module.get(PrismaService);
    outbox = module.get(OutboxService);
    relay = module.get(OutboxRelayService);
    await prisma.$connect();
    await relay.onModuleInit();

    consumerConnection = await amqp.connect(process.env.RABBITMQ_URL!);
    consumerChannel = await consumerConnection.createChannel();
    await consumerChannel.assertExchange(EXCHANGE, 'topic', { durable: true });
    const { queue } = await consumerChannel.assertQueue('', {
      exclusive: true,
      autoDelete: true,
    });
    queueName = queue;
    await consumerChannel.bindQueue(queueName, EXCHANGE, 'reminder.due');
  });

  afterAll(async () => {
    await consumerChannel?.close();
    await consumerConnection?.close();
    await relay.onModuleDestroy();
    await prisma.domainEvent.deleteMany({});
    await prisma.$disconnect();
  });

  it('publishes an outbox row to the real domain.events exchange under its routing key', async () => {
    const marker = `relay-test-${Date.now()}`;
    await outbox.record(prisma, 'reminder.due', { marker });

    await relay.relay();

    // The queue is bound to the exchange, so a real broker (not a mock)
    // routed this message on the 'reminder.due' key. Non-matching messages
    // (e.g. a concurrently running dev/CI relay's own real reminders) are
    // ack'd and skipped rather than failing the test.
    const message = await new Promise<amqp.ConsumeMessage>(
      (resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('timed out waiting for the relayed message'));
        }, 15000);

        void consumerChannel.consume(queueName, (msg) => {
          if (!msg) return;
          const envelope = JSON.parse(msg.content.toString()) as {
            marker?: string;
          };
          consumerChannel.ack(msg);
          if (envelope.marker !== marker) return;
          clearTimeout(timeout);
          resolve(msg);
        });
      },
    );

    expect(message.fields.routingKey).toBe('reminder.due');
    const envelope = JSON.parse(message.content.toString()) as {
      type: string;
      marker: string;
      schemaVersion: number;
      occurredAt: string;
    };
    expect(envelope.type).toBe('reminder.due');
    expect(envelope.marker).toBe(marker);
    expect(envelope.schemaVersion).toBe(1);
    expect(envelope.occurredAt).toEqual(expect.any(String));

    const row = await prisma.domainEvent.findFirst({
      where: {
        type: 'reminder.due',
        payload: { path: ['marker'], equals: marker },
      },
    });
    expect(row?.published).toBe(true);
  }, 20000);
});

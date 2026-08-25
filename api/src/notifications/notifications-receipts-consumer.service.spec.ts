import * as amqp from 'amqplib';
import { NotificationsReceiptsConsumerService } from './notifications-receipts-consumer.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('amqplib');

describe('NotificationsReceiptsConsumerService', () => {
  let service: NotificationsReceiptsConsumerService;
  let prisma: { reminder: { update: jest.Mock } };
  let channel: {
    assertQueue: jest.Mock;
    consume: jest.Mock;
    ack: jest.Mock;
    nack: jest.Mock;
    close: jest.Mock;
  };
  let connection: { createChannel: jest.Mock; close: jest.Mock };
  let onMessage: (msg: amqp.ConsumeMessage | null) => void;

  // The real callback is fire-and-forget (void-returning, per amqplib's
  // type), so tests must flush the microtask queue after invoking it before
  // asserting on the async work it kicked off.
  function flush(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve));
  }

  beforeEach(async () => {
    channel = {
      assertQueue: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn(
        (_queue: string, cb: (msg: amqp.ConsumeMessage | null) => void) => {
          onMessage = cb;
        },
      ),
      ack: jest.fn(),
      nack: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };
    connection = {
      createChannel: jest.fn().mockResolvedValue(channel),
      close: jest.fn().mockResolvedValue(undefined),
    };
    (amqp.connect as jest.Mock).mockResolvedValue(connection);

    prisma = { reminder: { update: jest.fn().mockResolvedValue(undefined) } };

    service = new NotificationsReceiptsConsumerService(
      prisma as unknown as PrismaService,
    );
    await service.onModuleInit();
  });

  function message(body: unknown): amqp.ConsumeMessage {
    return {
      content: Buffer.from(JSON.stringify(body)),
    } as amqp.ConsumeMessage;
  }

  it('declares the receipts queue as durable on startup', () => {
    expect(channel.assertQueue).toHaveBeenCalledWith(
      'notification-service.receipts',
      { durable: true },
    );
  });

  it('marks the reminder sent and acks on a well-formed receipt', async () => {
    onMessage(message({ reminderId: 'r1' }));
    await flush();

    expect(prisma.reminder.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { sentStatus: true },
    });
    expect(channel.ack).toHaveBeenCalled();
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('nacks without requeueing a malformed message instead of crashing the consumer', async () => {
    const badMessage = {
      content: Buffer.from('not json'),
    } as amqp.ConsumeMessage;

    onMessage(badMessage);
    await flush();

    expect(prisma.reminder.update).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(badMessage, false, false);
  });

  it('closes the channel and connection on shutdown', async () => {
    await service.onModuleDestroy();

    expect(channel.close).toHaveBeenCalled();
    expect(connection.close).toHaveBeenCalled();
  });
});

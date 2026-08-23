import * as amqp from 'amqplib';
import { OutboxRelayService } from './outbox-relay.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('amqplib');

describe('OutboxRelayService', () => {
  let service: OutboxRelayService;
  let prisma: {
    domainEvent: { findMany: jest.Mock; update: jest.Mock };
  };
  let channel: {
    assertExchange: jest.Mock;
    publish: jest.Mock;
    close: jest.Mock;
  };
  let connection: { createChannel: jest.Mock; close: jest.Mock };

  beforeEach(async () => {
    channel = {
      assertExchange: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };
    connection = {
      createChannel: jest.fn().mockResolvedValue(channel),
      close: jest.fn().mockResolvedValue(undefined),
    };
    (amqp.connect as jest.Mock).mockResolvedValue(connection);

    prisma = {
      domainEvent: {
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };

    service = new OutboxRelayService(prisma as unknown as PrismaService);
    await service.onModuleInit();
  });

  it('declares the domain.events topic exchange as durable on startup', () => {
    expect(channel.assertExchange).toHaveBeenCalledWith(
      'domain.events',
      'topic',
      {
        durable: true,
      },
    );
  });

  it('publishes each unpublished event and marks it published', async () => {
    const event = {
      id: 'evt-1',
      type: 'contact.created',
      payload: { contactId: 'c1' },
      published: false,
      createdAt: new Date('2026-08-22T00:00:00.000Z'),
    };
    prisma.domainEvent.findMany.mockResolvedValue([event]);

    await service.relay();

    expect(channel.publish).toHaveBeenCalledTimes(1);
    const [exchange, routingKey, buffer] = channel.publish.mock.calls[0] as [
      string,
      string,
      Buffer,
    ];
    expect(exchange).toBe('domain.events');
    expect(routingKey).toBe('contact.created');
    expect(JSON.parse(buffer.toString())).toEqual(
      expect.objectContaining({
        eventId: 'evt-1',
        type: 'contact.created',
        payload: { contactId: 'c1' },
        schemaVersion: 1,
      }),
    );

    expect(prisma.domainEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: { published: true },
    });
  });

  it('only fetches events that have not been published yet', async () => {
    prisma.domainEvent.findMany.mockResolvedValue([]);

    await service.relay();

    expect(prisma.domainEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { published: false } }),
    );
  });

  it('publishes multiple pending events in order and marks each one individually', async () => {
    const events = [
      {
        id: 'evt-1',
        type: 'contact.created',
        payload: {},
        published: false,
        createdAt: new Date(),
      },
      {
        id: 'evt-2',
        type: 'reminder.due',
        payload: {},
        published: false,
        createdAt: new Date(),
      },
    ];
    prisma.domainEvent.findMany.mockResolvedValue(events);

    await service.relay();

    expect(channel.publish).toHaveBeenCalledTimes(2);
    expect(prisma.domainEvent.update).toHaveBeenCalledTimes(2);
    expect(prisma.domainEvent.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'evt-1' },
      data: { published: true },
    });
    expect(prisma.domainEvent.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'evt-2' },
      data: { published: true },
    });
  });

  it('closes the channel and connection on shutdown', async () => {
    await service.onModuleDestroy();

    expect(channel.close).toHaveBeenCalled();
    expect(connection.close).toHaveBeenCalled();
  });
});

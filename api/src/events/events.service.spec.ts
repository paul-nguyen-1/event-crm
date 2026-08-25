import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventsService } from './events.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventType } from '../../generated/prisma/enums';

describe('EventsService', () => {
  let service: EventsService;
  let prisma: {
    event: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    contact: { findUnique: jest.Mock };
  };

  const contact = { id: 'contact-1', userId: 'user-1' };
  const event = { id: 'event-1', contactId: contact.id, contact };

  beforeEach(async () => {
    prisma = {
      event: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      contact: { findUnique: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [EventsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(EventsService);
  });

  describe('findOneForUser', () => {
    it('throws NotFoundException when the event does not exist', async () => {
      prisma.event.findUnique.mockResolvedValue(null);

      await expect(service.findOneForUser('missing', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ForbiddenException when the event's contact belongs to another user", async () => {
      prisma.event.findUnique.mockResolvedValue(event);

      await expect(
        service.findOneForUser(event.id, 'someone-else'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns the event when its contact belongs to the requesting user', async () => {
      prisma.event.findUnique.mockResolvedValue(event);

      await expect(
        service.findOneForUser(event.id, contact.userId),
      ).resolves.toEqual(event);
    });
  });

  describe('create', () => {
    it('rejects creating an event on a contact owned by another user', async () => {
      prisma.contact.findUnique.mockResolvedValue(contact);

      await expect(
        service.create('someone-else', {
          contactId: contact.id,
          type: EventType.BIRTHDAY,
          date: '2026-08-25',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    it('rejects creating an event on a contact that does not exist', async () => {
      prisma.contact.findUnique.mockResolvedValue(null);

      await expect(
        service.create('user-1', {
          contactId: 'missing',
          type: EventType.BIRTHDAY,
          date: '2026-08-25',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates the event when the contact belongs to the requesting user', async () => {
      prisma.contact.findUnique.mockResolvedValue(contact);
      prisma.event.create.mockResolvedValue(event);

      const result = await service.create('user-1', {
        contactId: contact.id,
        type: EventType.BIRTHDAY,
        date: '2026-08-25',
      });

      expect(prisma.event.create).toHaveBeenCalled();
      expect(result).toEqual(event);
    });
  });

  describe('update', () => {
    it('rejects updating an event owned by another user', async () => {
      prisma.event.findUnique.mockResolvedValue(event);

      await expect(
        service.update(event.id, 'someone-else', { recurrenceRule: 'YEARLY' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.event.update).not.toHaveBeenCalled();
    });

    it('converts a provided date string into a Date when updating', async () => {
      prisma.event.findUnique.mockResolvedValue(event);
      prisma.event.update.mockResolvedValue(event);

      await service.update(event.id, contact.userId, { date: '2027-01-15' });

      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: event.id },
        data: { date: new Date('2027-01-15') },
      });
    });

    it('leaves the date untouched when not provided in the update', async () => {
      prisma.event.findUnique.mockResolvedValue(event);
      prisma.event.update.mockResolvedValue(event);

      await service.update(event.id, contact.userId, {
        recurrenceRule: 'YEARLY',
      });

      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: event.id },
        data: { recurrenceRule: 'YEARLY', date: undefined },
      });
    });
  });

  describe('findUpcomingForUser', () => {
    it("sorts events across all of the user's contacts by next-occurrence proximity", async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-22T00:00:00.000Z'));

      const soon = {
        id: 'e-soon',
        date: new Date('2026-08-25T00:00:00.000Z'),
        recurrenceRule: null,
        contact: { id: 'c1' },
      };
      const later = {
        id: 'e-later',
        date: new Date('2026-12-25T00:00:00.000Z'),
        recurrenceRule: 'YEARLY',
        contact: { id: 'c2' },
      };
      prisma.event.findMany.mockResolvedValue([later, soon]);

      const result = await service.findUpcomingForUser('user-1');

      expect(prisma.event.findMany).toHaveBeenCalledWith({
        where: { contact: { userId: 'user-1' } },
        include: { contact: true },
      });
      expect(result.map((e) => e.id)).toEqual(['e-soon', 'e-later']);

      jest.useRealTimers();
    });
  });

  describe('remove', () => {
    it('rejects deleting an event owned by another user', async () => {
      prisma.event.findUnique.mockResolvedValue(event);

      await expect(service.remove(event.id, 'someone-else')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.event.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when deleting an event that does not exist', async () => {
      prisma.event.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes the event when its contact belongs to the requesting user', async () => {
      prisma.event.findUnique.mockResolvedValue(event);

      await service.remove(event.id, contact.userId);

      expect(prisma.event.delete).toHaveBeenCalledWith({
        where: { id: event.id },
      });
    });
  });
});

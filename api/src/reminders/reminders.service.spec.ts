import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReminderChannel } from '../../generated/prisma/enums';

describe('RemindersService', () => {
  let service: RemindersService;
  let prisma: {
    event: { findUnique: jest.Mock };
    reminder: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
  };

  const contact = { id: 'contact-1', userId: 'user-1' };
  const event = { id: 'event-1', contact };
  const reminder = { id: 'reminder-1', eventId: event.id, event };

  beforeEach(async () => {
    prisma = {
      event: { findUnique: jest.fn() },
      reminder: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemindersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(RemindersService);
  });

  describe('create', () => {
    it('rejects when the event does not exist', async () => {
      prisma.event.findUnique.mockResolvedValue(null);

      await expect(
        service.create('user-1', {
          eventId: 'missing',
          leadTimeDays: 5,
          channel: ReminderChannel.EMAIL,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("rejects when the event's contact belongs to another user", async () => {
      prisma.event.findUnique.mockResolvedValue(event);

      await expect(
        service.create('someone-else', {
          eventId: event.id,
          leadTimeDays: 5,
          channel: ReminderChannel.EMAIL,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.reminder.create).not.toHaveBeenCalled();
    });

    it('creates the reminder when the event belongs to the requesting user', async () => {
      prisma.event.findUnique.mockResolvedValue(event);
      prisma.reminder.create.mockResolvedValue(reminder);

      const result = await service.create('user-1', {
        eventId: event.id,
        leadTimeDays: 5,
        channel: ReminderChannel.EMAIL,
      });

      expect(prisma.reminder.create).toHaveBeenCalled();
      expect(result).toEqual(reminder);
    });
  });

  describe('remove', () => {
    it('rejects deleting a reminder owned by another user', async () => {
      prisma.reminder.findUnique.mockResolvedValue(reminder);

      await expect(service.remove(reminder.id, 'someone-else')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.reminder.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the reminder does not exist', async () => {
      prisma.reminder.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes the reminder when its event belongs to the requesting user', async () => {
      prisma.reminder.findUnique.mockResolvedValue(reminder);

      await service.remove(reminder.id, contact.userId);

      expect(prisma.reminder.delete).toHaveBeenCalledWith({
        where: { id: reminder.id },
      });
    });
  });
});

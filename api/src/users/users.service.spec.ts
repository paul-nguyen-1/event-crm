import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(UsersService);
  });

  describe('getProfile', () => {
    it('throws NotFoundException when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('never selects passwordHash or refreshTokenHash', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

      await service.getProfile('user-1');

      const [call] = prisma.user.findUnique.mock.calls[0] as [
        { select: Record<string, boolean> },
      ];
      expect(call.select.passwordHash).toBeUndefined();
      expect(call.select.refreshTokenHash).toBeUndefined();
      expect(call.select.quietHoursStartHour).toBe(true);
      expect(call.select.timezone).toBe(true);
    });
  });

  describe('updatePreferences', () => {
    it('writes only the given preference fields, scoped to the requesting user', async () => {
      prisma.user.update.mockResolvedValue({ id: 'user-1' });

      await service.updatePreferences('user-1', {
        quietHoursStartHour: 22,
        quietHoursEndHour: 7,
        timezone: 'America/New_York',
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: {
            quietHoursStartHour: 22,
            quietHoursEndHour: 7,
            timezone: 'America/New_York',
          },
        }),
      );
    });

    it('allows explicitly clearing quiet hours with null', async () => {
      prisma.user.update.mockResolvedValue({ id: 'user-1' });

      await service.updatePreferences('user-1', {
        quietHoursStartHour: null,
        quietHoursEndHour: null,
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { quietHoursStartHour: null, quietHoursEndHour: null },
        }),
      );
    });
  });
});

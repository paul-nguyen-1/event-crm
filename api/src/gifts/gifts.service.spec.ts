import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GiftsService } from './gifts.service';
import { PrismaService } from '../prisma/prisma.service';

describe('GiftsService', () => {
  let service: GiftsService;
  let prisma: {
    contact: { findUnique: jest.Mock };
    gift: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
  };

  const contact = { id: 'contact-1', userId: 'user-1' };
  const gift = { id: 'gift-1', contactId: contact.id, contact };

  beforeEach(async () => {
    prisma = {
      contact: { findUnique: jest.fn() },
      gift: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [GiftsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(GiftsService);
  });

  describe('create', () => {
    it('rejects when the contact does not exist', async () => {
      prisma.contact.findUnique.mockResolvedValue(null);

      await expect(
        service.create('user-1', {
          contactId: 'missing',
          occasion: 'Birthday',
          giftDate: '2024-08-24',
          description: 'Candle set',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when the contact belongs to another user', async () => {
      prisma.contact.findUnique.mockResolvedValue(contact);

      await expect(
        service.create('someone-else', {
          contactId: contact.id,
          occasion: 'Birthday',
          giftDate: '2024-08-24',
          description: 'Candle set',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.gift.create).not.toHaveBeenCalled();
    });

    it('creates the gift when the contact belongs to the requesting user', async () => {
      prisma.contact.findUnique.mockResolvedValue(contact);
      prisma.gift.create.mockResolvedValue(gift);

      const result = await service.create('user-1', {
        contactId: contact.id,
        occasion: 'Birthday',
        giftDate: '2024-08-24',
        description: 'Candle set',
        costCents: 4200,
      });

      expect(prisma.gift.create).toHaveBeenCalled();
      expect(result).toEqual(gift);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the gift does not exist', async () => {
      prisma.gift.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects deleting a gift owned by another user', async () => {
      prisma.gift.findUnique.mockResolvedValue(gift);

      await expect(service.remove(gift.id, 'someone-else')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.gift.delete).not.toHaveBeenCalled();
    });

    it('deletes the gift when it belongs to the requesting user', async () => {
      prisma.gift.findUnique.mockResolvedValue(gift);

      await service.remove(gift.id, contact.userId);

      expect(prisma.gift.delete).toHaveBeenCalledWith({
        where: { id: gift.id },
      });
    });
  });
});

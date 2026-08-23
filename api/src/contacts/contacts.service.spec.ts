import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';

describe('ContactsService', () => {
  let service: ContactsService;
  let prisma: {
    contact: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let outbox: jest.Mocked<OutboxService>;

  const contact = { id: 'contact-1', userId: 'user-1', name: 'Sarah' };

  beforeEach(async () => {
    prisma = {
      contact: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) =>
        cb({ contact: { create: prisma.contact.create } }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactsService,
        { provide: PrismaService, useValue: prisma },
        { provide: OutboxService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = module.get(ContactsService);
    outbox = module.get(OutboxService);
  });

  describe('findOneForUser', () => {
    it('throws NotFoundException when the contact does not exist', async () => {
      prisma.contact.findUnique.mockResolvedValue(null);

      await expect(service.findOneForUser('missing', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when the contact belongs to another user', async () => {
      prisma.contact.findUnique.mockResolvedValue(contact);

      await expect(
        service.findOneForUser(contact.id, 'someone-else'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns the contact when it belongs to the requesting user', async () => {
      prisma.contact.findUnique.mockResolvedValue(contact);

      await expect(
        service.findOneForUser(contact.id, contact.userId),
      ).resolves.toEqual(contact);
    });
  });

  describe('create', () => {
    it('creates the contact and records an outbox event in the same transaction', async () => {
      prisma.contact.create.mockResolvedValue(contact);

      const result = await service.create('user-1', { name: 'Sarah' });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(outbox.record).toHaveBeenCalledWith(
        expect.anything(),
        'contact.created',
        expect.objectContaining({ contactId: contact.id, userId: 'user-1' }),
      );
      expect(result).toEqual(contact);
    });
  });

  describe('update', () => {
    it('rejects updating a contact owned by another user', async () => {
      prisma.contact.findUnique.mockResolvedValue(contact);

      await expect(
        service.update(contact.id, 'someone-else', { notes: 'hacked' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.contact.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when updating a contact that does not exist', async () => {
      prisma.contact.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing', 'user-1', { notes: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates the contact when it belongs to the requesting user', async () => {
      prisma.contact.findUnique.mockResolvedValue(contact);
      prisma.contact.update.mockResolvedValue({
        ...contact,
        notes: 'loves plants',
      });

      const result = await service.update(contact.id, contact.userId, {
        notes: 'loves plants',
      });

      expect(prisma.contact.update).toHaveBeenCalledWith({
        where: { id: contact.id },
        data: { notes: 'loves plants' },
      });
      expect(result).toEqual({ ...contact, notes: 'loves plants' });
    });
  });

  describe('remove', () => {
    it('rejects deleting a contact owned by another user', async () => {
      prisma.contact.findUnique.mockResolvedValue(contact);

      await expect(service.remove(contact.id, 'someone-else')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.contact.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when deleting a contact that does not exist', async () => {
      prisma.contact.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes the contact when it belongs to the requesting user', async () => {
      prisma.contact.findUnique.mockResolvedValue(contact);

      await service.remove(contact.id, contact.userId);

      expect(prisma.contact.delete).toHaveBeenCalledWith({
        where: { id: contact.id },
      });
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { GiftIdeasService } from './gift-ideas.service';
import { PrismaService } from '../prisma/prisma.service';
import { resolveProductImage } from '../links/resolve-product-image';

jest.mock('../links/resolve-product-image');
const mockResolveProductImage = resolveProductImage as jest.Mock;

describe('GiftIdeasService', () => {
  let service: GiftIdeasService;
  let prisma: {
    contact: { findUnique: jest.Mock };
    product: { upsert: jest.Mock };
    savedGift: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      upsert: jest.Mock;
      delete: jest.Mock;
    };
  };

  const contact = { id: 'contact-1', userId: 'user-1' };
  const product = {
    id: 'product-1',
    name: 'Grinder',
    externalId: 'B0EXAMPLE1',
  };
  const savedGift = {
    id: 'saved-1',
    contactId: contact.id,
    contact,
    productId: product.id,
  };

  beforeEach(async () => {
    prisma = {
      contact: { findUnique: jest.fn() },
      product: { upsert: jest.fn() },
      savedGift: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
    };
    mockResolveProductImage.mockReset().mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GiftIdeasService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(GiftIdeasService);
  });

  describe('create', () => {
    const dto = {
      contactId: contact.id,
      url: 'https://www.amazon.com/dp/B0EXAMPLE1',
      name: 'Grinder',
      basePrice: 49,
    };

    it('rejects when the contact does not exist', async () => {
      prisma.contact.findUnique.mockResolvedValue(null);

      await expect(service.create('user-1', dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.product.upsert).not.toHaveBeenCalled();
    });

    it('rejects when the contact belongs to another user', async () => {
      prisma.contact.findUnique.mockResolvedValue(contact);

      await expect(service.create('someone-else', dto)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.product.upsert).not.toHaveBeenCalled();
    });

    it('rejects a URL with no extractable ASIN, without touching the database', async () => {
      prisma.contact.findUnique.mockResolvedValue(contact);

      await expect(
        service.create('user-1', {
          ...dto,
          url: 'https://www.amazon.com/s?k=grinder',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.product.upsert).not.toHaveBeenCalled();
    });

    it('upserts the product by ASIN and links it to the contact via a saved gift', async () => {
      prisma.contact.findUnique.mockResolvedValue(contact);
      prisma.product.upsert.mockResolvedValue(product);
      prisma.savedGift.upsert.mockResolvedValue(savedGift);

      const result = await service.create('user-1', dto);

      expect(prisma.product.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            network_externalId: { network: 'AMAZON', externalId: 'B0EXAMPLE1' },
          },
        }),
      );
      const [upsertArgs] = prisma.product.upsert.mock.calls[0] as [
        { create: { externalId: string; name: string } },
      ];
      expect(upsertArgs.create.externalId).toBe('B0EXAMPLE1');
      expect(upsertArgs.create.name).toBe('Grinder');
      expect(prisma.savedGift.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            contactId_productId: {
              contactId: contact.id,
              productId: product.id,
            },
          },
        }),
      );
      expect(result).toEqual(savedGift);
    });

    it('reuses an existing product for the same ASIN rather than overwriting its fields', async () => {
      prisma.contact.findUnique.mockResolvedValue(contact);
      prisma.product.upsert.mockResolvedValue(product);
      prisma.savedGift.upsert.mockResolvedValue(savedGift);

      await service.create('user-1', dto);

      expect(prisma.product.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: {} }),
      );
    });

    it("resolves a real image from the ASIN when the user didn't supply one", async () => {
      prisma.contact.findUnique.mockResolvedValue(contact);
      prisma.product.upsert.mockResolvedValue(product);
      prisma.savedGift.upsert.mockResolvedValue(savedGift);
      mockResolveProductImage.mockResolvedValue(
        'https://m.media-amazon.com/images/P/B0EXAMPLE1.01._SCLZZZZZZZ_.jpg',
      );

      await service.create('user-1', dto);

      expect(mockResolveProductImage).toHaveBeenCalledWith('B0EXAMPLE1');
      const [upsertArgs] = prisma.product.upsert.mock.calls[0] as [
        { create: { imageUrl: string | null } },
      ];
      expect(upsertArgs.create.imageUrl).toBe(
        'https://m.media-amazon.com/images/P/B0EXAMPLE1.01._SCLZZZZZZZ_.jpg',
      );
    });

    it("prefers the user's supplied image over the auto-resolved one", async () => {
      prisma.contact.findUnique.mockResolvedValue(contact);
      prisma.product.upsert.mockResolvedValue(product);
      prisma.savedGift.upsert.mockResolvedValue(savedGift);
      mockResolveProductImage.mockResolvedValue('https://example.com/auto.jpg');

      await service.create('user-1', {
        ...dto,
        imageUrl: 'https://example.com/manual.jpg',
      });

      expect(mockResolveProductImage).not.toHaveBeenCalled();
      const [upsertArgs] = prisma.product.upsert.mock.calls[0] as [
        { create: { imageUrl: string | null } },
      ];
      expect(upsertArgs.create.imageUrl).toBe('https://example.com/manual.jpg');
    });
  });

  describe('findAllForContact', () => {
    it('rejects when the contact belongs to another user', async () => {
      prisma.contact.findUnique.mockResolvedValue(contact);

      await expect(
        service.findAllForContact(contact.id, 'someone-else'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lists saved gifts for the contact', async () => {
      prisma.contact.findUnique.mockResolvedValue(contact);
      prisma.savedGift.findMany.mockResolvedValue([savedGift]);

      const result = await service.findAllForContact(contact.id, 'user-1');

      expect(result).toEqual([savedGift]);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the saved gift does not exist', async () => {
      prisma.savedGift.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects removing a saved gift owned by another user', async () => {
      prisma.savedGift.findUnique.mockResolvedValue(savedGift);

      await expect(
        service.remove(savedGift.id, 'someone-else'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.savedGift.delete).not.toHaveBeenCalled();
    });

    it('deletes the saved gift when it belongs to the requesting user', async () => {
      prisma.savedGift.findUnique.mockResolvedValue(savedGift);

      await service.remove(savedGift.id, contact.userId);

      expect(prisma.savedGift.delete).toHaveBeenCalledWith({
        where: { id: savedGift.id },
      });
    });
  });
});

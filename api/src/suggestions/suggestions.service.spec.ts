import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SuggestionsService } from './suggestions.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SuggestionsService.getForContact', () => {
  let service: SuggestionsService;
  let prisma: {
    contact: { findUnique: jest.Mock };
    product: { findMany: jest.Mock };
  };

  function product(name: string, tags: string[]) {
    return { id: name, name, tags, imageUrl: null, basePrice: '10.00' };
  }

  beforeEach(async () => {
    prisma = {
      contact: { findUnique: jest.fn() },
      product: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuggestionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(SuggestionsService);
  });

  it('throws NotFoundException when the contact does not exist', async () => {
    prisma.contact.findUnique.mockResolvedValue(null);

    await expect(service.getForContact('missing', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws ForbiddenException when the contact belongs to another user', async () => {
    prisma.contact.findUnique.mockResolvedValue({
      id: 'c1',
      userId: 'user-1',
      interests: [],
    });

    await expect(service.getForContact('c1', 'someone-else')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('matches products against contact.interests and ranks by tag-overlap count, descending', async () => {
    prisma.contact.findUnique.mockResolvedValue({
      id: 'c1',
      userId: 'user-1',
      interests: ['cooking', 'wine'],
    });
    const singleMatch = product('Wine Opener', ['wine']);
    const doubleMatch = product('Cooking & Wine Combo', ['cooking', 'wine']);
    prisma.product.findMany.mockResolvedValue([singleMatch, doubleMatch]);

    const result = await service.getForContact('c1', 'user-1');

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { tags: { hasSome: ['cooking', 'wine'] } },
    });
    expect(result.map((p) => p.id)).toEqual([doubleMatch.id, singleMatch.id]);
  });

  it('breaks ties in overlap count alphabetically by product name for stable ordering', async () => {
    prisma.contact.findUnique.mockResolvedValue({
      id: 'c1',
      userId: 'user-1',
      interests: ['cooking'],
    });
    const zed = product('Zed Cooking Thing', ['cooking']);
    const alpha = product('Alpha Cooking Thing', ['cooking']);
    prisma.product.findMany.mockResolvedValue([zed, alpha]);

    const result = await service.getForContact('c1', 'user-1');

    expect(result.map((p) => p.id)).toEqual([alpha.id, zed.id]);
  });

  it('falls back to a broadly-appealing product set when the contact has no interests, instead of an empty panel', async () => {
    prisma.contact.findUnique.mockResolvedValue({
      id: 'c1',
      userId: 'user-1',
      interests: [],
    });
    const fallbackProduct = product('Fallback Gadget', ['tech']);
    prisma.product.findMany.mockResolvedValue([fallbackProduct]);

    const result = await service.getForContact('c1', 'user-1');

    expect(prisma.product.findMany).toHaveBeenCalledTimes(1);
    const [{ where }] = prisma.product.findMany.mock.calls[0] as [
      { where: { tags: { hasSome: string[] } } },
    ];
    expect(Array.isArray(where.tags.hasSome)).toBe(true);
    expect(where.tags.hasSome.length).toBeGreaterThan(0);
    expect(result).toEqual([fallbackProduct]);
  });
});

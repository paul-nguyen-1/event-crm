import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LinksService } from './links.service';
import { PrismaService } from '../prisma/prisma.service';
import { AffiliateLinkService } from './affiliate-link.service';

describe('LinksService.findProduct', () => {
  let service: LinksService;
  let prisma: { product: { findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = { product: { findUnique: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinksService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: AffiliateLinkService,
          useValue: { resolveAffiliateLink: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(LinksService);
  });

  it('throws NotFoundException for an unknown product', async () => {
    prisma.product.findUnique.mockResolvedValue(null);

    await expect(service.findProduct('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns the product when found', async () => {
    const product = { id: 'product-1', name: 'Candle set' };
    prisma.product.findUnique.mockResolvedValue(product);

    await expect(service.findProduct('product-1')).resolves.toEqual(product);
  });
});

describe('LinksService.clickAndResolve', () => {
  let service: LinksService;
  let prisma: {
    product: { findUnique: jest.Mock };
    linkClick: { create: jest.Mock };
  };
  let affiliateLink: jest.Mocked<AffiliateLinkService>;

  const product = {
    id: 'product-1',
    externalId: 'B0EXAMPLE001',
    network: 'AMAZON',
  };

  beforeEach(async () => {
    prisma = {
      product: { findUnique: jest.fn() },
      linkClick: { create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinksService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: AffiliateLinkService,
          useValue: { resolveAffiliateLink: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(LinksService);
    affiliateLink = module.get(AffiliateLinkService);
  });

  it('throws NotFoundException for an unknown product', async () => {
    prisma.product.findUnique.mockResolvedValue(null);

    await expect(service.clickAndResolve('user-1', 'missing')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.linkClick.create).not.toHaveBeenCalled();
  });

  it('logs the click before returning the resolved URL, and always produces exactly one LinkClick row', async () => {
    prisma.product.findUnique.mockResolvedValue(product);
    affiliateLink.resolveAffiliateLink.mockReturnValue(
      'https://www.amazon.com/dp/B0EXAMPLE001?tag=mytag-20',
    );
    const callOrder: string[] = [];
    prisma.linkClick.create.mockImplementation(() => {
      callOrder.push('logged');
      return Promise.resolve({});
    });

    const result = await service.clickAndResolve(
      'user-1',
      'product-1',
      'contact-1',
    );
    callOrder.push('returned');

    expect(prisma.linkClick.create).toHaveBeenCalledTimes(1);
    expect(prisma.linkClick.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        productId: 'product-1',
        contactId: 'contact-1',
        network: 'AMAZON',
      },
    });
    expect(callOrder).toEqual(['logged', 'returned']);
    expect(result).toEqual({
      url: 'https://www.amazon.com/dp/B0EXAMPLE001?tag=mytag-20',
    });
  });

  it('records a null contactId when the click has no contact context', async () => {
    prisma.product.findUnique.mockResolvedValue(product);
    affiliateLink.resolveAffiliateLink.mockReturnValue('https://example.com');

    await service.clickAndResolve('user-1', 'product-1');

    expect(prisma.linkClick.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        productId: 'product-1',
        contactId: null,
        network: 'AMAZON',
      },
    });
  });

  it("resolves the affiliate link using the product's own network", async () => {
    prisma.product.findUnique.mockResolvedValue(product);
    affiliateLink.resolveAffiliateLink.mockReturnValue('https://example.com');

    await service.clickAndResolve('user-1', 'product-1');

    expect(affiliateLink.resolveAffiliateLink).toHaveBeenCalledWith(
      product,
      'AMAZON',
    );
  });
});

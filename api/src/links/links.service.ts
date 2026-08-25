import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AffiliateLinkService } from './affiliate-link.service';

@Injectable()
export class LinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly affiliateLink: AffiliateLinkService,
  ) {}

  async clickAndResolve(
    userId: string,
    productId: string,
    contactId?: string,
  ): Promise<{ url: string }> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    const url = this.affiliateLink.resolveAffiliateLink(
      product,
      product.network,
    );

    // Logged before returning the URL — never a fire-and-forget beacon that
    // can be dropped if the client never follows through.
    await this.prisma.linkClick.create({
      data: {
        userId,
        productId,
        contactId: contactId ?? null,
        network: product.network,
      },
    });

    return { url };
  }
}

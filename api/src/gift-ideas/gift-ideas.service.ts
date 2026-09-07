import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { extractAsin } from '../links/extract-asin';
import { resolveProductImage } from '../links/resolve-product-image';
import { Network } from '../../generated/prisma/enums';
import { CreateGiftIdeaDto } from './dto/create-gift-idea.dto';

@Injectable()
export class GiftIdeasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForContact(contactId: string, userId: string) {
    await this.assertOwnsContact(contactId, userId);
    return this.prisma.savedGift.findMany({
      where: { contactId },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateGiftIdeaDto) {
    await this.assertOwnsContact(dto.contactId, userId);

    const asin = extractAsin(dto.url);
    if (!asin) {
      throw new BadRequestException(
        "Couldn't find a product ID in that Amazon link.",
      );
    }

    // An existing catalog/previously-saved item is reused as-is (not
    // overwritten) — one user's manually-typed price/name shouldn't clobber
    // a product other contacts already reference.
    const imageUrl = dto.imageUrl ?? (await resolveProductImage(asin));
    const product = await this.prisma.product.upsert({
      where: {
        network_externalId: { network: Network.AMAZON, externalId: asin },
      },
      update: {},
      create: {
        name: dto.name,
        basePrice: dto.basePrice,
        imageUrl,
        network: Network.AMAZON,
        externalId: asin,
        tags: [],
      },
    });

    return this.prisma.savedGift.upsert({
      where: {
        contactId_productId: {
          contactId: dto.contactId,
          productId: product.id,
        },
      },
      update: {},
      create: { contactId: dto.contactId, productId: product.id },
      include: { product: true },
    });
  }

  async remove(id: string, userId: string) {
    const savedGift = await this.prisma.savedGift.findUnique({
      where: { id },
      include: { contact: true },
    });
    if (!savedGift) throw new NotFoundException('Gift idea not found');
    if (savedGift.contact.userId !== userId) throw new ForbiddenException();
    await this.prisma.savedGift.delete({ where: { id } });
  }

  private async assertOwnsContact(contactId: string, userId: string) {
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    if (contact.userId !== userId) throw new ForbiddenException();
  }
}

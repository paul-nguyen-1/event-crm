import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Shown when a contact has no interests configured yet, so the panel is
// never empty — a small, broadly-appealing default rather than nothing.
const FALLBACK_TAGS = ['tech', 'home', 'reading'];
const FALLBACK_LIMIT = 10;

@Injectable()
export class SuggestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getForContact(contactId: string, userId: string) {
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    if (contact.userId !== userId) throw new ForbiddenException();

    // Gifts the user explicitly picked (via an Amazon link) for this contact
    // always lead — they're a stronger signal than a tag-overlap guess.
    const saved = await this.prisma.savedGift.findMany({
      where: { contactId },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
    const savedProducts = saved.map((s) => s.product);
    const savedIds = new Set(savedProducts.map((p) => p.id));

    if (contact.interests.length === 0) {
      const fallback = await this.prisma.product.findMany({
        where: { tags: { hasSome: FALLBACK_TAGS } },
        take: FALLBACK_LIMIT,
      });
      return [...savedProducts, ...fallback.filter((p) => !savedIds.has(p.id))];
    }

    const candidates = await this.prisma.product.findMany({
      where: { tags: { hasSome: contact.interests } },
    });

    const ranked = candidates
      .filter((p) => !savedIds.has(p.id))
      .map((product) => ({
        product,
        overlap: product.tags.filter((tag) => contact.interests.includes(tag))
          .length,
      }))
      .sort(
        (a, b) =>
          b.overlap - a.overlap || a.product.name.localeCompare(b.product.name),
      )
      .map(({ product }) => product);

    return [...savedProducts, ...ranked];
  }
}

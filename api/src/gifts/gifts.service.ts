import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGiftDto } from './dto/create-gift.dto';
import { UpdateGiftDto } from './dto/update-gift.dto';

@Injectable()
export class GiftsService {
  constructor(private readonly prisma: PrismaService) {}

  /** All gifts across the user's contacts, or scoped to one contact if given. */
  findAllForUser(userId: string, contactId?: string) {
    return this.prisma.gift.findMany({
      where: { contact: { userId }, ...(contactId ? { contactId } : {}) },
      orderBy: { giftDate: 'desc' },
    });
  }

  async create(userId: string, dto: CreateGiftDto) {
    const contact = await this.prisma.contact.findUnique({
      where: { id: dto.contactId },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    if (contact.userId !== userId) throw new ForbiddenException();

    return this.prisma.gift.create({
      data: {
        contactId: dto.contactId,
        occasion: dto.occasion,
        giftDate: new Date(dto.giftDate),
        description: dto.description,
        costCents: dto.costCents,
        status: dto.status,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateGiftDto) {
    await this.findOwned(id, userId);
    return this.prisma.gift.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOwned(id, userId);
    await this.prisma.gift.delete({ where: { id } });
  }

  private async findOwned(id: string, userId: string) {
    const gift = await this.prisma.gift.findUnique({
      where: { id },
      include: { contact: true },
    });
    if (!gift) throw new NotFoundException('Gift not found');
    if (gift.contact.userId !== userId) throw new ForbiddenException();
    return gift;
  }
}

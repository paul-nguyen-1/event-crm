import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  findAllForUser(userId: string) {
    return this.prisma.contact.findMany({ where: { userId } });
  }

  async findOneForUser(id: string, userId: string) {
    const contact = await this.prisma.contact.findUnique({ where: { id } });
    if (!contact) throw new NotFoundException('Contact not found');
    if (contact.userId !== userId) throw new ForbiddenException();
    return contact;
  }

  async create(userId: string, dto: CreateContactDto) {
    return this.prisma.$transaction(async (tx) => {
      const contact = await tx.contact.create({
        data: { ...dto, userId },
      });
      await this.outbox.record(tx, 'contact.created', {
        contactId: contact.id,
        userId,
      });
      return contact;
    });
  }

  async update(id: string, userId: string, dto: UpdateContactDto) {
    await this.findOneForUser(id, userId);
    return this.prisma.contact.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string) {
    await this.findOneForUser(id, userId);
    await this.prisma.contact.delete({ where: { id } });
  }
}

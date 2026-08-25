import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { nextOccurrence } from '../reminders/reminders-job.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  findAllForContact(contactId: string, userId: string) {
    return this.prisma.event.findMany({
      where: { contactId, contact: { userId } },
    });
  }

  /** Every event across the user's contacts, sorted by next-occurrence proximity. */
  async findUpcomingForUser(userId: string) {
    const events = await this.prisma.event.findMany({
      where: { contact: { userId } },
      include: { contact: true, reminders: true },
    });

    const now = new Date();
    return events
      .map((event) => ({
        ...event,
        nextOccurrence: nextOccurrence(event.date, event.recurrenceRule, now),
      }))
      .sort((a, b) => a.nextOccurrence.getTime() - b.nextOccurrence.getTime());
  }

  async findOneForUser(id: string, userId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: { contact: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    if (event.contact.userId !== userId) throw new ForbiddenException();
    return event;
  }

  async create(userId: string, dto: CreateEventDto) {
    const contact = await this.prisma.contact.findUnique({
      where: { id: dto.contactId },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    if (contact.userId !== userId) throw new ForbiddenException();

    return this.prisma.event.create({
      data: {
        contactId: dto.contactId,
        type: dto.type,
        date: new Date(dto.date),
        recurrenceRule: dto.recurrenceRule,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateEventDto) {
    await this.findOneForUser(id, userId);
    return this.prisma.event.update({
      where: { id },
      data: {
        ...dto,
        date: dto.date ? new Date(dto.date) : undefined,
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOneForUser(id, userId);
    await this.prisma.event.delete({ where: { id } });
  }
}

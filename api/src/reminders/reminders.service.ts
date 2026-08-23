import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReminderDto } from './dto/create-reminder.dto';

@Injectable()
export class RemindersService {
  constructor(private readonly prisma: PrismaService) {}

  findAllForEvent(eventId: string, userId: string) {
    return this.prisma.reminder.findMany({
      where: { eventId, event: { contact: { userId } } },
    });
  }

  async create(userId: string, dto: CreateReminderDto) {
    const event = await this.prisma.event.findUnique({
      where: { id: dto.eventId },
      include: { contact: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    if (event.contact.userId !== userId) throw new ForbiddenException();

    return this.prisma.reminder.create({
      data: {
        eventId: dto.eventId,
        leadTimeDays: dto.leadTimeDays,
        channel: dto.channel,
      },
    });
  }

  async remove(id: string, userId: string) {
    const reminder = await this.prisma.reminder.findUnique({
      where: { id },
      include: { event: { include: { contact: true } } },
    });
    if (!reminder) throw new NotFoundException('Reminder not found');
    if (reminder.event.contact.userId !== userId)
      throw new ForbiddenException();
    await this.prisma.reminder.delete({ where: { id } });
  }
}

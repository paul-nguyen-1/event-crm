import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReminderDto } from './dto/create-reminder.dto';

const UNSUBSCRIBE_PURPOSE = 'reminder-unsubscribe';
const UNSUBSCRIBE_TOKEN_TTL = '60d';

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Signs a one-click, no-login-required token for the reminder email's unsubscribe link. */
  signUnsubscribeToken(reminderId: string): Promise<string> {
    return this.jwt.signAsync(
      { reminderId, purpose: UNSUBSCRIBE_PURPOSE },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: UNSUBSCRIBE_TOKEN_TTL,
      },
    );
  }

  /** Idempotent: a repeat click (or an email-scanner prefetch) on an already-unsubscribed link is a no-op, not an error. */
  async unsubscribeByToken(token: string): Promise<void> {
    let payload: { reminderId: string; purpose: string };
    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new BadRequestException('Invalid or expired link');
    }
    if (payload.purpose !== UNSUBSCRIBE_PURPOSE) {
      throw new BadRequestException('Invalid link');
    }
    await this.prisma.reminder.deleteMany({
      where: { id: payload.reminderId },
    });
  }

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

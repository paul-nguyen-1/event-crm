import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

const PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  tier: true,
  quietHoursStartHour: true,
  quietHoursEndHour: true,
  timezone: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByGoogleId(googleId: string) {
    return this.prisma.user.findUnique({ where: { googleId } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  createWithPassword(email: string, passwordHash: string, name?: string) {
    return this.prisma.user.create({
      data: { email, passwordHash, name },
    });
  }

  createWithGoogle(email: string, googleId: string, name?: string) {
    return this.prisma.user.create({
      data: { email, googleId, name },
    });
  }

  setRefreshTokenHash(userId: string, refreshTokenHash: string | null) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PROFILE_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: PROFILE_SELECT,
    });
  }
}

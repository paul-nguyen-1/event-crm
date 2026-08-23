import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
}

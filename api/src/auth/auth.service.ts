import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UsersService } from '../users/users.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(dto: SignupDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.usersService.createWithPassword(
      dto.email,
      passwordHash,
      dto.name,
    );
    return this.issueTokens(user.id, user.email, user.tier);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (
      !user?.passwordHash ||
      !(await argon2.verify(user.passwordHash, dto.password))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokens(user.id, user.email, user.tier);
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (
      !user?.refreshTokenHash ||
      !(await argon2.verify(user.refreshTokenHash, refreshToken))
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.issueTokens(user.id, user.email, user.tier);
  }

  async logout(userId: string) {
    await this.usersService.setRefreshTokenHash(userId, null);
  }

  async validateGoogleUser(googleId: string, email: string, name?: string) {
    let user = await this.usersService.findByGoogleId(googleId);
    if (!user) {
      user = await this.usersService.findByEmail(email);
    }
    if (!user) {
      user = await this.usersService.createWithGoogle(email, googleId, name);
    }
    return this.issueTokens(user.id, user.email, user.tier);
  }

  private async issueTokens(userId: string, email: string, tier: string) {
    const payload = { sub: userId, email, tier };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: ACCESS_TOKEN_TTL,
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: REFRESH_TOKEN_TTL,
    });

    await this.usersService.setRefreshTokenHash(
      userId,
      await argon2.hash(refreshToken),
    );

    return { accessToken, refreshToken };
  }
}

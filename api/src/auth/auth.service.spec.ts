import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  const user = {
    id: 'user-1',
    email: 'test@example.com',
    tier: 'FREE',
    passwordHash: null as string | null,
    refreshTokenHash: null as string | null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            findByGoogleId: jest.fn(),
            findById: jest.fn(),
            createWithPassword: jest.fn(),
            createWithGoogle: jest.fn(),
            setRefreshTokenHash: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('signed-token'),
            verifyAsync: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  describe('signup', () => {
    it('rejects an email that is already in use', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...user,
        passwordHash: 'hash',
      } as any);

      await expect(
        service.signup({ email: user.email, password: 'password123' }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a user and issues tokens for a new email', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.createWithPassword.mockResolvedValue({
        ...user,
        passwordHash: 'hash',
      } as any);

      const result = await service.signup({
        email: user.email,
        password: 'password123',
      });

      expect(usersService.createWithPassword).toHaveBeenCalled();
      expect(usersService.setRefreshTokenHash).toHaveBeenCalledWith(
        user.id,
        expect.any(String),
      );
      expect(result).toEqual({
        accessToken: 'signed-token',
        refreshToken: 'signed-token',
      });
    });
  });

  describe('login', () => {
    it('rejects an unknown email', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: user.email, password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a wrong password', async () => {
      const passwordHash = await argon2.hash('correct-password');
      usersService.findByEmail.mockResolvedValue({
        ...user,
        passwordHash,
      } as any);

      await expect(
        service.login({ email: user.email, password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('issues tokens for a correct password', async () => {
      const passwordHash = await argon2.hash('correct-password');
      usersService.findByEmail.mockResolvedValue({
        ...user,
        passwordHash,
      } as any);

      const result = await service.login({
        email: user.email,
        password: 'correct-password',
      });

      expect(result).toEqual({
        accessToken: 'signed-token',
        refreshToken: 'signed-token',
      });
    });

    it('rejects a Google-only account (no password set) attempting password login', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...user,
        passwordHash: null,
      } as any);

      await expect(
        service.login({ email: user.email, password: 'anything' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('rejects a refresh token that fails JWT verification', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('bad token'));

      await expect(service.refresh('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a refresh token that does not match the stored hash', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: user.id });
      usersService.findById.mockResolvedValue({
        ...user,
        refreshTokenHash: await argon2.hash('a-different-token'),
      } as any);

      await expect(service.refresh('presented-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rotates tokens when the refresh token matches', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: user.id });
      usersService.findById.mockResolvedValue({
        ...user,
        refreshTokenHash: await argon2.hash('presented-token'),
      } as any);

      const result = await service.refresh('presented-token');

      expect(result).toEqual({
        accessToken: 'signed-token',
        refreshToken: 'signed-token',
      });
    });

    it('rejects when the JWT is valid but the user no longer exists', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'deleted-user' });
      usersService.findById.mockResolvedValue(null);

      await expect(service.refresh('presented-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects when the user has already logged out (refresh hash cleared)', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: user.id });
      usersService.findById.mockResolvedValue({
        ...user,
        refreshTokenHash: null,
      } as any);

      await expect(service.refresh('presented-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('clears the stored refresh token hash', async () => {
      await service.logout(user.id);
      expect(usersService.setRefreshTokenHash).toHaveBeenCalledWith(
        user.id,
        null,
      );
    });
  });

  describe('validateGoogleUser', () => {
    it('reuses the existing user when the googleId already matches', async () => {
      usersService.findByGoogleId.mockResolvedValue(user as any);

      const result = await service.validateGoogleUser(
        'google-123',
        user.email,
        'Test User',
      );

      expect(usersService.findByEmail).not.toHaveBeenCalled();
      expect(usersService.createWithGoogle).not.toHaveBeenCalled();
      expect(result).toEqual({
        accessToken: 'signed-token',
        refreshToken: 'signed-token',
      });
    });

    it('links an existing email/password account on first Google login (no new user created)', async () => {
      usersService.findByGoogleId.mockResolvedValue(null);
      usersService.findByEmail.mockResolvedValue(user as any);

      await service.validateGoogleUser('google-123', user.email, 'Test User');

      expect(usersService.createWithGoogle).not.toHaveBeenCalled();
    });

    it('creates a brand-new user when neither googleId nor email match', async () => {
      usersService.findByGoogleId.mockResolvedValue(null);
      usersService.findByEmail.mockResolvedValue(null);
      usersService.createWithGoogle.mockResolvedValue(user as any);

      await service.validateGoogleUser(
        'google-123',
        'new@example.com',
        'New User',
      );

      expect(usersService.createWithGoogle).toHaveBeenCalledWith(
        'new@example.com',
        'google-123',
        'New User',
      );
    });
  });
});

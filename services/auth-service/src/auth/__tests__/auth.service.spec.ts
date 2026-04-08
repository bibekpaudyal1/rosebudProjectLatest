// ============================================================
// services/auth-service/src/auth/__tests__/auth.service.spec.ts
// Unit tests for AuthService — login, OTP, password reset
// ============================================================
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import * as bcrypt from 'bcrypt';
import { of, throwError } from 'rxjs';
import { AuthService } from '../auth.service';
import { AuthCredential } from '../entities/auth-credential.entity';
import { AuthSession } from '../entities/auth-session.entity';
import { PhoneOtp } from '../entities/phone-otp.entity';

// ── Mocks ─────────────────────────────────────────────────
const mockCredentialRepo = {
  findOne: jest.fn(),
  save:    jest.fn(),
  update:  jest.fn(),
  create:  jest.fn(),
};

const mockSessionRepo = {
  save:   jest.fn(),
  update: jest.fn(),
  findOne: jest.fn(),
};

const mockOtpRepo = {
  findOne: jest.fn(),
  save:    jest.fn(),
  update:  jest.fn(),
  create:  jest.fn(),
};

const mockRedis = {
  get:    jest.fn(),
  set:    jest.fn(),
  setex:  jest.fn(),
  del:    jest.fn(),
  incr:   jest.fn(),
  expire: jest.fn(),
};

const mockJwt = {
  sign:   jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn().mockReturnValue({ sub: 'user-123', role: 'customer' }),
};

const mockConfig = {
  get: jest.fn((key: string) => {
    const map: Record<string, string> = {
      'jwt.accessSecret':  'test-access-secret',
      'jwt.refreshSecret': 'test-refresh-secret',
      'services.userServiceUrl': 'http://user-service:4001',
      'sms.sslWirelessUrl': '',  // empty = dev mode (log OTP)
    };
    return map[key];
  }),
};

const mockHttpService = {
  post: jest.fn(),
  get:  jest.fn(),
};

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(AuthCredential), useValue: mockCredentialRepo },
        { provide: getRepositoryToken(AuthSession),    useValue: mockSessionRepo },
        { provide: getRepositoryToken(PhoneOtp),       useValue: mockOtpRepo },
        { provide: 'default_IORedisModuleConnectionToken', useValue: mockRedis },
        { provide: JwtService,     useValue: mockJwt },
        { provide: ConfigService,  useValue: mockConfig },
        { provide: HttpService,    useValue: mockHttpService },
        { provide: EventEmitter2,  useValue: { emit: jest.fn() } },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  // ── Login ────────────────────────────────────────────────

  describe('login()', () => {
    const mockUser = { id: 'user-123', role: 'customer', isActive: true };
    const hashedPassword = bcrypt.hashSync('correct-password', 10);

    beforeEach(() => {
      // User Service responds with user data
      mockHttpService.get.mockReturnValue(
        of({ data: { data: mockUser } }),
      );
      // Credential exists with hashed password
      mockCredentialRepo.findOne.mockResolvedValue({
        userId: 'user-123',
        passwordHash: hashedPassword,
        failedAttempts: 0,
      });
      // Not locked out
      mockRedis.get.mockResolvedValue(null);
      // Session save
      mockSessionRepo.save.mockResolvedValue({});
    });

    it('should return tokens on valid credentials', async () => {
      const result = await authService.login(
        { phone: '+8801712345678', password: 'correct-password' },
        { ip: '127.0.0.1', userAgent: 'test' },
      );

      expect(result).toEqual({
        accessToken:  'mock-jwt-token',
        refreshToken: 'mock-jwt-token',
        expiresIn:    900,
      });
      expect(mockJwt.sign).toHaveBeenCalledTimes(2);
    });

    it('should throw UnauthorizedException on wrong password', async () => {
      await expect(
        authService.login(
          { phone: '+8801712345678', password: 'wrong-password' },
          { ip: '127.0.0.1', userAgent: 'test' },
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should increment failed attempts on wrong password', async () => {
      await authService.login(
        { phone: '+8801712345678', password: 'wrong-password' },
        { ip: '127.0.0.1', userAgent: 'test' },
      ).catch(() => {});

      expect(mockCredentialRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ failedAttempts: 1 }),
      );
    });

    it('should throw ForbiddenException when account is locked', async () => {
      mockRedis.get.mockResolvedValue('1');  // locked

      await expect(
        authService.login(
          { phone: '+8801712345678', password: 'correct-password' },
          { ip: '127.0.0.1', userAgent: 'test' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should lock account after 10 failed attempts', async () => {
      mockCredentialRepo.findOne.mockResolvedValue({
        userId: 'user-123',
        passwordHash: hashedPassword,
        failedAttempts: 9,  // one more will trigger lock
      });

      await authService.login(
        { phone: '+8801712345678', password: 'wrong-password' },
        { ip: '127.0.0.1', userAgent: 'test' },
      ).catch(() => {});

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'login_lock:user-123',
        1800,  // 30 minutes
        '1',
      );
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => ({ response: { status: 404 } })),
      );

      await expect(
        authService.login(
          { phone: '+8801700000000', password: 'any' },
          { ip: '127.0.0.1', userAgent: 'test' },
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException for deactivated accounts', async () => {
      mockHttpService.get.mockReturnValue(
        of({ data: { data: { ...mockUser, isActive: false } } }),
      );

      await expect(
        authService.login(
          { phone: '+8801712345678', password: 'correct-password' },
          { ip: '127.0.0.1', userAgent: 'test' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── OTP ──────────────────────────────────────────────────

  describe('sendOtp()', () => {
    it('should create an OTP and return TTL', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockOtpRepo.create.mockReturnValue({});
      mockOtpRepo.save.mockResolvedValue({});
      mockOtpRepo.update.mockResolvedValue({});

      const result = await authService.sendOtp({
        phone: '+8801712345678',
        purpose: 'register',
      });

      expect(result).toEqual({ message: 'OTP sent successfully', expiresIn: 300 });
      expect(mockOtpRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException on rate limit', async () => {
      mockRedis.incr.mockResolvedValue(4);  // exceeded 3 per 10 min

      await expect(
        authService.sendOtp({ phone: '+8801712345678', purpose: 'register' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── Token refresh ─────────────────────────────────────────

  describe('refresh()', () => {
    it('should return a new access token for valid refresh token', async () => {
      mockSessionRepo.findOne.mockResolvedValue({
        userId: 'user-123',
        refreshToken: 'valid-refresh-token',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 86400_000),
      });

      const result = await authService.refresh({ refreshToken: 'valid-refresh-token' });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.expiresIn).toBe(900);
    });

    it('should throw UnauthorizedException for expired session', async () => {
      mockSessionRepo.findOne.mockResolvedValue({
        refreshToken: 'expired-token',
        isRevoked: false,
        expiresAt: new Date(Date.now() - 1000),  // expired
      });

      await expect(
        authService.refresh({ refreshToken: 'expired-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for revoked session', async () => {
      mockSessionRepo.findOne.mockResolvedValue(null);  // revoked sessions return null

      await expect(
        authService.refresh({ refreshToken: 'revoked-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
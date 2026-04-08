import {
  Injectable, UnauthorizedException, BadRequestException,
  ConflictException, Logger, ForbiddenException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AuthCredential } from './entities/auth-credential.entity';
import { AuthSession } from './entities/auth-session.entity';
import { PhoneOtp } from './entities/phone-otp.entity';
import {
  RegisterDto, LoginDto, SendOtpDto, RefreshTokenDto,
  ResetPasswordDto
} from './dto/auth.dto';
import { AuthTokens, JwtPayload, UserRole } from '@bazarbd/types';
import { createHash, randomInt } from 'crypto';

const BCRYPT_ROUNDS = 12;
const OTP_TTL_SECONDS = 300; // 5 minutes
const OTP_MAX_ATTEMPTS = 5;
const REFRESH_TOKEN_TTL_DAYS = 7;
const MAX_FAILED_LOGIN = 10;
const LOCKOUT_MINUTES = 30;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(AuthCredential)
    private readonly credentialRepo: Repository<AuthCredential>,
    @InjectRepository(AuthSession)
    private readonly sessionRepo: Repository<AuthSession>,
    @InjectRepository(PhoneOtp)
    private readonly otpRepo: Repository<PhoneOtp>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRedis() private readonly redis: Redis,
    private readonly httpService: HttpService,
  ) {}

  // ============================================================
  // OTP
  // ============================================================

  async sendOtp(dto: SendOtpDto): Promise<{ message: string; expiresIn: number }> {
    // Rate limit: max 3 OTPs per phone per 10 minutes
    const rateLimitKey = `otp_rate:${dto.phone}`;
    const attempts = await this.redis.incr(rateLimitKey);
    if (attempts === 1) await this.redis.expire(rateLimitKey, 600);
    if (attempts > 3) {
      throw new BadRequestException('Too many OTP requests. Please wait 10 minutes.');
    }

    const otp = randomInt(100_000, 999_999).toString();
    const otpHash = this.hashToken(otp);

    // Invalidate any existing OTPs for this phone + purpose
    await this.otpRepo.update(
      { phone: dto.phone, purpose: dto.purpose },
      { verifiedAt: new Date() }
    );

    await this.otpRepo.save(
      this.otpRepo.create({
        phone: dto.phone,
        otpHash,
        purpose: dto.purpose,
        expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
      }),
    );

    // Send SMS via SSL Wireless
    await this.sendSms(dto.phone, `Your BazarBD OTP is: ${otp}. Valid for 5 minutes.`);

    this.logger.log(`OTP sent to ${dto.phone} for purpose: ${dto.purpose}`);
    return { message: 'OTP sent successfully', expiresIn: OTP_TTL_SECONDS };
  }

  private async verifyOtp(phone: string, otp: string, purpose: string): Promise<void> {
    const otpHash = this.hashToken(otp);
    const record = await this.otpRepo.findOne({
      where: { phone, otpHash, purpose },
      order: { createdAt: 'DESC' },
    });

    if (!record || record.verifiedAt) {
      throw new BadRequestException('Invalid or expired OTP');
    }
    if (new Date() > record.expiresAt) {
      throw new BadRequestException('OTP has expired');
    }
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException('Too many incorrect attempts');
    }

    // Mark as used
    record.verifiedAt = new Date();
    await this.otpRepo.save(record);
  }

  // ============================================================
  // REGISTER
  // ============================================================

  async register(dto: RegisterDto, deviceInfo: { ip: string; userAgent: string }): Promise<AuthTokens> {
    // Verify OTP first
    await this.verifyOtp(dto.phone, dto.otp, 'register');

    // Create user via User Service (internal HTTP call)
    let userId: string;
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.config.get('services.userServiceUrl')}/users`,
          { phone: dto.phone, fullName: dto.fullName, role: UserRole.CUSTOMER },
        ),
      );
      userId = response.data.data.id;
    } catch (err: any) {
      if (err?.response?.status === 409) {
        throw new ConflictException('Phone number already registered');
      }
      throw err;
    }

    // Hash password and store credentials
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    await this.credentialRepo.save(
      this.credentialRepo.create({ userId, passwordHash }),
    );

    return this.issueTokens(userId, UserRole.CUSTOMER, deviceInfo);
  }

  // ============================================================
  // LOGIN
  // ============================================================

  async login(dto: LoginDto, deviceInfo: { ip: string; userAgent: string }): Promise<AuthTokens> {
    if (!dto.phone && !dto.email) {
      throw new BadRequestException('Phone or email required');
    }

    // Fetch user from User Service
    let user: { id: string; role: UserRole; isActive: boolean };
    try {
      const endpoint = dto.phone
        ? `${this.config.get('services.userServiceUrl')}/users/by-phone/${dto.phone}`
        : `${this.config.get('services.userServiceUrl')}/users/by-email/${dto.email}`;
      const response = await firstValueFrom(this.httpService.get(endpoint));
      user = response.data.data;
    } catch {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) throw new ForbiddenException('Account is deactivated');

    // Check lockout
    const lockKey = `login_lock:${user.id}`;
    const locked = await this.redis.get(lockKey);
    if (locked) throw new ForbiddenException('Account temporarily locked. Try again later.');

    // Verify password
    const credential = await this.credentialRepo.findOne({ where: { userId: user.id } });
    if (!credential?.passwordHash) throw new UnauthorizedException('Invalid credentials');

    const passwordMatch = await bcrypt.compare(dto.password, credential.passwordHash);
    if (!passwordMatch) {
      credential.failedAttempts += 1;
      if (credential.failedAttempts >= MAX_FAILED_LOGIN) {
        await this.redis.setex(lockKey, LOCKOUT_MINUTES * 60, '1');
        credential.failedAttempts = 0;
        this.logger.warn(`Account locked after failed attempts: ${user.id}`);
      }
      await this.credentialRepo.save(credential);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on success
    if (credential.failedAttempts > 0) {
      credential.failedAttempts = 0;
      await this.credentialRepo.save(credential);
    }

    return this.issueTokens(user.id, user.role, deviceInfo);
  }

  // ============================================================
  // REFRESH
  // ============================================================

  async refresh(dto: RefreshTokenDto): Promise<Pick<AuthTokens, 'accessToken' | 'expiresIn'>> {
    const session = await this.sessionRepo.findOne({
      where: { refreshToken: dto.refreshToken, isRevoked: false },
    });

    if (!session || new Date() > session.expiresAt) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate refresh token (security best practice)
    // Issue new access token only — refresh token rotation in auth flow
    const payload = this.jwtService.verify<JwtPayload>(
      dto.refreshToken,
      { secret: this.config.get<string>('jwt.refreshSecret') },
    );

    const accessToken = this.jwtService.sign(
      { sub: payload.sub, role: payload.role },
      {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: '15m',
      },
    );

    return { accessToken, expiresIn: 900 };
  }

  // ============================================================
  // LOGOUT
  // ============================================================

  async logout(refreshToken: string): Promise<void> {
    await this.sessionRepo.update({ refreshToken }, { isRevoked: true });
  }

  // ============================================================
  // FORGOT / RESET PASSWORD
  // ============================================================

  async forgotPassword(phone: string): Promise<void> {
    await this.sendOtp({ phone, purpose: 'reset_password' });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    await this.verifyOtp(dto.phone, dto.otp, 'reset_password');

    // Fetch userId from User Service
    const response = await firstValueFrom(
      this.httpService.get(
        `${this.config.get('services.userServiceUrl')}/users/by-phone/${dto.phone}`,
      ),
    );
    const userId = response.data.data.id;

    const newHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.credentialRepo.update({ userId }, { passwordHash: newHash, failedAttempts: 0 });

    // Revoke all existing sessions
    await this.sessionRepo.update({ userId: userId }, { isRevoked: true });
    this.logger.log(`Password reset for user: ${userId}`);
  }

  // ============================================================
  // INTERNAL HELPERS
  // ============================================================

  private async issueTokens(
    userId: string,
    role: UserRole,
    deviceInfo: { ip: string; userAgent: string },
  ): Promise<AuthTokens> {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = { sub: userId, role };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('jwt.refreshSecret'),
      expiresIn: `${REFRESH_TOKEN_TTL_DAYS}d`,
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    await this.sessionRepo.save(
      this.sessionRepo.create({
        userId,
        refreshToken,
        ipAddress: deviceInfo.ip,
        userAgent: deviceInfo.userAgent,
        expiresAt,
      }),
    );

    return { accessToken, refreshToken, expiresIn: 900 };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async sendSms(phone: string, message: string): Promise<void> {
    // SSL Wireless integration
    const apiUrl = this.config.get<string>('sms.sslWirelessUrl');
    const apiToken = this.config.get<string>('sms.sslWirelessToken');
    const sid = this.config.get<string>('sms.sslWirelessSid');

    if (!apiUrl || process.env.NODE_ENV === 'development') {
      // In development, just log the OTP
      this.logger.debug(`[DEV SMS] To: ${phone}, Message: ${message}`);
      return;
    }

    await firstValueFrom(
      this.httpService.post(apiUrl, {
        api_token: apiToken,
        sid,
        msisdn: phone.replace('+', ''),
        sms: message,
        csmsid: uuidv4(),
      }),
    );
  }
}

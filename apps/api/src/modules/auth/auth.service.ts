import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserStatus, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { AuthRepository } from './auth.repository';
import { AuditService } from './audit.service';
import { RegisterDto, LoginDto, RefreshTokenDto, LogoutDto, VerifyGovDto } from './dto/auth.dto';

interface TokenPayload {
  sub: string;
  role: string;
  sessionId: string;
  familyId: string;
  type: 'access' | 'refresh';
}

interface DeviceInfo {
  fingerprint: string;
  userAgent: string;
  ipAddress: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly auditService: AuditService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) { }

  async register(dto: RegisterDto, deviceInfo: DeviceInfo) {
    const existingUser = await this.authRepository.findUserByEmail(dto.email);
    if (existingUser) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'USER_ALREADY_EXISTS',
          message: 'User with this email already exists',
        },
      });
    }

    const passwordHash = await this.hashPassword(dto.password);

    const user = await this.authRepository.createUser({
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      role: dto.role,
    });

    await this.auditService.log('USER_REGISTERED', {
      userId: user.id,
      ipAddress: deviceInfo.ipAddress,
      userAgent: deviceInfo.userAgent,
      deviceFingerprint: deviceInfo.fingerprint,
      details: { role: dto.role },
    });

    return {
      message: 'Registration successful. Government verification required.',
      userId: user.id,
      verificationRequired: true,
    };
  }

  async login(dto: LoginDto, deviceInfo: DeviceInfo) {
    const user = await this.authRepository.findUserByEmail(dto.email);
    if (!user) {
      await this.auditService.log('LOGIN_FAILED_USER_NOT_FOUND', {
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        deviceFingerprint: deviceInfo.fingerprint,
        details: { email: dto.email, reason: 'user_not_found' },
      });

      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    this.validateAccountStatus(user.status);

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.auditService.log('LOGIN_BLOCKED_ACCOUNT_LOCKED', {
        userId: user.id,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        deviceFingerprint: deviceInfo.fingerprint,
        details: { lockedUntil: user.lockedUntil.toISOString() },
      });

      const remainingMs = user.lockedUntil.getTime() - Date.now();
      const remainingMinutes = Math.ceil(remainingMs / 60000);

      throw new ForbiddenException({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: `Account is locked. Try again in ${remainingMinutes} minutes`,
          lockedUntil: user.lockedUntil.toISOString(),
        },
      });
    }

    const isValidPassword = await this.verifyPassword(dto.password, user.passwordHash);
    if (!isValidPassword) {
      await this.handleFailedLogin(user.id, deviceInfo);
      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    await this.authRepository.resetFailedLoginAttempts(user.id);
    await this.authRepository.updateLastLogin(user.id);

    const deviceFingerprint = dto.deviceFingerprint || deviceInfo.fingerprint;
    const authResponse = await this.createAuthResponse(user, deviceFingerprint, deviceInfo);

    await this.auditService.log('LOGIN_SUCCESS', {
      userId: user.id,
      sessionId: authResponse.sessionId,
      familyId: authResponse.familyId,
      ipAddress: deviceInfo.ipAddress,
      userAgent: deviceInfo.userAgent,
      deviceFingerprint,
    });

    return authResponse;
  }

  async refreshToken(dto: RefreshTokenDto, deviceInfo: DeviceInfo) {
    const tokenHash = this.authRepository.hashToken(dto.refreshToken);
    const { session, reuseDetected } = await this.authRepository.consumeRefreshToken(tokenHash);

    if (!session) {
      await this.auditService.log('REFRESH_TOKEN_INVALID', {
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        deviceFingerprint: dto.deviceFingerprint,
        details: { reason: 'token_not_found' },
      });

      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid or expired refresh token',
        },
      });
    }

    if (reuseDetected) {
      // REQUIREMENT: Invalidate ALL sessions for maximum security against hijacking
      await this.authRepository.deleteAllUserSessions(session.userId);

      await this.auditService.log('REFRESH_TOKEN_REUSE_DETECTED', {
        userId: session.userId,
        familyId: session.familyId,
        sessionId: session.id,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        deviceFingerprint: dto.deviceFingerprint,
        details: { reason: 'token_already_revoked', action: 'all_sessions_invalidated' },
      });

      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'TOKEN_REVOKED',
          message: 'Token reuse detected. All sessions revoked for security. Please login again',
        },
      });
    }

    if (session.expiresAt < new Date()) {
      // Note: session is automatically marked revoked structurally by consumeRefreshToken
      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'REFRESH_TOKEN_EXPIRED',
          message: 'Refresh token has expired',
        },
      });
    }

    const user = session.user;
    if (!user) {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found for session',
        },
      });
    }

    this.validateAccountStatusOnRefresh(user);

    const currentRole = await this.authRepository.getUserRole(user.id);
    if (currentRole !== user.role) {
      await this.authRepository.revokeFamily(session.familyId);
      await this.auditService.log('ROLE_CHANGED_SESSION_REVOKED', {
        userId: user.id,
        familyId: session.familyId,
        sessionId: session.id,
        details: { oldRole: user.role, newRole: currentRole },
      });

      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'ROLE_CHANGED',
          message: 'Role changed. Please login again',
        },
      });
    }

    const oldFamilyId = session.familyId;

    // Previous token has natively been marked revoked structurally inside the SQL transaction


    const accessToken = this.generateAccessToken(user, session.familyId);
    const expiresIn = this.parseExpiresIn(this.configService.get<string>('auth.jwtExpiresIn') || '15m');

    await this.auditService.log('REFRESH_TOKEN_SUCCESS', {
      userId: user.id,
      oldFamilyId,
      ipAddress: deviceInfo.ipAddress,
      userAgent: deviceInfo.userAgent,
      deviceFingerprint: dto.deviceFingerprint,
    });

    return {
      accessToken,
      expiresIn,
      tokenType: 'Bearer',
    };
  }

  async logout(userId: string, dto: LogoutDto, sessionId?: string) {
    let sessionsTerminated = 0;

    switch (dto.logoutScope) {
      case 'ALL':
        sessionsTerminated = await this.authRepository.deleteAllUserSessions(userId);
        await this.auditService.log('LOGOUT_ALL', {
          userId,
          details: { sessionsTerminated },
        });
        break;
      case 'OTHERS':
        if (sessionId) {
          const currentSession = await this.authRepository.findSessionById(sessionId);
          if (currentSession) {
            sessionsTerminated = await this.authRepository.deleteOtherUserSessions(userId, currentSession.familyId);
          }
        }
        await this.auditService.log('LOGOUT_OTHERS', {
          userId,
          sessionId,
          details: { sessionsTerminated },
        });
        break;
      case 'CURRENT':
      default:
        if (sessionId) {
          await this.authRepository.revokeSession(sessionId);
          const session = await this.authRepository.findSessionById(sessionId);
          if (session) {
            sessionsTerminated = await this.authRepository.revokeFamily(session.familyId);
          } else {
            sessionsTerminated = 1;
          }
        } else if (dto.refreshToken) {
          const tokenHash = this.authRepository.hashToken(dto.refreshToken);
          const session = await this.authRepository.findSessionByTokenHash(tokenHash);
          if (session && session.userId === userId) {
            sessionsTerminated = await this.authRepository.revokeFamily(session.familyId);
            await this.auditService.log('LOGOUT_CURRENT', {
              userId,
              sessionId: session.id,
              familyId: session.familyId,
            });
          }
        }
        break;
    }

    return {
      message: 'Logout successful',
      sessionsTerminated,
    };
  }

  async verifyGovIdentity(dto: VerifyGovDto) {
    return {
      message: 'Government verification stub: In production, this would connect to government API',
      status: 'PENDING',
      userId: dto.userId || 'to-be-created',
      nextSteps: 'Submit identity documents for verification',
    };
  }

  async validateUser(userId: string) {
    const user = await this.authRepository.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    this.validateAccountStatus(user.status);

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      verifiedAt: user.verifiedAt,
    };
  }

  private async hashPassword(password: string): Promise<string> {
    const argon2Options = this.configService.get('auth.argon2') || {
      type: 'argon2id',
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
      hashLength: 32,
    };

    return argon2.hash(password, {
      type: argon2Options.type as argon2.Options['type'],
      memoryCost: argon2Options.memoryCost,
      timeCost: argon2Options.timeCost,
      parallelism: argon2Options.parallelism,
      hashLength: argon2Options.hashLength,
    });
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  private generateAccessToken(user: any, familyId: string): string {
    const jti = randomUUID();
    const payload: TokenPayload = {
      sub: user.id,
      role: user.role,
      sessionId: jti,
      familyId,
      type: 'access',
    };

    return this.jwtService.sign(payload);
  }

  private generateRefreshToken(userId: string, familyId: string): string {
    const payload = {
      sub: userId,
      familyId,
      type: 'refresh',
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('auth.refreshTokenSecret'),
      expiresIn: this.configService.get<string>('auth.refreshTokenExpiresIn') || '7d',
    });
  }

  private async createAuthResponse(user: any, deviceFingerprint: string, deviceInfo: DeviceInfo) {
    const familyId = randomUUID();
    const accessTokenJti = randomUUID();

    const accessToken = this.generateAccessToken(user, familyId);
    const refreshToken = this.generateRefreshToken(user.id, familyId);

    const refreshTokenHash = this.authRepository.hashToken(refreshToken);
    const expiresIn = this.parseExpiresIn(this.configService.get<string>('auth.jwtExpiresIn') || '15m');
    const refreshTokenExpiresIn = this.parseExpiresIn(this.configService.get<string>('auth.refreshTokenExpiresIn') || '7d');

    await this.authRepository.createSession({
      userId: user.id,
      familyId,
      tokenHash: refreshTokenHash,
      accessTokenJti,
      deviceFingerprint,
      ipAddress: deviceInfo.ipAddress,
      userAgent: deviceInfo.userAgent,
      expiresAt: new Date(Date.now() + refreshTokenExpiresIn * 1000),
    });

    return {
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer',
      sessionId: accessTokenJti,
      familyId,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        verifiedAt: user.verifiedAt,
      },
    };
  }

  private async handleFailedLogin(userId: string, deviceInfo: DeviceInfo): Promise<void> {
    const user = await this.authRepository.incrementFailedLoginAttempts(userId);
    const maxAttempts = this.configService.get<number>('auth.bruteForce.maxAttempts') || 5;
    const baseLockDuration = this.configService.get<number>('auth.bruteForce.baseLockDurationMs') || 300000;
    const maxLockDuration = this.configService.get<number>('auth.bruteForce.maxLockDurationMs') || 86400000;
    const progressiveMultiplier = this.configService.get<number>('auth.bruteForce.progressiveMultiplier') || 2;
    const trackingWindow = this.configService.get<number>('auth.bruteForce.trackingWindowMs') || 900000;

    const recentAttempts = await this.authRepository.getRecentFailedAttempts(userId, trackingWindow);
    const totalAttempts = recentAttempts.reduce((sum, a) => sum + a.attempts, 0) + 1;

    const failedLoginTrackingWindow = new Date(Date.now() + trackingWindow);
    await this.authRepository.createFailedLoginAttempt({
      userId,
      ipAddress: deviceInfo.ipAddress,
      userAgent: deviceInfo.userAgent,
      reason: 'invalid_password',
      expiresAt: failedLoginTrackingWindow,
    });

    await this.auditService.log('LOGIN_FAILED', {
      userId,
      ipAddress: deviceInfo.ipAddress,
      userAgent: deviceInfo.userAgent,
      deviceFingerprint: deviceInfo.fingerprint,
      details: { attemptNumber: totalAttempts, maxAttempts },
    });

    if (totalAttempts >= maxAttempts) {
      const lockDuration = Math.min(
        baseLockDuration * Math.pow(progressiveMultiplier, Math.floor(totalAttempts / maxAttempts)),
        maxLockDuration
      );

      await this.authRepository.lockAccount(userId, lockDuration);

      await this.authRepository.deleteAllUserSessions(userId);

      await this.auditService.log('ACCOUNT_LOCKED', {
        userId,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        deviceFingerprint: deviceInfo.fingerprint,
        details: { lockDuration, reason: 'max_attempts_exceeded' },
      });
    }
  }

  private validateAccountStatus(status: UserStatus): void {
    if (status === UserStatus.SUSPENDED) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'ACCOUNT_SUSPENDED',
          message: 'Account has been suspended. Contact support.',
        },
      });
    }

    if (status === UserStatus.DEACTIVATED) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'ACCOUNT_DEACTIVATED',
          message: 'Account has been deactivated',
        },
      });
    }
  }

  private validateAccountStatusOnRefresh(user: any): void {
    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'ACCOUNT_SUSPENDED',
          message: 'Account has been suspended. Contact support.',
        },
      });
    }

    if (user.status === UserStatus.DEACTIVATED) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'ACCOUNT_DEACTIVATED',
          message: 'Account has been deactivated',
        },
      });
    }

    if (user.status === UserStatus.PENDING_VERIFICATION) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Please verify your account before proceeding',
        },
      });
    }
  }

  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 900;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 900;
    }
  }
}

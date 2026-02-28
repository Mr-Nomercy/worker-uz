import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Prisma, User, UserStatus, UserRole, Session, FailedLoginAttempt, SecurityEvent } from '@prisma/client';
import * as crypto from 'crypto';

export type AuthUser = Pick<User, 'id' | 'email' | 'passwordHash' | 'status' | 'role' | 'lockedUntil'>;
export type MinimalAuthUser = Pick<User, 'id' | 'email' | 'status' | 'role' | 'phone' | 'verifiedAt'>;

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) { }

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        status: true,
        role: true,
        lockedUntil: true,
      },
    });
  }

  async findUserById(id: string): Promise<MinimalAuthUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        status: true,
        role: true,
        phone: true,
        verifiedAt: true,
      },
    });
  }

  async createUser(data: {
    email: string;
    phone: string;
    passwordHash: string;
    role: UserRole;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        phone: data.phone,
        passwordHash: data.passwordHash,
        role: data.role,
        status: UserStatus.PENDING_VERIFICATION,
      },
    });
  }

  async updateUserStatus(userId: string, status: UserStatus): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        status,
        verifiedAt: status === UserStatus.ACTIVE ? new Date() : undefined,
      },
    });
  }

  async updateUserRole(userId: string, role: Prisma.EnumUserRoleFieldUpdateOperationsInput): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  async incrementFailedLoginAttempts(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: { increment: 1 },
      },
    });
  }

  async resetFailedLoginAttempts(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  async lockAccount(userId: string, lockDurationMs: number): Promise<User> {
    const lockedUntil = new Date(Date.now() + lockDurationMs);
    return this.prisma.user.update({
      where: { id: userId },
      data: { lockedUntil },
    });
  }

  async createSession(data: {
    userId: string;
    familyId: string;
    tokenHash: string;
    accessTokenJti: string;
    deviceFingerprint?: string;
    ipAddress?: string;
    userAgent?: string;
    expiresAt: Date;
  }): Promise<Session> {
    return this.prisma.session.create({
      data: {
        userId: data.userId,
        familyId: data.familyId,
        tokenHash: data.tokenHash,
        accessTokenJti: data.accessTokenJti,
        deviceFingerprint: data.deviceFingerprint,
        ipAddress: data.ipAddress ? this.parseIpAddress(data.ipAddress) : undefined,
        userAgent: data.userAgent,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findSessionByTokenHash(tokenHash: string): Promise<(Session & { user: User }) | null> {
    const sessions = await this.prisma.session.findMany({
      where: {
        tokenHash,
        deletedAt: null,
        // Removed isRevoked: false to allow detecting reuse of revoked tokens
      },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 1,
    });
    return sessions[0] || null;
  }

  async consumeRefreshToken(tokenHash: string): Promise<{ session: Session & { user: User } | null, reuseDetected: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch the raw session data required for downstream context
      const session = await tx.session.findFirst({
        where: { tokenHash, deletedAt: null },
        include: { user: true },
      });

      if (!session) return { session: null, reuseDetected: false };

      // 2. Optimistic Concurrency Control
      // Attempt to actively consume the token if, and ONLY if, it is literally unrevoked right this millisecond
      const consumeResult = await tx.session.updateMany({
        where: { id: session.id, isRevoked: false },
        data: { isRevoked: true, revokedAt: new Date() },
      });

      // 3. Evaluation
      if (consumeResult.count === 0) {
        // Reuse definitely happened (either this was already revoked in DB, or another parallel request beat us to the updateMany)
        await tx.session.updateMany({
          where: { familyId: session.familyId, isRevoked: false },
          data: { isRevoked: true, revokedAt: new Date() },
        });

        // Ensure we mark our returned local object as revoked so downstream logic knows
        session.isRevoked = true;
        return { session, reuseDetected: true };
      }

      // Success, we won the race lock and consumed it natively
      session.isRevoked = true;
      return { session, reuseDetected: false };
    });
  }

  async findSessionById(sessionId: string): Promise<Session | null> {
    return this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: true,
      },
    });
  }

  async findSessionByAccessTokenJti(jti: string): Promise<Session | null> {
    return this.prisma.session.findFirst({
      where: {
        accessTokenJti: jti,
        deletedAt: null,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: true,
      },
    });
  }

  async findSessionsByUserId(userId: string): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: {
        userId,
        deletedAt: null,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findSessionsByFamilyId(familyId: string): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: {
        familyId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });
  }

  async revokeFamily(familyId: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: {
        familyId,
        isRevoked: false,
      },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });
    return result.count;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { deletedAt: new Date() },
    });
  }

  async deleteAllUserSessions(userId: string): Promise<number> {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        deletedAt: null,
        isRevoked: false,
      },
    });

    const familyIds = [...new Set(sessions.map(s => s.familyId))];
    let count = 0;

    for (const familyId of familyIds) {
      count += await this.revokeFamily(familyId);
    }

    return count;
  }

  async deleteOtherUserSessions(userId: string, currentFamilyId: string): Promise<number> {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        familyId: { not: currentFamilyId },
        deletedAt: null,
        isRevoked: false,
      },
    });

    const familyIds = [...new Set(sessions.map(s => s.familyId))];
    let count = 0;

    for (const familyId of familyIds) {
      count += await this.revokeFamily(familyId);
    }

    return count;
  }

  async deleteExpiredSessions(): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { deletedAt: { not: null } },
        ],
      },
      data: {
        deletedAt: new Date(),
      },
    });
    return result.count;
  }

  async createFailedLoginAttempt(data: {
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    reason: string;
    expiresAt: Date;
  }): Promise<FailedLoginAttempt> {
    return this.prisma.failedLoginAttempt.create({
      data: {
        userId: data.userId,
        ipAddress: data.ipAddress ? this.parseIpAddress(data.ipAddress) : undefined,
        userAgent: data.userAgent,
        reason: data.reason,
        expiresAt: data.expiresAt,
      },
    });
  }

  async getRecentFailedAttempts(userId: string, windowMs: number): Promise<FailedLoginAttempt[]> {
    const windowStart = new Date(Date.now() - windowMs);
    return this.prisma.failedLoginAttempt.findMany({
      where: {
        userId,
        createdAt: { gt: windowStart },
        expiresAt: { gt: new Date() },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async cleanupExpiredFailedAttempts(): Promise<number> {
    const result = await this.prisma.failedLoginAttempt.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  }

  async findUserRoles(userId: string): Promise<{ role: { name: string; level: number } }[]> {
    return this.prisma.userRoleRelation.findMany({
      where: { userId },
      include: {
        role: {
          select: { name: true, level: true },
        },
      },
    });
  }

  async getUserRole(userId: string): Promise<User['role'] | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role || null;
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private parseIpAddress(ip: string): string | undefined {
    try {
      return ip.match(/[\d.]+/)?.[0] || ip;
    } catch {
      return ip;
    }
  }
}

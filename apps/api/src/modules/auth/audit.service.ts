import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Prisma } from '@prisma/client';

interface AuditContext {
  userId?: string;
  targetUserId?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  sessionId?: string;
  familyId?: string;
  oldFamilyId?: string;
  details?: Record<string, any>;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(eventType: string, context: AuditContext): Promise<void> {
    try {
      const details = {
        ...context.details,
        oldFamilyId: context.oldFamilyId,
      };

      await this.prisma.securityEvent.create({
        data: {
          userId: context.userId,
          eventType,
          ipAddress: context.ipAddress ? this.parseIpAddress(context.ipAddress) : undefined,
          userAgent: context.userAgent,
          deviceFingerprint: context.deviceFingerprint,
          sessionId: context.sessionId,
          familyId: context.familyId,
          details: details as Prisma.JsonObject,
        },
      });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  private parseIpAddress(ip: string): string | undefined {
    try {
      return ip.match(/[\d.]+/)?.[0] || ip;
    } catch {
      return ip;
    }
  }
}

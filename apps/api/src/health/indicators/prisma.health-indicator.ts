import { Injectable } from '@nestjs/common';
import { IHealthIndicator, HealthCheckResult } from '../interfaces/health-indicator.interface';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class PrismaHealthIndicator implements IHealthIndicator {
  constructor(private readonly prisma: PrismaService) { }

  async check(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      let status: 'healthy' | 'degraded' = 'healthy';
      if (responseTime > 500) {
        status = 'degraded';
      }

      return {
        name: 'database',
        status,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        name: 'database',
        status: 'unhealthy',
        responseTime,
        metadata: { error: String(error) },
      };
    }
  }
}

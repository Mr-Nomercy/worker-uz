import { Injectable } from '@nestjs/common';
import { IHealthIndicator, HealthCheckResult } from '../interfaces/health-indicator.interface';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class RedisHealthIndicator implements IHealthIndicator {
  constructor(private readonly redis: RedisService) { }

  async check(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const isHealthy = await this.redis.ping();
      const responseTime = Date.now() - startTime;

      if (!isHealthy) {
        throw new Error('Redis ping failed');
      }

      return {
        name: 'redis',
        status: 'healthy',
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        name: 'redis',
        status: 'unhealthy',
        responseTime,
        metadata: { error: String(error) },
      };
    }
  }
}

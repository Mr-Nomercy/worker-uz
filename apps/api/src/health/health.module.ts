import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaHealthIndicator } from './indicators/prisma.health-indicator';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';
import { GovHealthIndicator } from './indicators/gov.health-indicator';
import { MatchingHealthIndicator } from './indicators/matching.health-indicator';

import { GovIntegrationModule } from '../modules/gov-integration/gov-integration.module';

import { MatchingModule } from '../modules/matching/matching.module';

@Module({
  imports: [
    GovIntegrationModule,
    MatchingModule,
  ],
  controllers: [HealthController],
  providers: [
    HealthService,
    PrismaHealthIndicator,
    RedisHealthIndicator,
    GovHealthIndicator,
    MatchingHealthIndicator
  ],
})
export class HealthModule { }

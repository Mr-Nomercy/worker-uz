import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './database/prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { LoggingModule } from './logging/logging.module';
import { AuthModule } from './modules/auth/auth.module';
import { IdentityModule } from './modules/identity/identity.module';
import { WorkerModule } from './modules/worker/worker.module';
import { EmployerModule } from './modules/employer/employer.module';
import { VacancyModule } from './modules/vacancy/vacancy.module';
import { ApplicationModule } from './modules/application/application.module';
import { InterviewModule } from './modules/interview/interview.module';
import { GovIntegrationModule } from './modules/gov-integration/gov-integration.module';
import { MatchingModule } from './modules/matching/matching.module';
import { ShutdownModule } from './common/shutdown/shutdown.module';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { EventLoopMonitorService } from './common/monitoring/event-loop-monitor.service';

@Module({
  imports: [
    LoggingModule,
    ConfigModule,
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    IdentityModule,
    WorkerModule,
    EmployerModule,
    VacancyModule,
    ApplicationModule,
    InterviewModule,
    GovIntegrationModule,
    MatchingModule,
    ShutdownModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    EventLoopMonitorService,
  ],
})
export class AppModule { }

import { Module } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { MatchingRepository } from './matching.repository';
import { MatchingRedisService } from './matching-redis.service';
import { MatchingCacheService } from './matching-cache.service';
import { MatchingQueueService } from './matching.queue';
import { MatchingProcessor } from './matching.processor';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '../../config/config.module';

@Module({
  imports: [AuthModule, ConfigModule],
  providers: [
    MatchingService,
    MatchingRepository,
    MatchingRedisService,
    MatchingCacheService,
    MatchingQueueService,
    MatchingProcessor,
  ],
  exports: [MatchingService, MatchingRepository, MatchingQueueService],
})
export class MatchingModule {}

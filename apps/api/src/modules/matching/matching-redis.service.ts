import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class MatchingRedisService implements OnModuleDestroy {
  private readonly logger = new Logger(MatchingRedisService.name);
  private readonly redis: Redis;

  constructor(private readonly configService: AppConfigService) {
    this.redis = new Redis({
      host: this.configService.redisHost,
      port: this.configService.redisPort,
      password: this.configService.redisPassword,
      db: this.configService.redisDb,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }

  createClient(type: 'publisher' | 'subscriber' | 'client'): Redis {
    return this.redis;
  }

  async onModuleDestroy() {
    await this.redis.quit();
    this.logger.log('MatchingRedisService connection closed');
  }
}

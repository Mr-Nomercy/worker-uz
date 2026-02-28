import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../../config/app-config.service';

const CACHE_TTL = 600;
const CACHE_LIMIT = 50;
const LOCK_TTL = 10;
const LOCK_RETRY_DELAY = 50;
const LOCK_MAX_RETRIES = 5;

export interface CachedMatchScore {
  workerId: string;
  vacancyId: string;
  totalScore: number;
  skillScore: number;
  experienceScore: number;
  educationScore: number;
  locationScore: number;
  salaryScore: number;
  skillMatchCount: number;
  skillRequiredCount: number;
  isRecommended: boolean;
  cachedAt: string;
}

@Injectable()
export class MatchingCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(MatchingCacheService.name);
  private readonly redis: Redis;

  constructor(private readonly configService: AppConfigService) {
    this.redis = new Redis({
      host: this.configService.redisHost,
      port: this.configService.redisPort,
      password: this.configService.redisPassword,
      db: this.configService.redisDb,
      keyPrefix: 'matching:',
      lazyConnect: true,
    });
  }

  async getWorkerMatches(workerId: string): Promise<CachedMatchScore[] | null> {
    const key = `worker:${workerId}`;
    const cached = await this.redis.get(key);
    if (!cached) return null;
    return JSON.parse(cached) as CachedMatchScore[];
  }

  async setWorkerMatches(workerId: string, matches: CachedMatchScore[]): Promise<void> {
    if (matches.length === 0) return;
    const sorted = [...matches].sort((a, b) => b.totalScore - a.totalScore).slice(0, CACHE_LIMIT);
    const key = `worker:${workerId}`;
    const cacheData: CachedMatchScore[] = sorted.map(m => ({
      ...m,
      cachedAt: new Date().toISOString(),
    }));
    await this.redis.setex(key, CACHE_TTL, JSON.stringify(cacheData));
  }

  async invalidateWorkerCache(workerId: string): Promise<void> {
    const key = `worker:${workerId}`;
    await this.redis.del(key);
  }

  async getVacancyMatches(vacancyId: string): Promise<CachedMatchScore[] | null> {
    const key = `vacancy:${vacancyId}`;
    const cached = await this.redis.get(key);
    if (!cached) return null;
    return JSON.parse(cached) as CachedMatchScore[];
  }

  async setVacancyMatches(vacancyId: string, matches: CachedMatchScore[]): Promise<void> {
    if (matches.length === 0) return;
    const sorted = [...matches].sort((a, b) => b.totalScore - a.totalScore).slice(0, CACHE_LIMIT);
    const key = `vacancy:${vacancyId}`;
    const cacheData: CachedMatchScore[] = sorted.map(m => ({
      ...m,
      cachedAt: new Date().toISOString(),
    }));
    await this.redis.setex(key, CACHE_TTL, JSON.stringify(cacheData));
  }

  async invalidateVacancyCache(vacancyId: string): Promise<void> {
    const key = `vacancy:${vacancyId}`;
    await this.redis.del(key);
  }

  async acquireLock(key: string, owner: string): Promise<boolean> {
    const lockKey = `lock:${key}`;
    const result = await this.redis.set(lockKey, owner, 'EX', LOCK_TTL, 'NX');
    return result === 'OK';
  }

  async releaseLock(key: string, owner: string): Promise<void> {
    const lockKey = `lock:${key}`;
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await this.redis.eval(script, 1, lockKey, owner);
  }

  async getOrSetWorkerCache(
    workerId: string,
    owner: string,
    fetcher: () => Promise<CachedMatchScore[]>,
  ): Promise<CachedMatchScore[]> {
    const cached = await this.getWorkerMatches(workerId);
    if (cached) return cached;

    for (let attempts = 0; attempts < LOCK_MAX_RETRIES; attempts++) {
      const lockAcquired = await this.acquireLock(`worker:${workerId}`, owner);

      if (lockAcquired) {
        try {
          const doubleCheck = await this.getWorkerMatches(workerId);
          if (doubleCheck) return doubleCheck;

          const matches = await fetcher();
          await this.setWorkerMatches(workerId, matches);
          return matches;
        } finally {
          await this.releaseLock(`worker:${workerId}`, owner);
        }
      }

      await this.sleep(LOCK_RETRY_DELAY);
      const retryCached = await this.getWorkerMatches(workerId);
      if (retryCached) return retryCached;
    }

    return await fetcher();
  }

  async getOrSetVacancyCache(
    vacancyId: string,
    owner: string,
    fetcher: () => Promise<CachedMatchScore[]>,
  ): Promise<CachedMatchScore[]> {
    const cached = await this.getVacancyMatches(vacancyId);
    if (cached) return cached;

    for (let attempts = 0; attempts < LOCK_MAX_RETRIES; attempts++) {
      const lockAcquired = await this.acquireLock(`vacancy:${vacancyId}`, owner);

      if (lockAcquired) {
        try {
          const doubleCheck = await this.getVacancyMatches(vacancyId);
          if (doubleCheck) return doubleCheck;

          const matches = await fetcher();
          await this.setVacancyMatches(vacancyId, matches);
          return matches;
        } finally {
          await this.releaseLock(`vacancy:${vacancyId}`, owner);
        }
      }

      await this.sleep(LOCK_RETRY_DELAY);
      const retryCached = await this.getVacancyMatches(vacancyId);
      if (retryCached) return retryCached;
    }

    return await fetcher();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}

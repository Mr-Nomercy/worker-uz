import { Injectable, OnModuleDestroy, Logger, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class RedisService implements OnModuleDestroy, OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;
  private isConnected = false;
  private shuttingDown = false;
  private connectionAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor(private readonly configService: AppConfigService) {
    this.client = new Redis({
      host: configService.redisHost,
      port: configService.redisPort,
      password: configService.redisPassword || undefined,
      db: configService.redisDb,
      keyPrefix: configService.redisKeyPrefix,
      lazyConnect: true,
      maxRetriesPerRequest: configService.redisMaxRetries,
      retryStrategy: this.retryStrategy.bind(this),
      reconnectOnError: (err: Error) => this.reconnectOnError(err) as unknown as boolean,
      enableReadyCheck: true,
      enableOfflineQueue: true,
      connectTimeout: configService.redisConnectTimeout,
      commandTimeout: configService.redisCommandTimeout,
    });

    this.setupEventListeners();
    this.connectWithRetry();
  }

  private setupEventListeners(): void {
    this.client.on('connect', () => {
      this.isConnected = true;
      this.connectionAttempts = 0;
      this.logger.log('Redis client connected');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      this.logger.log('Redis client ready');
    });

    this.client.on('close', () => {
      this.isConnected = false;
      this.logger.warn('Redis connection closed');
    });

    this.client.on('error', (err) => {
      this.logger.error({ err, isConnected: this.isConnected }, 'Redis client error');
    });

    this.client.on('reconnecting', () => {
      this.connectionAttempts++;
      this.logger.log(`Redis reconnecting (attempt ${this.connectionAttempts}/${this.maxReconnectAttempts})`);
    });

    this.client.on('end', () => {
      this.isConnected = false;
      this.logger.log('Redis client connection ended');
    });
  }

  private retryStrategy(times: number): number | null {
    if (this.shuttingDown) {
      return null;
    }

    if (times > this.maxReconnectAttempts) {
      this.logger.error(`Redis max reconnect attempts (${this.maxReconnectAttempts}) reached`);
      return null;
    }

    const delay = Math.min(times * 200, 5000);
    this.logger.log(`Redis retry in ${delay}ms (attempt ${times})`);
    return delay;
  }

  private async reconnectOnError(err: Error): Promise<boolean> {
    const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
    const shouldReconnect = targetErrors.some((e) => err.message.includes(e));

    if (shouldReconnect) {
      this.logger.warn({ err }, 'Redis reconnecting due to error');
    }

    return shouldReconnect;
  }

  private async connectWithRetry(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      this.logger.error({ error: String(error) }, 'Failed to connect to Redis');
    }
  }

  async onModuleDestroy() {
    this.shuttingDown = true;
  }

  async onApplicationShutdown() {
    this.logger.log('Disconnecting Redis client');
    await this.client.quit();
    this.logger.log('Redis client disconnected');
  }

  async ping(): Promise<boolean> {
    if (!this.isConnected || this.shuttingDown) {
      return false;
    }

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  isHealthy(): boolean {
    return this.isConnected && !this.shuttingDown;
  }

  getConnectionStatus(): string {
    if (this.shuttingDown) return 'shutting_down';
    if (this.isConnected) return 'connected';
    return 'disconnected';
  }

  getClient(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setex(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async expire(key: string, ttl: number): Promise<void> {
    await this.client.expire(key, ttl);
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    return this.client.zadd(key, score, member);
  }

  async zrangebyscore(
    key: string,
    min: number,
    max: number,
    limit?: number,
    offset?: number,
  ): Promise<string[]> {
    if (limit !== undefined && offset !== undefined) {
      return this.client.zrangebyscore(key, min, max, 'LIMIT', offset, limit);
    }
    return this.client.zrangebyscore(key, min, max);
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    return this.client.zrem(key, ...members);
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: NestConfigService) {}

  get nodeEnv(): string {
    return this.configService.get<string>('app.nodeEnv', 'development');
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  get port(): number {
    return this.configService.get<number>('app.port', 3000);
  }

  get apiPrefix(): string {
    return this.configService.get<string>('app.apiPrefix', 'api');
  }

  get requestIdHeader(): string {
    return this.configService.get<string>('app.requestIdHeader', 'x-request-id');
  }

  get corsOrigins(): string[] {
    return this.configService.get<string[]>('app.corsOrigins', ['http://localhost:3000']);
  }

  get rateLimitWindowMs(): number {
    return this.configService.get<number>('app.rateLimitWindowMs', 60000);
  }

  get rateLimitMaxRequests(): number {
    return this.configService.get<number>('app.rateLimitMaxRequests', 100);
  }

  get databaseUrl(): string {
    return this.configService.get<string>('database.url', '');
  }

  get redisHost(): string {
    return this.configService.get<string>('redis.host', 'localhost');
  }

  get redisPort(): number {
    return this.configService.get<number>('redis.port', 6379);
  }

  get redisPassword(): string | undefined {
    return this.configService.get<string>('redis.password');
  }

  get redisDb(): number {
    return this.configService.get<number>('redis.db', 0);
  }

  get redisKeyPrefix(): string {
    return this.configService.get<string>('redis.keyPrefix', 'worker:');
  }

  get redisMaxRetries(): number {
    return this.configService.get<number>('redis.maxRetries', 3);
  }

  get redisConnectTimeout(): number {
    return this.configService.get<number>('redis.connectTimeout', 10000);
  }

  get redisCommandTimeout(): number {
    return this.configService.get<number>('redis.commandTimeout', 5000);
  }
}

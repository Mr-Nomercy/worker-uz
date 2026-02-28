import { Injectable, OnModuleInit, OnModuleDestroy, Logger, OnApplicationShutdown } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown {
  private readonly logger = new Logger(PrismaService.name);
  private readonly maxRetries = 5;
  private readonly retryDelay = 2000;
  private isConnected = false;
  private shuttingDown = false;

  constructor(private readonly configService: AppConfigService) {
    super({
      datasources: {
        db: {
          url: configService.databaseUrl,
        },
      },
      log: [
        { level: 'query', emit: 'event' },
        { level: 'info', emit: 'event' },
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
    });
  }

  async onModuleInit() {
    this.logger.log('Initializing Prisma Client');
    this.setupEventListeners();
    this.setupMiddlewares();
    await this.connectWithRetry();
    await this.enableShutdownHooks();
  }

  private setupMiddlewares(): void {
    this.$use(async (params, next) => {
      const start = Date.now();
      const result = await next(params);
      const duration = Date.now() - start;

      if (duration > 300) {
        const modelName = params.model || 'RAW';
        this.logger.warn(`Slow query detected: [${modelName}.${params.action}] took ${duration}ms`);
      }

      return result;
    });
  }

  async onModuleDestroy() {
    this.shuttingDown = true;
  }

  async onApplicationShutdown() {
    this.logger.log('Shutting down Prisma Client');
    await this.$disconnect();
    this.logger.log('Prisma Client disconnected');
  }

  private setupEventListeners(): void {
    this.$on(Prisma.LogLevel.error, (e) => {
      this.logger.error({
        timestamp: e.timestamp,
        message: e.message,
      }, 'Prisma Query Error');
    });

    this.$on(Prisma.LogLevel.warn, (e) => {
      this.logger.warn({
        timestamp: e.timestamp,
        message: e.message,
      }, 'Prisma Query Warning');
    });

    this.$on(Prisma.LogLevel.info, (e) => {
      this.logger.debug({
        timestamp: e.timestamp,
        message: e.message,
      }, 'Prisma Query Info');
    });
  }

  private async connectWithRetry(): Promise<void> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.logger.log(`Attempting to connect to database (attempt ${attempt}/${this.maxRetries})`);
        await this.$connect();
        this.isConnected = true;
        this.logger.log('Prisma Client connected successfully');
        return;
      } catch (error) {
        this.logger.error(
          { attempt, maxRetries: this.maxRetries, error: String(error) },
          `Failed to connect to database (attempt ${attempt}/${this.maxRetries})`,
        );

        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * attempt;
          this.logger.log(`Retrying in ${delay}ms...`);
          await this.delay(delay);
        }
      }
    }

    this.logger.error('Failed to connect to database after all retries');
    throw new Error('Database connection failed after max retries');
  }

  private async enableShutdownHooks(): Promise<void> {
    this.$on('beforeExit', async () => {
      this.logger.log('Prisma received beforeExit event');
      this.shuttingDown = true;
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async isHealthy(): Promise<boolean> {
    if (!this.isConnected || this.shuttingDown) {
      return false;
    }

    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}

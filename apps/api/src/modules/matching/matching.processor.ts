import { Injectable, Logger, OnModuleInit, OnModuleDestroy, OnApplicationShutdown } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { MatchingRedisService } from './matching-redis.service';
import { MatchingService } from './matching.service';
import {
  MATCHING_QUEUE_NAME,
  JobTypes,
  MatchingJobDefaults,
  MatchingJobData,
} from './matching.constants';

@Injectable()
export class MatchingProcessor implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown {
  private readonly logger = new Logger(MatchingProcessor.name);
  private readonly worker: Worker;
  private isClosing = false;

  constructor(
    private readonly matchingRedisService: MatchingRedisService,
    private readonly matchingService: MatchingService,
  ) {
    this.worker = new Worker<MatchingJobData>(
      MATCHING_QUEUE_NAME,
      (job: Job<MatchingJobData>) => this.processJob(job),
      {
        connection: matchingRedisService.createClient('client') as any,
        concurrency: MatchingJobDefaults.CONCURRENCY,
        removeOnComplete: {
          age: 3600,
          count: 1000,
        },
        removeOnFail: {
          age: 86400,
          count: 5000,
        },
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed: ${err.message}`);
    });

    this.worker.on('error', (err) => {
      this.logger.error(`Worker error: ${err.message}`);
    });
  }

  async onModuleInit() {
    this.logger.log(
      `Matching processor started with concurrency ${MatchingJobDefaults.CONCURRENCY}`,
    );
  }

  async onModuleDestroy() {
    this.isClosing = true;
  }

  async onApplicationShutdown() {
    if (!this.isClosing) this.isClosing = true;
    await this.worker.close();
    this.logger.log('Matching processor stopped');
  }

  private async processJob(job: Job<MatchingJobData>): Promise<void> {
    this.logger.log(`Processing job ${job.id}, type: ${job.name}`);

    if (job.name === JobTypes.RECALC_WORKER) {
      if (!job.data.workerId) {
        throw new Error('workerId is required for recalc-worker job');
      }
      const result = await this.matchingService.recalcForWorker(job.data.workerId);
      this.logger.log(
        `Recalculated ${result.calculated} matches for worker ${job.data.workerId}`,
      );
    } else if (job.name === JobTypes.RECALC_VACANCY) {
      if (!job.data.vacancyId) {
        throw new Error('vacancyId is required for recalc-vacancy job');
      }
      const result = await this.matchingService.recalcForVacancy(job.data.vacancyId);
      this.logger.log(
        `Recalculated ${result.calculated} matches for vacancy ${job.data.vacancyId}`,
      );
    } else {
      throw new Error(`Unknown job type: ${job.name}`);
    }
  }
}

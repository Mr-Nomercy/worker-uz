import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue, JobsOptions } from 'bullmq';
import { MatchingRedisService } from './matching-redis.service';
import {
  MATCHING_QUEUE_NAME,
  JobTypes,
  MatchingJobDefaults,
} from './matching.constants';

export interface MatchingJobData {
  workerId?: string;
  vacancyId?: string;
}

@Injectable()
export class MatchingQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(MatchingQueueService.name);
  private readonly queue: Queue;
  private isClosing = false;

  constructor(private readonly matchingRedisService: MatchingRedisService) {
    this.queue = new Queue(MATCHING_QUEUE_NAME, {
      connection: matchingRedisService.createClient('client') as any,
      defaultJobOptions: {
        removeOnComplete: {
          age: 3600,
          count: 1000,
        },
        removeOnFail: {
          age: 86400,
          count: 5000,
        },
      },
    });
  }

  async addRecalcWorkerJob(workerId: string): Promise<string> {
    const jobId = `worker-${workerId}`;
    const existingJob = await this.queue.getJob(jobId);
    if (existingJob) {
      const state = await this.getJobStatus(jobId);
      if (state !== 'not_found' && state !== 'completed' && state !== 'failed') {
        this.logger.warn(`Job ${jobId} already exists with status: ${state}`);
        return jobId;
      }
    }

    const job = await this.queue.add(
      JobTypes.RECALC_WORKER,
      { workerId } as MatchingJobData,
      this.createJobOptions(jobId),
    );
    this.logger.log(`Added recalc-worker job for worker ${workerId}, jobId: ${job.id}`);
    return job.id!;
  }

  async addRecalcVacancyJob(vacancyId: string): Promise<string> {
    const jobId = `vacancy-${vacancyId}`;
    const existingJob = await this.queue.getJob(jobId);
    if (existingJob) {
      const state = await this.getJobStatus(jobId);
      if (state !== 'not_found' && state !== 'completed' && state !== 'failed') {
        this.logger.warn(`Job ${jobId} already exists with status: ${state}`);
        return jobId;
      }
    }

    const job = await this.queue.add(
      JobTypes.RECALC_VACANCY,
      { vacancyId } as MatchingJobData,
      this.createJobOptions(jobId),
    );
    this.logger.log(`Added recalc-vacancy job for vacancy ${vacancyId}, jobId: ${job.id}`);
    return job.id!;
  }

  private createJobOptions(jobId: string): JobsOptions {
    return {
      jobId,
      attempts: MatchingJobDefaults.MAX_RETRIES,
      backoff: {
        type: 'exponential',
        delay: MatchingJobDefaults.RETRY_DELAY,
      },
      removeOnComplete: {
        age: 3600,
        count: 1000,
      },
      removeOnFail: {
        age: 86400,
        count: 5000,
      },
    };
  }

  async getJobStatus(jobId: string): Promise<string> {
    const job = await this.queue.getJob(jobId);
    if (!job) return 'not_found';
    const isCompleted = await job.isCompleted();
    if (isCompleted) return 'completed';
    const isFailed = await job.isFailed();
    if (isFailed) return 'failed';
    const isDelayed = await job.isDelayed();
    if (isDelayed) return 'delayed';
    const isActive = await job.isActive();
    if (isActive) return 'processing';
    return 'waiting';
  }

  async close(): Promise<void> {
    if (this.isClosing) return;
    this.isClosing = true;
    await this.queue.close();
    this.logger.log('Matching queue closed');
  }

  async onModuleDestroy() {
    await this.close();
  }
}

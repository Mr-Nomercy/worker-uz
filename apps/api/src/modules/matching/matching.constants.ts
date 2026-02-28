export const MATCHING_QUEUE_NAME = 'matching-queue';

export const JobTypes = {
  RECALC_WORKER: 'recalc-worker',
  RECALC_VACANCY: 'recalc-vacancy',
} as const;

export type JobType = (typeof JobTypes)[keyof typeof JobTypes];

export interface MatchingJobData {
  workerId?: string;
  vacancyId?: string;
}

export const MatchingJobDefaults = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 5000,
  CONCURRENCY: 2,
} as const;

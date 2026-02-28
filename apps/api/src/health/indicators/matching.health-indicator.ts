import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IHealthIndicator, HealthCheckResult } from '../interfaces/health-indicator.interface';

@Injectable()
export class MatchingHealthIndicator implements IHealthIndicator {
    private readonly logger = new Logger(MatchingHealthIndicator.name);

    constructor(@InjectQueue('matching') private readonly matchingQueue: Queue) { }

    async check(): Promise<HealthCheckResult> {
        const startTime = Date.now();

        try {
            // Get counts for specified job states
            const counts = await this.matchingQueue.getJobCounts('waiting', 'active', 'failed');
            const responseTime = Date.now() - startTime;

            const backlog = (counts.waiting || 0) + (counts.active || 0);
            const isDegraded = backlog > 1000;

            return {
                name: 'matching-queue',
                status: isDegraded ? 'degraded' : 'healthy',
                responseTime,
                metadata: {
                    queueCounts: counts,
                    backlog,
                },
            };
        } catch (error) {
            const responseTime = Date.now() - startTime;
            this.logger.error(`Matching health check failed: ${error.message}`);

            return {
                name: 'matching-queue',
                status: 'unhealthy',
                responseTime,
                metadata: { error: String(error) },
            };
        }
    }
}

import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { IHealthIndicator, HealthCheckResult } from './interfaces/health-indicator.interface';
import { PrismaHealthIndicator } from './indicators/prisma.health-indicator';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';
import { GovHealthIndicator } from './indicators/gov.health-indicator';
import { MatchingHealthIndicator } from './indicators/matching.health-indicator';
import { ShutdownService } from '../common/shutdown/shutdown.service';

export interface GlobalHealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime: number;
    checks: Record<string, HealthCheckResult>;
}

export interface BuildMetadata {
    version: string;
    buildTimestamp: string;
    gitCommit: string;
    nodeVersion: string;
    uptimeSeconds: number;
}

@Injectable()
export class HealthService {
    private readonly indicators: IHealthIndicator[];
    private readonly timeoutMs = 200; // Hard limit for parallel check evaluation
    private readonly startupTimestamp = new Date().toISOString();
    private readonly appVersion: string;

    constructor(
        private readonly shutdownService: ShutdownService,
        prisma: PrismaHealthIndicator,
        redis: RedisHealthIndicator,
        gov: GovHealthIndicator,
        matching: MatchingHealthIndicator,
    ) {
        this.indicators = [prisma, redis, gov, matching];
        this.appVersion = this.loadAppVersion();
    }

    getBuildMetadata(): BuildMetadata {
        return {
            version: this.appVersion,
            buildTimestamp: process.env.BUILD_TIMESTAMP || this.startupTimestamp,
            gitCommit: process.env.GIT_COMMIT || 'unknown',
            nodeVersion: process.version,
            uptimeSeconds: Number(process.uptime().toFixed(2)),
        };
    }

    private loadAppVersion(): string {
        try {
            // Read version dynamically from package.json without hardcoding absolute paths
            const packagePath = join(process.cwd(), 'package.json');
            const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
            return pkg.version || '1.0.0';
        } catch {
            return process.env.npm_package_version || '1.0.0';
        }
    }

    async checkAll(): Promise<GlobalHealthStatus> {
        const globalStart = Date.now();

        if (this.shutdownService.isShuttingDown) {
            return {
                status: 'unhealthy',
                responseTime: Date.now() - globalStart,
                checks: {
                    shutdown: {
                        name: 'shutdown',
                        status: 'unhealthy',
                        responseTime: 0,
                        metadata: { message: 'Application is shutting down' }
                    }
                }
            };
        }

        // Execute all indicators strictly in parallel
        const results = await Promise.all(
            this.indicators.map((indicator) => this.runWithTimeout(indicator))
        );

        const checks: Record<string, HealthCheckResult> = {};
        let globalStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

        for (const res of results) {
            checks[res.name] = res;

            // Determine global severity mathematically
            if (res.status === 'unhealthy') {
                globalStatus = 'unhealthy';
            } else if (res.status === 'degraded' && globalStatus === 'healthy') {
                globalStatus = 'degraded';
            }
        }

        return {
            status: globalStatus,
            responseTime: Date.now() - globalStart,
            checks,
        };
    }

    private async runWithTimeout(indicator: IHealthIndicator): Promise<HealthCheckResult> {
        const start = Date.now();

        try {
            // Race the actual check against our strict 200ms latency protection wall
            return await Promise.race([
                indicator.check(),
                new Promise<HealthCheckResult>((_, reject) =>
                    setTimeout(() => reject(new Error('Health check timeout')), this.timeoutMs)
                )
            ]);
        } catch (error) {
            const duration = Date.now() - start;

            return {
                // Fallback name if check() crashed before generating a standard payload shape
                name: indicator.constructor.name.replace('HealthIndicator', '').toLowerCase(),
                status: 'degraded', // We fail open/degraded on timeouts to not falsely kill pods
                responseTime: duration,
                metadata: { error: error.message || String(error) }
            };
        }
    }
}

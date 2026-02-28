import { Injectable, Logger } from '@nestjs/common';
import { IHealthIndicator, HealthCheckResult } from '../interfaces/health-indicator.interface';
import { GovIntegrationService } from '../../modules/gov-integration/gov-integration.service';

@Injectable()
export class GovHealthIndicator implements IHealthIndicator {
    private readonly logger = new Logger(GovHealthIndicator.name);

    constructor(private readonly govService: GovIntegrationService) { }

    async check(): Promise<HealthCheckResult> {
        const startTime = Date.now();

        try {
            const circuitBreakerStatus = this.govService.getCircuitBreakerStatus();
            const responseTime = Date.now() - startTime;

            let hasOpenBreakers = false;
            for (const apiType in circuitBreakerStatus) {
                if (circuitBreakerStatus[apiType].isOpen) {
                    hasOpenBreakers = true;
                    break;
                }
            }

            // Gov integration failures shouldn't take down our app entirely, just mark as degraded
            return {
                name: 'gov-integration',
                status: hasOpenBreakers ? 'degraded' : 'healthy',
                responseTime,
                metadata: { circuitBreakers: circuitBreakerStatus },
            };
        } catch (error) {
            const responseTime = Date.now() - startTime;
            this.logger.error(`Gov health check failed: ${error.message}`);

            return {
                name: 'gov-integration',
                status: 'degraded',
                responseTime,
                metadata: { error: String(error) },
            };
        }
    }
}

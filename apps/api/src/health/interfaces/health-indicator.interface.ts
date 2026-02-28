export interface HealthCheckResult {
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime: number;
    metadata?: any;
}

export interface IHealthIndicator {
    check(): Promise<HealthCheckResult>;
}

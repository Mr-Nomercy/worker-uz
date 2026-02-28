import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';

export interface RateLimitOptions {
    limit: number;
    ttl: number; // in seconds
}

export const RateLimit = (limit: number, ttl: number) =>
    SetMetadata(RATE_LIMIT_KEY, { limit, ttl });

import {
    Injectable,
    CanActivate,
    ExecutionContext,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../../redis/redis.service';
import { RATE_LIMIT_KEY, RateLimitOptions } from '../decorators/rate-limit.decorator';
import { Request, Response } from 'express';

@Injectable()
export class RateLimitGuard implements CanActivate {
    private readonly logger = new Logger(RateLimitGuard.name);

    // Default global limit: 100 per minute per IP
    private readonly defaultLimit = 100;
    private readonly defaultTtl = 60;

    constructor(
        private readonly reflector: Reflector,
        private readonly redisService: RedisService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const ctx = context.switchToHttp();
        const req = ctx.getRequest<Request & { user?: any }>();
        const res = ctx.getResponse<Response>();



        const rule = this.reflector.getAllAndOverride<RateLimitOptions>(
            RATE_LIMIT_KEY,
            [context.getHandler(), context.getClass()],
        );

        const limit = rule?.limit || this.defaultLimit;
        const ttl = rule?.ttl || this.defaultTtl;

        const key = this.generateKey(context, req);

        try {
            const current = await this.increment(key, ttl);

            res.setHeader('X-RateLimit-Limit', limit.toString());
            res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - current).toString());

            if (current > limit) {
                throw new HttpException(
                    'Too Many Requests',
                    HttpStatus.TOO_MANY_REQUESTS,
                );
            }

            return true;
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            this.logger.warn(`Rate limit check failed (failing open): ${error.message}`);
            // Fail open if Redis throws unexpected error
            return true;
        }
    }

    private generateKey(context: ExecutionContext, req: Request & { user?: any }): string {
        const handler = context.getHandler().name;
        const className = context.getClass().name;

        // Extract real client IP
        let ip = req.socket?.remoteAddress || 'unknown';
        const forwardedFor = req.headers['x-forwarded-for'];
        if (forwardedFor) {
            if (typeof forwardedFor === 'string') {
                ip = forwardedFor.split(',')[0].trim();
            } else if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
                ip = forwardedFor[0].trim();
            }
        }

        let identifier = ip;

        // Check if user is authenticated (e.g. JWT)
        if (req.user && req.user.sub) {
            identifier = `user:${req.user.sub}`;
        } else {
            identifier = `ip:${identifier}`;
        }

        return `ratelimit:${className}:${handler}:${identifier}`;
    }

    private async increment(key: string, ttl: number): Promise<number> {
        const client = this.redisService.getClient();

        // Atomic execution to avoid race conditions in multi-instance setups
        const script = `
      local current = redis.call("INCR", KEYS[1])
      if current == 1 then
        redis.call("EXPIRE", KEYS[1], ARGV[1])
      end
      return current
    `;

        const result = await client.eval(script, 1, key, ttl);
        return result as number;
    }
}

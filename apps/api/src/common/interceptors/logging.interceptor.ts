import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AsyncLocalStorage } from 'async_hooks';

export const correlationIdStorage = new AsyncLocalStorage<string>();

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    const method = request.method;
    const path = request.originalUrl || request.url;
    const correlationId = request.correlationId || request.headers['x-request-id'] || 'unknown';

    // Calculate request body size if present
    const bodySize = request.headers['content-length']
      ? parseInt(request.headers['content-length'], 10)
      : undefined;

    const startTime = Date.now();

    // Wrap the request context in AsyncLocalStorage to propagate correlationId automatically
    return correlationIdStorage.run(correlationId, () => {
      return next.handle().pipe(
        tap({
          next: () => {
            this.logRequest(method, path, response.statusCode, startTime, correlationId, bodySize);
          },
          error: (error) => {
            const statusCode = error.status || error.statusCode || 500;
            this.logRequest(method, path, statusCode, startTime, correlationId, bodySize, error);
            // Re-throw so the exception filter can still process it natively
            throw error;
          }
        }),
      );
    });
  }

  private logRequest(
    method: string,
    path: string,
    statusCode: number,
    startTime: number,
    correlationId: string,
    bodySize?: number,
    error?: any
  ) {
    const durationMs = Date.now() - startTime;

    const logPayload: any = {
      correlationId,
      method,
      path,
      statusCode,
      durationMs,
    };

    if (bodySize !== undefined && !isNaN(bodySize)) {
      logPayload.bodySize = bodySize;
    }

    if (error) {
      logPayload.error = error.message || 'Internal Server Error';
    }

    if (statusCode >= 500) {
      this.logger.error(logPayload);
    } else if (statusCode >= 400 || durationMs > 500) {
      this.logger.warn(logPayload);
    } else {
      this.logger.log(logPayload);
    }
  }
}

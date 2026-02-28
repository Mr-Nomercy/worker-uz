import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4, validate as uuidValidate, version as uuidVersion } from 'uuid';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  private readonly logger = new Logger('CorrelationID');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    let correlationId = request.headers['x-request-id'] as string | undefined;

    if (!correlationId || !this.isValidUuid(correlationId)) {
      correlationId = uuidv4();
      this.logger.debug(`Generated new correlation ID: ${correlationId}`);
    }

    request.headers['x-request-id'] = correlationId;
    request.correlationId = correlationId;

    response.setHeader('X-Request-ID', correlationId);

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.log({
            correlationId,
            method: request.method,
            path: request.url,
            statusCode: response.statusCode,
            duration: `${duration}ms`,
          });
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error({
            correlationId,
            method: request.method,
            path: request.url,
            statusCode: response.statusCode,
            duration: `${duration}ms`,
            error: error.message,
          });
        },
      }),
    );
  }

  private isValidUuid(value: string): boolean {
    try {
      return uuidValidate(value);
    } catch {
      return false;
    }
  }
}

declare module 'express' {
  interface Request {
    correlationId?: string;
  }
}

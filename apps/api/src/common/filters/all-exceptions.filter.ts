import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AppConfigService } from '../../config/app-config.service';

interface ErrorResponse {
  success: false;
  requestId: string;
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>[];
    traceId: string;
  };
  meta: {
    version: string;
    timestamp: string;
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(
    private readonly loggerContext: Logger,
    private readonly configService: AppConfigService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = (request.headers['x-request-id'] as string) || uuidv4();
    const traceId = uuidv4();

    const isProduction = this.configService.isProduction;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'SERVER_INTERNAL_ERROR';
    let message = 'Internal server error';
    let details: Record<string, unknown>[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message = (responseObj.message as string) || exception.message;
        code = this.mapHttpStatusToCode(status, responseObj.error as string);
        
        if (Array.isArray(responseObj.message)) {
          details = responseObj.message.map((msg) => ({
            message: typeof msg === 'string' ? msg : String(msg),
          }));
        } else if (responseObj.message) {
          details = [{ message: String(responseObj.message) }];
        }
      } else {
        message = exceptionResponse as string;
        code = this.mapHttpStatusToCode(status);
      }
    } else if (exception instanceof Error) {
      message = isProduction ? 'Internal server error' : exception.message;
      
      this.loggerContext.error(
        {
          err: isProduction ? undefined : exception,
          requestId,
          traceId,
          path: request.url,
          method: request.method,
        },
        isProduction ? 'Internal server error' : exception.stack,
      );
    }

    const errorResponse: ErrorResponse = {
      success: false,
      requestId,
      error: {
        code,
        message,
        details,
        traceId,
      },
      meta: {
        version: '1.0',
        timestamp: new Date().toISOString(),
      },
    };

    response.status(status).setHeader('Content-Type', 'application/json');
    response.setHeader('X-Request-ID', requestId);
    response.setHeader('X-Trace-ID', traceId);

    response.send(errorResponse);
  }

  private mapHttpStatusToCode(status: number, existingCode?: string): string {
    if (existingCode) return existingCode;

    const codeMap: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
      [HttpStatus.UNAUTHORIZED]: 'AUTH_TOKEN_INVALID',
      [HttpStatus.FORBIDDEN]: 'AUTHZ_FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'RESOURCE_NOT_FOUND',
      [HttpStatus.CONFLICT]: 'RESOURCE_CONFLICT',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_ERROR',
      [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMIT_EXCEEDED',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'SERVER_INTERNAL_ERROR',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVER_UNAVAILABLE',
    };

    return codeMap[status] || `HTTP_${status}`;
  }
}

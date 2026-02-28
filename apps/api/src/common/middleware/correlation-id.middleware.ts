import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const existingId = req.headers['x-request-id'] as string;
    
    if (!existingId) {
      const correlationId = uuidv4();
      req.headers['x-request-id'] = correlationId;
      req.correlationId = correlationId;
    } else {
      req.correlationId = existingId;
    }

    res.setHeader('X-Request-ID', req.correlationId);

    next();
  }
}

declare module 'express' {
  interface Request {
    correlationId?: string;
  }
}

import { Request, Response, NextFunction } from 'express';

export function requestTimeoutMiddleware(req: Request, res: Response, next: NextFunction) {
    const timeoutLimit = 10000; // 10 seconds max

    res.setTimeout(timeoutLimit, () => {
        if (!res.headersSent) {
            res.status(408).json({
                statusCode: 408,
                message: 'Request Timeout',
                error: 'Timeout',
            });
            req.destroy();
        }
    });

    next();
}

import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError, RateLimitError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export function notFoundMiddleware(request: Request, response: Response): void {
    response.status(404).json({
        code: 'NOT_FOUND',
        message: `No ETMW Songs route exists for ${request.method} ${request.path}.`,
    });
}

export function errorMiddleware(
    error: unknown,
    _request: Request,
    response: Response,
    _next: NextFunction
): void {
    if (error instanceof RateLimitError) {
        response.set('Retry-After', String(error.retryAfterSeconds));
        response.status(error.status).json({ code: error.code, message: error.message });
        return;
    }

    if (error instanceof ApiError) {
        response.status(error.status).json({ code: error.code, message: error.message });
        return;
    }

    if (error instanceof ZodError) {
        response.status(400).json({
            code: 'VALIDATION_ERROR',
            message: error.issues[0]?.message ?? 'Please check the submitted information.',
            issues: error.issues.map(issue => ({
                path: issue.path.join('.'),
                message: issue.message,
            })),
        });
        return;
    }

    logger.error('http.unhandled_error', {
        message: error instanceof Error ? error.message : String(error),
    });
    response.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'ETMW Songs could not complete that request.',
    });
}

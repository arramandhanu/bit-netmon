import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Global exception filter.
 * - Hides stack traces in production
 * - Returns structured JSON errors
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const isProd = process.env.NODE_ENV === 'production';

        let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
        let message: string | string[] = 'Internal server error';
        let error = 'Internal Server Error';

        if (exception instanceof HttpException) {
            statusCode = exception.getStatus();
            const exRes = exception.getResponse();
            if (typeof exRes === 'object' && exRes !== null) {
                message = (exRes as any).message || exception.message;
                error = (exRes as any).error || exception.name;
            } else {
                message = String(exRes);
            }
        }

        const body: Record<string, any> = {
            statusCode,
            error,
            message,
            timestamp: new Date().toISOString(),
        };

        // Include stack trace only in development
        if (!isProd && exception instanceof Error) {
            body.stack = exception.stack;
        }

        response.status(statusCode).json(body);
    }
}

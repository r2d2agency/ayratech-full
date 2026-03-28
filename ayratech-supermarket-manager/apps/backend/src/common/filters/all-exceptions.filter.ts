import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { SystemLogsService } from '../../system-logs/system-logs.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly systemLogsService: SystemLogsService,
  ) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const request = ctx.getRequest();
    const path = httpAdapter.getRequestUrl(request);
    const method = httpAdapter.getRequestMethod(request);
    
    // Extract user info if available (depends on AuthGuard running before)
    const user = request.user; 
    const userId = user?.userId || user?.id || null;

    let message = 'Internal server error';
    let stack = '';
    let metadata: any = {};

    if (exception instanceof Error) {
      message = exception.message;
      stack = exception.stack;
    } else {
      message = JSON.stringify(exception);
    }

    if (exception instanceof HttpException) {
        const res: any = exception.getResponse();
        if (typeof res === 'object') {
            metadata = res;
            if (res.message) {
                message = Array.isArray(res.message) ? res.message.join(', ') : res.message;
            }
        }
    }
    
    // Determine log level
    const level = httpStatus >= 500 ? 'error' : 'warn';

    // Log to console
    if (httpStatus >= 500) {
        this.logger.error(`Exception caught: ${message}`, stack, `${method} ${path}`);
    } else {
        this.logger.warn(`Exception caught (${httpStatus}): ${message} - ${method} ${path}`);
    }

    // Save to DB (skip 404 to avoid noise, treat 401/403 as warn)
    // We can also skip stack trace for 4xx errors to save space
    if (httpStatus !== 404) { // Optionally skip 404
        try {
          await this.systemLogsService.create({
            level,
            message,
            stack: httpStatus >= 500 ? stack : undefined, // Only save stack for server errors
            context: `${method} ${path}`,
            userId,
            metadata: {
                statusCode: httpStatus,
                body: request.body,
                query: request.query,
                params: request.params,
                ...metadata
            },
          });
        } catch (logError) {
          console.error('Failed to save system log:', logError);
        }
    }

    const responseBody = {
      statusCode: httpStatus,
      timestamp: new Date().toISOString(),
      path: path,
      message: message,
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}

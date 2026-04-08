import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus, Logger
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let details: unknown;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exResponse = exception.getResponse();
      if (typeof exResponse === 'object') {
        message = (exResponse as any).message ?? message;
        code = (exResponse as any).error ?? exception.constructor.name.replace('Exception', '').toUpperCase();
        details = (exResponse as any).details;
      } else {
        message = exResponse as string;
      }
    } else {
      this.logger.error(`Unhandled exception: ${exception}`, (exception as any)?.stack);
    }

    response.status(statusCode).json({
      success: false,
      error: { code, message, statusCode, details },
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}

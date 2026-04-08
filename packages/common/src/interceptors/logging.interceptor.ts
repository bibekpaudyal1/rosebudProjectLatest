import {
  Injectable, NestInterceptor, ExecutionContext,
  CallHandler, Logger
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const { method, url } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          const status = context.switchToHttp().getResponse().statusCode;
          this.logger.log(`${method} ${url} ${status} +${ms}ms`);
        },
        error: (err: any) => {
          const ms = Date.now() - start;
          this.logger.error(`${method} ${url} ERROR +${ms}ms — ${err.message}`);
        },
      }),
    );
  }
}

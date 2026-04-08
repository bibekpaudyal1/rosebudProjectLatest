import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ApiResponse } from '@bazarbd/types';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data: any) => {
        // Allow services to bypass wrapping by returning { success, data } directly
        if (data && typeof data === 'object' && 'success' in data) return data;
        // Handle paginated results
        if (data && typeof data === 'object' && 'meta' in data && 'data' in data) {
          return { success: true, data: data.data, meta: data.meta };
        }
        return { success: true, data };
      }),
    );
  }
}

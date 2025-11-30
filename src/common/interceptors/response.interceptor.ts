import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { type Observable } from 'rxjs'
import { map } from 'rxjs/operators'

export interface Response<T> {
  data: T
}

/**
 * Global response interceptor that wraps all successful responses in a { data: ... } structure
 * This ensures consistency with error responses which are wrapped in { error: ... }
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<Response<T>> {
    return next.handle().pipe(
      map((data: T): Response<T> => {
        // If response is already wrapped in { data: ... }, don't double-wrap
        if (
          data &&
          typeof data === 'object' &&
          'data' in data &&
          Object.keys(data as object).length === 1
        ) {
          return data as Response<T>
        }
        // Wrap the response
        return { data }
      })
    )
  }
}

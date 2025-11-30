import { ExecutionContext, CallHandler } from '@nestjs/common'
import { of } from 'rxjs'
import { describe, it, expect } from 'vitest'
import { ResponseInterceptor } from './response.interceptor'

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor()
  const mockExecutionContext = {} as ExecutionContext

  it('should wrap simple data in { data: ... } structure', async () => {
    const mockCallHandler: CallHandler = {
      handle: () => of({ id: '123', name: 'Test' }),
    }

    const result = await new Promise((resolve) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: resolve,
      })
    })

    expect(result).toEqual({
      data: { id: '123', name: 'Test' },
    })
  })

  it('should wrap string data', async () => {
    const mockCallHandler: CallHandler = {
      handle: () => of('Hello World'),
    }

    const result = await new Promise((resolve) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: resolve,
      })
    })

    expect(result).toEqual({
      data: 'Hello World',
    })
  })

  it('should wrap array data', async () => {
    const mockCallHandler: CallHandler = {
      handle: () => of([1, 2, 3]),
    }

    const result = await new Promise((resolve) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: resolve,
      })
    })

    expect(result).toEqual({
      data: [1, 2, 3],
    })
  })

  it('should not double-wrap data already in { data: ... } format', async () => {
    const mockCallHandler: CallHandler = {
      handle: () => of({ data: 'Already wrapped' }),
    }

    const result = await new Promise((resolve) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: resolve,
      })
    })

    expect(result).toEqual({
      data: 'Already wrapped',
    })
  })

  it('should wrap object with data property if it has other properties', async () => {
    const mockCallHandler: CallHandler = {
      handle: () => of({ data: 'value', otherProp: 'other' }),
    }

    const result = await new Promise((resolve) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: resolve,
      })
    })

    expect(result).toEqual({
      data: { data: 'value', otherProp: 'other' },
    })
  })

  it('should handle null data', async () => {
    const mockCallHandler: CallHandler = {
      handle: () => of(null),
    }

    const result = await new Promise((resolve) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: resolve,
      })
    })

    expect(result).toEqual({
      data: null,
    })
  })

  it('should handle undefined data', async () => {
    const mockCallHandler: CallHandler = {
      handle: () => of(undefined),
    }

    const result = await new Promise((resolve) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: resolve,
      })
    })

    expect(result).toEqual({
      data: undefined,
    })
  })
})

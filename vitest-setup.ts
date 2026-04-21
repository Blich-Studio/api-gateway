import 'reflect-metadata'
import { vi } from 'vitest'

// vi.mocked is a passthrough type helper; polyfill for Bun + Vitest 4 environments
// where the injected global vi omits it
if (!(vi as any).mocked) {
  ;(vi as any).mocked = (fn: unknown) => fn
}

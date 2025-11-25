import type { ConfigService } from '@nestjs/config'
import { createClient } from '@supabase/supabase-js'
import { SupabaseService } from './supabase.service'

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}))

type SupabaseClientInstance = ReturnType<typeof createClient>

describe('SupabaseService', () => {
  const createClientMock = createClient as jest.MockedFunction<typeof createClient>
  const configService = {
    getOrThrow: jest.fn(),
  } as unknown as ConfigService

  beforeEach(() => {
    createClientMock.mockReset()
    ;(configService.getOrThrow as jest.Mock).mockReset()
  })

  it('initializes a Supabase client using service role credentials', () => {
    ;(configService.getOrThrow as jest.Mock).mockImplementation((key: string) => {
      if (key === 'supabaseUrl') {
        return 'https://supabase.local'
      }

      if (key === 'supabaseServiceRoleKey') {
        return 'service-role-key'
      }

      throw new Error(`Unexpected config key ${key}`)
    })

    const fakeClient = Symbol('supabase-client') as unknown as SupabaseClientInstance
    createClientMock.mockReturnValue(fakeClient)

    const service = new SupabaseService(configService)

    expect(createClientMock).toHaveBeenCalledWith('https://supabase.local', 'service-role-key', {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
    expect(service.getClient()).toBe(fakeClient)
  })
})

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient } from '@supabase/supabase-js'

type SupabaseClientInstance = ReturnType<typeof createClient>

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClientInstance

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.getOrThrow<string>('supabaseUrl')
    const serviceRoleKey = this.configService.getOrThrow<string>('supabaseServiceRoleKey')

    this.client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }

  getClient(): SupabaseClientInstance {
    return this.client
  }
}

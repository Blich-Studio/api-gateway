import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { AuthResponse } from '@supabase/supabase-js'
import { SupabaseService } from '../supabase/supabase.service'
import { USERS_SERVICE, type UsersServiceContract } from '../users/contracts/users-service.contract'
import type { CmsUser } from '../users/interfaces/cms-user.interface'
import type { UserRole } from './auth.types'
import type { AdminLoginDto } from './dto/admin-login.dto'

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(USERS_SERVICE) private readonly usersService: UsersServiceContract,
    private readonly jwtService: JwtService
  ) {}

  async login(credentials: AdminLoginDto) {
    const supabaseClient = this.supabaseService.getClient()
    const { data, error } = (await supabaseClient.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    })) as AuthResponse

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid email or password')
    }

    const cmsProfile = await this.usersService.findByExternalId(data.user.id)

    if (cmsProfile.role !== 'admin') {
      throw new ForbiddenException('Admin role required')
    }

    const resolvedEmail = this.resolveUserEmail(data.user.email, cmsProfile, credentials.email)

    const jwtPayload: { sub: string; role: UserRole; email?: string } = {
      sub: data.user.id,
      role: cmsProfile.role,
      email: resolvedEmail,
    }

    const accessToken = await this.jwtService.signAsync(jwtPayload)

    return {
      accessToken,
      user: {
        id: data.user.id,
        email: resolvedEmail,
        role: cmsProfile.role,
      },
    }
  }

  private resolveUserEmail(
    supabaseEmail: string | null | undefined,
    cmsProfile: CmsUser,
    fallback: string
  ): string {
    return supabaseEmail ?? cmsProfile.email ?? fallback
  }
}

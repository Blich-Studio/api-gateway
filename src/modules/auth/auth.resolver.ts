import { Inject, Logger, UnauthorizedException } from '@nestjs/common'
import { Args, Mutation, Resolver } from '@nestjs/graphql'
import { JwtService } from '@nestjs/jwt'
import type { AuthResponse } from '@supabase/supabase-js'
import { SupabaseService } from '../supabase/supabase.service'
import { USERS_SERVICE, type UsersServiceContract } from '../users/contracts/users-service.contract'
import type { CmsUser } from '../users/interfaces/cms-user.interface'
import type { UserRole } from './auth.types'
import { LoginUserInput } from './dto/login-user.input'
import { RegisterUserInput } from './dto/register-user.input'
import { AuthPayload } from './models/auth-payload.model'

@Resolver()
export class AuthResolver {
  private readonly logger = new Logger(AuthResolver.name)

  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(USERS_SERVICE) private readonly usersService: UsersServiceContract,
    private readonly jwtService: JwtService
  ) {}

  @Mutation(() => AuthPayload)
  async registerUser(@Args('input') input: RegisterUserInput): Promise<AuthPayload> {
    const supabaseClient = this.supabaseService.getClient()
    const { data, error } = await supabaseClient.auth.signUp({
      email: input.email,
      password: input.password,
    })

    if (error || !data.user) {
      throw new UnauthorizedException(error?.message ?? 'Registration failed')
    }

    const resolvedEmail = data.user.email ?? input.email

    const cmsProfile = await this.usersService.createUser({
      externalId: data.user.id,
      email: resolvedEmail,
      role: input.role,
      displayName: input.displayName,
    })

    await this.ensureRoleMetadata(data.user.id, input.role)

    return this.buildAuthPayload(
      data.user.id,
      resolvedEmail,
      cmsProfile.role,
      cmsProfile.displayName
    )
  }

  @Mutation(() => AuthPayload)
  async loginUser(@Args('input') input: LoginUserInput): Promise<AuthPayload> {
    const supabaseClient = this.supabaseService.getClient()
    const { data, error } = (await supabaseClient.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    })) as AuthResponse

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid email or password')
    }

    const cmsProfile = await this.usersService.findByExternalId(data.user.id)
    const metadataRole = this.getRoleFromMetadata(data.user)
    const resolvedEmail = this.resolveEmail(data.user.email, cmsProfile, input.email)
    const role = metadataRole ?? cmsProfile.role

    if (!metadataRole) {
      await this.ensureRoleMetadata(data.user.id, role)
    }

    return this.buildAuthPayload(data.user.id, resolvedEmail, role, cmsProfile.displayName)
  }

  private getRoleFromMetadata(
    user: AuthResponse['data']['user'] | undefined
  ): UserRole | undefined {
    const metadata = (user?.app_metadata ?? {}) as Record<string, unknown>
    const candidate = metadata.role
    return candidate === 'admin' || candidate === 'writer' || candidate === 'reader'
      ? candidate
      : undefined
  }

  private async ensureRoleMetadata(userId: string, role: UserRole): Promise<void> {
    const supabaseClient = this.supabaseService.getClient()
    try {
      const { error } = await supabaseClient.auth.admin.updateUserById(userId, {
        app_metadata: { role },
      })

      if (error) {
        throw error
      }
    } catch (error) {
      this.logger.warn(`Failed to sync role metadata for user ${userId}: ${String(error)}`)
    }
  }

  private async buildAuthPayload(
    userId: string,
    email: string,
    role: UserRole,
    displayName?: string
  ): Promise<AuthPayload> {
    const accessToken = await this.jwtService.signAsync({ sub: userId, email, role })

    return {
      accessToken,
      user: {
        id: userId,
        email,
        role,
        displayName,
      },
    }
  }

  private resolveEmail(
    supabaseEmail: string | null | undefined,
    cmsProfile: CmsUser,
    fallback: string
  ): string {
    return supabaseEmail ?? cmsProfile.email ?? fallback
  }
}

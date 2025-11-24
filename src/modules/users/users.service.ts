import { HttpService } from '@nestjs/axios'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { firstValueFrom } from 'rxjs'
import type { UserRole } from '../auth/auth.types'
import type { UsersServiceContract } from './contracts/users-service.contract'
import type { CreateUserDto } from './dto/create-user.dto'
import type { CmsUser } from './interfaces/cms-user.interface'

@Injectable()
export class UsersService implements UsersServiceContract {
  private readonly cmsApiUrl: string

  constructor(
    private readonly httpService: HttpService,
    configService: ConfigService
  ) {
    this.cmsApiUrl = configService.getOrThrow<string>('cmsApiUrl')
  }

  async createUser(payload: CreateUserDto): Promise<CmsUser> {
    const { data } = await firstValueFrom(
      this.httpService.post<CmsUser>(`${this.cmsApiUrl}/api/users`, {
        externalId: payload.externalId,
        email: payload.email,
        role: payload.role,
        displayName: payload.displayName,
      })
    )

    return data
  }

  async findByExternalId(externalId: string): Promise<CmsUser> {
    const { data } = await firstValueFrom(
      this.httpService.get<CmsUser>(`${this.cmsApiUrl}/api/users/${externalId}`)
    )

    return data
  }

  async getRoleForUser(externalId: string): Promise<UserRole> {
    const profile = await this.findByExternalId(externalId)
    return profile.role
  }

  isOwner(userId: string, ownerId: string): boolean {
    return userId === ownerId
  }

  hasRole(userRole: UserRole, allowed: UserRole | UserRole[]): boolean {
    return Array.isArray(allowed) ? allowed.includes(userRole) : userRole === allowed
  }
}

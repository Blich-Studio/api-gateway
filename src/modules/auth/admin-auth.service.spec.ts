import { ForbiddenException, UnauthorizedException } from '@nestjs/common'
import type { JwtService } from '@nestjs/jwt'
import type { SupabaseService } from '../supabase/supabase.service'
import type { UsersServiceContract } from '../users/contracts/users-service.contract'
import { AdminAuthService } from './admin-auth.service'

const createSupabaseServiceMock = () => {
  const supabaseClient = {
    auth: {
      signInWithPassword: jest.fn(),
    },
  }

  const serviceMock = {
    getClient: jest.fn(() => supabaseClient),
  }

  return {
    supabaseClient,
    service: serviceMock as unknown as SupabaseService,
    serviceMock,
  }
}

const createJwtServiceMock = () => {
  const mock = {
    signAsync: jest.fn(),
  }

  return {
    mock,
    service: mock as unknown as JwtService,
  }
}

const createUsersServiceMock = () => {
  const mock = {
    findByExternalId: jest.fn(),
  }

  return {
    mock,
    service: mock as unknown as UsersServiceContract,
  }
}

describe('AdminAuthService', () => {
  it('issues an access token for Supabase admins', async () => {
    const { service: supabaseService, supabaseClient } = createSupabaseServiceMock()
    const { mock: jwtMock, service: jwtService } = createJwtServiceMock()
    const { mock: usersMock, service: usersService } = createUsersServiceMock()

    supabaseClient.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'admin-user', email: 'admin@example.com' } },
      error: null,
    })

    usersMock.findByExternalId.mockResolvedValue({
      id: 'profile-admin',
      role: 'admin',
      email: 'admin@example.com',
    })
    jwtMock.signAsync.mockResolvedValue('gateway-jwt')

    const service = new AdminAuthService(supabaseService, usersService, jwtService)

    const result = await service.login({ email: 'admin@example.com', password: 'AdminPass123!' })

    expect(supabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'admin@example.com',
      password: 'AdminPass123!',
    })
    expect(usersMock.findByExternalId).toHaveBeenCalledWith('admin-user')
    expect(jwtMock.signAsync).toHaveBeenCalledWith({
      sub: 'admin-user',
      role: 'admin',
      email: 'admin@example.com',
    })
    expect(result).toEqual({
      accessToken: 'gateway-jwt',
      user: {
        id: 'admin-user',
        email: 'admin@example.com',
        role: 'admin',
      },
    })
  })

  it('throws UnauthorizedException for invalid Supabase credentials', async () => {
    const { service: supabaseService, supabaseClient } = createSupabaseServiceMock()
    const { mock: jwtMock, service: jwtService } = createJwtServiceMock()
    const { mock: usersMock, service: usersService } = createUsersServiceMock()

    supabaseClient.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid' },
    })

    const service = new AdminAuthService(supabaseService, usersService, jwtService)

    await expect(
      service.login({ email: 'admin@example.com', password: 'wrong-pass' })
    ).rejects.toBeInstanceOf(UnauthorizedException)
    expect(usersMock.findByExternalId).not.toHaveBeenCalled()
    expect(jwtMock.signAsync).not.toHaveBeenCalled()
  })

  it('throws ForbiddenException when CMS role is not admin', async () => {
    const { service: supabaseService, supabaseClient } = createSupabaseServiceMock()
    const { mock: jwtMock, service: jwtService } = createJwtServiceMock()
    const { mock: usersMock, service: usersService } = createUsersServiceMock()

    supabaseClient.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'writer-123', email: 'writer@example.com' } },
      error: null,
    })

    usersMock.findByExternalId.mockResolvedValue({
      id: 'profile-writer',
      role: 'writer',
      email: 'writer@example.com',
    })

    const service = new AdminAuthService(supabaseService, usersService, jwtService)

    await expect(
      service.login({ email: 'writer@example.com', password: 'WriterPass123!' })
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(jwtMock.signAsync).not.toHaveBeenCalled()
  })
})

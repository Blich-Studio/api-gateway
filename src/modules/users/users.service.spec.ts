import type { HttpService } from '@nestjs/axios'
import type { ConfigService } from '@nestjs/config'
import { of } from 'rxjs'
import { UsersService } from './users.service'

describe('UsersService', () => {
  const postMock = jest.fn()
  const getMock = jest.fn()

  const httpService = {
    post: postMock,
    get: getMock,
  } as unknown as HttpService

  const configService = {
    getOrThrow: jest.fn(() => 'http://cms.local'),
  } as unknown as ConfigService

  let service: UsersService

  beforeEach(() => {
    jest.clearAllMocks()
    postMock.mockReset()
    getMock.mockReset()
    ;(configService.getOrThrow as jest.Mock).mockReturnValue('http://cms.local')
    service = new UsersService(httpService, configService)
  })

  it('creates CMS users via POST /api/users', async () => {
    const cmsUser = { id: 'profile-1', role: 'writer' as const, email: 'writer@example.com' }
    postMock.mockReturnValue(of({ data: cmsUser }))

    const payload = {
      externalId: 'writer-1',
      email: 'writer@example.com',
      role: 'writer' as const,
      displayName: 'Writer One',
    }

    const result = await service.createUser(payload)

    expect(postMock).toHaveBeenCalledWith('http://cms.local/api/users', payload)
    expect(result).toEqual(cmsUser)
  })

  it('fetches CMS profiles via GET /api/users/:id', async () => {
    const cmsUser = { id: 'profile-2', role: 'admin' as const, email: 'admin@example.com' }
    getMock.mockReturnValue(of({ data: cmsUser }))

    const result = await service.findByExternalId('admin-123')

    expect(getMock).toHaveBeenCalledWith('http://cms.local/api/users/admin-123')
    expect(result).toEqual(cmsUser)
  })

  it('returns the stored role for a given user', async () => {
    const cmsUser = { id: 'profile-3', role: 'reader' as const }
    getMock.mockReturnValue(of({ data: cmsUser }))

    await expect(service.getRoleForUser('reader-999')).resolves.toBe('reader')
  })

  it('evaluates ownership and role helpers', () => {
    expect(service.isOwner('user-1', 'user-1')).toBe(true)
    expect(service.isOwner('user-1', 'user-2')).toBe(false)
    expect(service.hasRole('admin', 'admin')).toBe(true)
    expect(service.hasRole('writer', ['admin', 'writer'])).toBe(true)
    expect(service.hasRole('reader', ['admin', 'writer'])).toBe(false)
  })
})

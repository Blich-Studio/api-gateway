import { HttpService } from '@nestjs/axios'
import type { INestApplication } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { TestingModule } from '@nestjs/testing'
import { Test } from '@nestjs/testing'
import type { AxiosRequestHeaders, AxiosResponse } from 'axios'
import type { Server } from 'node:http'
import { of } from 'rxjs'
import request from 'supertest'
import { AppModule } from './../src/app.module'
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter'
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor'
import { SupabaseService } from './../src/modules/supabase/supabase.service'

interface HttpServiceMock {
  get: jest.Mock
  post: jest.Mock
  patch: jest.Mock
  delete: jest.Mock
}

interface SupabaseClientMock {
  auth: {
    signInWithPassword: jest.Mock
  }
}

interface SupabaseServiceMock {
  getClient: jest.Mock<SupabaseClientMock, []>
}

type UserRole = 'admin' | 'writer' | 'reader'

interface ApiResponse<T> {
  data: T
}

interface AdminLoginPayload {
  accessToken: string
  user: {
    id: string
    email: string
    role: UserRole
  }
}

interface MessageResponse {
  message: string
}

interface JwtPayload {
  sub: string
  role: UserRole
}

const mockAxiosResponse = <T>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {
    headers: {} as AxiosRequestHeaders,
  },
})

const SUPABASE_URL = 'https://supabase.local'
const CMS_API_URL = 'http://cms.local'
const SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'

const createHttpServiceMock = (): HttpServiceMock => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isServer = (value: unknown): value is Server =>
  isRecord(value) && typeof (value as { listen?: unknown }).listen === 'function'

const isUserPayload = (value: unknown): value is AdminLoginPayload['user'] =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.email === 'string' &&
  typeof value.role === 'string'

const isAdminLoginPayload = (value: unknown): value is AdminLoginPayload =>
  isRecord(value) && typeof value.accessToken === 'string' && isUserPayload(value.user)

const isJwtPayload = (value: unknown): value is JwtPayload =>
  isRecord(value) && typeof value.sub === 'string' && typeof value.role === 'string'

const isApiResponse = <T>(
  value: unknown,
  isData: (candidate: unknown) => candidate is T
): value is ApiResponse<T> => {
  if (!isRecord(value) || !('data' in value)) {
    return false
  }

  return isData((value as { data: unknown }).data)
}

const isMessageResponse = (value: unknown): value is MessageResponse =>
  isRecord(value) && typeof value.message === 'string'

const resolveHttpServer = (nestApp: INestApplication): Server => {
  const candidate: unknown = nestApp.getHttpServer()
  if (!isServer(candidate)) {
    throw new Error('Nest application did not return an HTTP server instance')
  }

  return candidate
}

describe('REST authentication & RBAC (e2e)', () => {
  let app: INestApplication
  let server: Server
  let jwtService: JwtService
  let httpServiceMock: HttpServiceMock
  let supabaseClientMock: SupabaseClientMock
  let supabaseServiceMock: SupabaseServiceMock

  const signToken = (role: UserRole, sub?: string) =>
    jwtService.sign({ sub: sub ?? `${role}-user`, role })

  beforeEach(async () => {
    process.env.SUPABASE_URL = SUPABASE_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = SUPABASE_SERVICE_ROLE_KEY
    process.env.CMS_API_URL = CMS_API_URL

    httpServiceMock = createHttpServiceMock()
    supabaseClientMock = {
      auth: {
        signInWithPassword: jest.fn(),
      },
    }
    supabaseServiceMock = {
      getClient: jest.fn(() => supabaseClientMock),
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HttpService)
      .useValue(httpServiceMock)
      .overrideProvider(SupabaseService)
      .useValue(supabaseServiceMock)
      .compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalFilters(new HttpExceptionFilter())
    app.useGlobalInterceptors(new TransformInterceptor())
    await app.init()
    server = resolveHttpServer(app)

    jwtService = moduleFixture.get<JwtService>(JwtService)
  })

  afterEach(async () => {
    await app.close()
    jest.clearAllMocks()
  })

  describe('Admin REST login', () => {
    it('should issue API gateway JWTs for admin users authenticated via Supabase', async () => {
      supabaseClientMock.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'admin-user', email: 'admin@example.com' },
          session: { access_token: 'supabase-admin-token' },
        },
        error: null,
      } as unknown)

      httpServiceMock.get.mockImplementation((url: string) => {
        if (url.includes('/api/users/admin-user')) {
          return of(mockAxiosResponse({ id: 'profile-admin', role: 'admin' }))
        }

        throw new Error(`Unexpected GET ${url}`)
      })

      const response = await request(server)
        .post('/admin/auth/login')
        .send({ email: 'admin@example.com', password: 'AdminPass123!' })
        .expect(200)

      expect(supabaseClientMock.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'admin@example.com',
        password: 'AdminPass123!',
      })

      const rawBody: unknown = response.body
      if (!isApiResponse(rawBody, isAdminLoginPayload)) {
        throw new Error('Expected admin login payload in response body')
      }

      const payload = rawBody.data

      expect(payload.user.role).toBe('admin')
      expect(payload.accessToken).toBeDefined()

      const decodedToken: unknown = jwtService.decode(payload.accessToken)
      if (!isJwtPayload(decodedToken)) {
        throw new Error('Expected JWT payload containing subject and role claims')
      }

      expect(decodedToken.sub).toBe('admin-user')
      expect(decodedToken.role).toBe('admin')
    })

    it('should reject REST admin login attempts for non-admin roles', async () => {
      supabaseClientMock.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'writer-777', email: 'writer@example.com' },
          session: { access_token: 'supabase-writer-token' },
        },
        error: null,
      } as unknown)

      httpServiceMock.get.mockImplementation((url: string) => {
        if (url.includes('/api/users/writer-777')) {
          return of(mockAxiosResponse({ id: 'profile-writer', role: 'writer' }))
        }

        throw new Error(`Unexpected GET ${url}`)
      })

      const response = await request(server)
        .post('/admin/auth/login')
        .send({ email: 'writer@example.com', password: 'WriterPass123!' })
        .expect(403)

      const rawBody: unknown = response.body
      if (!isMessageResponse(rawBody)) {
        throw new Error('Expected error response with message field')
      }

      expect(rawBody.message).toMatch(/admin role required/i)
    })
  })

  describe('Role-based access control for editorial routes', () => {
    it('allows admins to update any article', async () => {
      httpServiceMock.get.mockImplementation((url: string) => {
        if (url.includes('/api/articles/article-123')) {
          return of(mockAxiosResponse({ id: 'article-123', authorId: 'writer-xyz' }))
        }

        throw new Error(`Unexpected GET ${url}`)
      })

      httpServiceMock.patch.mockReturnValue(
        of(mockAxiosResponse({ id: 'article-123', title: 'Updated Title' }))
      )

      await request(server)
        .patch('/articles/article-123')
        .set('Authorization', `Bearer ${signToken('admin', 'admin-user')}`)
        .send({ title: 'Updated Title' })
        .expect(200)
    })

    it('prevents writers from updating articles they do not own', async () => {
      httpServiceMock.get.mockImplementation((url: string) => {
        if (url.includes('/api/articles/article-foreign')) {
          return of(mockAxiosResponse({ id: 'article-foreign', authorId: 'writer-other' }))
        }

        throw new Error(`Unexpected GET ${url}`)
      })

      await request(server)
        .patch('/articles/article-foreign')
        .set('Authorization', `Bearer ${signToken('writer', 'writer-123')}`)
        .send({ title: 'Unauthorized edit' })
        .expect(403)
    })

    it('allows writers to update only their own articles', async () => {
      httpServiceMock.get.mockImplementation((url: string) => {
        if (url.includes('/api/articles/article-owned')) {
          return of(mockAxiosResponse({ id: 'article-owned', authorId: 'writer-123' }))
        }

        throw new Error(`Unexpected GET ${url}`)
      })

      httpServiceMock.patch.mockReturnValue(
        of(mockAxiosResponse({ id: 'article-owned', title: 'Updated by owner' }))
      )

      await request(server)
        .patch('/articles/article-owned')
        .set('Authorization', `Bearer ${signToken('writer', 'writer-123')}`)
        .send({ title: 'Updated by owner' })
        .expect(200)
    })

    it('prevents readers from modifying articles entirely', async () => {
      httpServiceMock.get.mockImplementation((url: string) => {
        if (url.includes('/api/articles/article-reader')) {
          return of(mockAxiosResponse({ id: 'article-reader', authorId: 'writer-999' }))
        }

        throw new Error(`Unexpected GET ${url}`)
      })

      await request(server)
        .patch('/articles/article-reader')
        .set('Authorization', `Bearer ${signToken('reader', 'reader-123')}`)
        .send({ title: 'Reader edit attempt' })
        .expect(403)
    })

    it('allows readers to update only their own comments', async () => {
      httpServiceMock.get.mockImplementation((url: string) => {
        if (url.includes('/api/comments/comment-owned')) {
          return of(mockAxiosResponse({ id: 'comment-owned', userId: 'reader-123' }))
        }

        throw new Error(`Unexpected GET ${url}`)
      })

      httpServiceMock.patch.mockReturnValue(
        of(mockAxiosResponse({ id: 'comment-owned', content: 'Updated comment' }))
      )

      await request(server)
        .patch('/comments/comment-owned')
        .set('Authorization', `Bearer ${signToken('reader', 'reader-123')}`)
        .send({ content: 'Updated comment' })
        .expect(200)
    })

    it('prevents readers from updating comments they do not own', async () => {
      httpServiceMock.get.mockImplementation((url: string) => {
        if (url.includes('/api/comments/comment-foreign')) {
          return of(mockAxiosResponse({ id: 'comment-foreign', userId: 'reader-other' }))
        }

        throw new Error(`Unexpected GET ${url}`)
      })

      await request(server)
        .patch('/comments/comment-foreign')
        .set('Authorization', `Bearer ${signToken('reader', 'reader-123')}`)
        .send({ content: 'Attempted unauthorized comment update' })
        .expect(403)
    })

    it('allows admins to delete any tag', async () => {
      httpServiceMock.delete.mockReturnValue(of(mockAxiosResponse({ id: 'tag-1' })))

      await request(server)
        .delete('/tags/tag-1')
        .set('Authorization', `Bearer ${signToken('admin', 'admin-user')}`)
        .expect(200)
    })

    it('prevents writers from deleting tags they do not own', async () => {
      httpServiceMock.delete.mockReturnValue(of(mockAxiosResponse({ id: 'tag-1' })))

      await request(server)
        .delete('/tags/tag-1')
        .set('Authorization', `Bearer ${signToken('writer', 'writer-123')}`)
        .expect(403)
    })
  })
})

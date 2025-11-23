import { HttpService } from '@nestjs/axios'
import type { INestApplication } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { TestingModule } from '@nestjs/testing'
import { Test } from '@nestjs/testing'
import type { AxiosRequestHeaders, AxiosResponse } from 'axios'
import { of } from 'rxjs'
import request from 'supertest'
import { AppModule } from './../src/app.module'
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter'
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor'

interface HttpServiceMock {
  get: jest.Mock
  post: jest.Mock
  patch: jest.Mock
  delete: jest.Mock
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

describe('REST authentication & RBAC (e2e)', () => {
  let app: INestApplication
  let jwtService: JwtService
  let httpServiceMock: HttpServiceMock

  const signToken = (role: 'admin' | 'writer' | 'reader', sub?: string) =>
    jwtService.sign({ sub: sub ?? `${role}-user`, role })

  beforeEach(async () => {
    process.env.SUPABASE_URL = SUPABASE_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = SUPABASE_SERVICE_ROLE_KEY
    process.env.CMS_API_URL = CMS_API_URL

    httpServiceMock = createHttpServiceMock()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HttpService)
      .useValue(httpServiceMock)
      .compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalFilters(new HttpExceptionFilter())
    app.useGlobalInterceptors(new TransformInterceptor())
    await app.init()

    jwtService = moduleFixture.get<JwtService>(JwtService)
  })

  afterEach(async () => {
    await app.close()
    jest.clearAllMocks()
  })

  describe('Admin REST login', () => {
    it('should issue API gateway JWTs for admin users authenticated via Supabase', async () => {
      httpServiceMock.post.mockImplementation((url: string, data?: Record<string, unknown>) => {
        if (url === `${SUPABASE_URL}/auth/v1/token?grant_type=password`) {
          expect(data).toMatchObject({
            email: 'admin@example.com',
            password: 'AdminPass123!',
          })

          return of(
            mockAxiosResponse({
              access_token: 'supabase-admin-token',
              refresh_token: 'supabase-refresh-token',
              user: { id: 'admin-user', email: 'admin@example.com' },
            })
          )
        }

        throw new Error(`Unexpected POST ${url}`)
      })

      httpServiceMock.get.mockImplementation((url: string) => {
        if (url.includes('/api/users/admin-user')) {
          return of(mockAxiosResponse({ id: 'profile-admin', role: 'admin' }))
        }

        throw new Error(`Unexpected GET ${url}`)
      })

      const response = await request(app.getHttpServer())
        .post('/admin/auth/login')
        .send({ email: 'admin@example.com', password: 'AdminPass123!' })
        .expect(200)

      const payload = response.body.data as {
        accessToken: string
        user: { id: string; email: string; role: string }
      }

      expect(payload.user.role).toBe('admin')
      expect(payload.accessToken).toBeDefined()

      const decoded = jwtService.decode(payload.accessToken)
      expect(decoded).toBeTruthy()
      expect(decoded?.sub).toBe('admin-user')
      expect(decoded?.role).toBe('admin')
    })

    it('should reject REST admin login attempts for non-admin roles', async () => {
      httpServiceMock.post.mockImplementation((url: string) => {
        if (url === `${SUPABASE_URL}/auth/v1/token?grant_type=password`) {
          return of(
            mockAxiosResponse({
              access_token: 'supabase-writer-token',
              refresh_token: 'supabase-refresh-token',
              user: { id: 'writer-777', email: 'writer@example.com' },
            })
          )
        }

        throw new Error(`Unexpected POST ${url}`)
      })

      httpServiceMock.get.mockImplementation((url: string) => {
        if (url.includes('/api/users/writer-777')) {
          return of(mockAxiosResponse({ id: 'profile-writer', role: 'writer' }))
        }

        throw new Error(`Unexpected GET ${url}`)
      })

      const response = await request(app.getHttpServer())
        .post('/admin/auth/login')
        .send({ email: 'writer@example.com', password: 'WriterPass123!' })
        .expect(403)

      expect(response.body.message).toMatch(/admin role required/i)
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

      await request(app.getHttpServer())
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

      await request(app.getHttpServer())
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

      await request(app.getHttpServer())
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

      await request(app.getHttpServer())
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

      await request(app.getHttpServer())
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

      await request(app.getHttpServer())
        .patch('/comments/comment-foreign')
        .set('Authorization', `Bearer ${signToken('reader', 'reader-123')}`)
        .send({ content: 'Attempted unauthorized comment update' })
        .expect(403)
    })

    it('allows admins to delete any tag', async () => {
      httpServiceMock.delete.mockReturnValue(of(mockAxiosResponse({ id: 'tag-1' })))

      await request(app.getHttpServer())
        .delete('/tags/tag-1')
        .set('Authorization', `Bearer ${signToken('admin', 'admin-user')}`)
        .expect(200)
    })

    it('prevents writers from deleting tags they do not own', async () => {
      httpServiceMock.delete.mockReturnValue(of(mockAxiosResponse({ id: 'tag-1' })))

      await request(app.getHttpServer())
        .delete('/tags/tag-1')
        .set('Authorization', `Bearer ${signToken('writer', 'writer-123')}`)
        .expect(403)
    })
  })
})

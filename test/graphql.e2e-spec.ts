import { HttpService } from '@nestjs/axios'
import type { INestApplication } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { TestingModule } from '@nestjs/testing'
import { Test } from '@nestjs/testing'
import type { AxiosRequestHeaders, AxiosResponse } from 'axios'
import type { Server } from 'http'
import { of, throwError } from 'rxjs'
import request from 'supertest'
import { AppModule } from './../src/app.module'
import { SupabaseService } from './../src/modules/supabase/supabase.service'

interface HttpServiceMock {
  get: jest.Mock
  post: jest.Mock
  patch: jest.Mock
  delete: jest.Mock
}

interface SupabaseClientMock {
  auth: {
    signUp: jest.Mock
    signInWithPassword: jest.Mock
    admin: {
      updateUserById: jest.Mock
    }
  }
}

interface SupabaseServiceMock {
  getClient: jest.Mock<SupabaseClientMock, []>
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

const isJwtPayload = (value: unknown): value is { sub: string; role: string } =>
  typeof value === 'object' && value !== null && 'sub' in value && 'role' in value

describe('GraphQL (e2e)', () => {
  let app: INestApplication
  let jwtService: JwtService
  let httpServiceMock: HttpServiceMock
  let supabaseClientMock: SupabaseClientMock
  let supabaseServiceMock: SupabaseServiceMock

  beforeEach(async () => {
    process.env.SUPABASE_URL = SUPABASE_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = SUPABASE_SERVICE_ROLE_KEY
    process.env.CMS_API_URL = CMS_API_URL

    httpServiceMock = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    }
    supabaseClientMock = {
      auth: {
        signUp: jest.fn(),
        signInWithPassword: jest.fn(),
        admin: {
          updateUserById: jest.fn().mockResolvedValue({ data: null, error: null }),
        },
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
    await app.init()

    jwtService = moduleFixture.get<JwtService>(JwtService)
  })

  afterEach(async () => {
    await app.close()
    jest.clearAllMocks()
  })

  it('should fetch articles via GraphQL', () => {
    const articles = [
      {
        _id: '1',
        title: 'Test Article 1',
        content: 'Content 1',
        slug: 'test-article-1',
        perex: 'Perex 1',
        status: 'published',
        createdAt: 1234567890,
        updatedAt: 1234567890,
        authorId: '507f1f77bcf86cd799439011',
        tags: [],
      },
      {
        _id: '2',
        title: 'Test Article 2',
        content: 'Content 2',
        slug: 'test-article-2',
        perex: 'Perex 2',
        status: 'draft',
        createdAt: 1234567890,
        updatedAt: 1234567890,
        authorId: '507f1f77bcf86cd799439011',
        tags: [],
      },
    ]

    httpServiceMock.get.mockReturnValue(
      of(mockAxiosResponse({ data: articles }) as AxiosResponse<{ data: typeof articles }>)
    )

    return request(app.getHttpServer() as Server)
      .post('/graphql')
      .send({
        query: `
          query {
            articles {
              id
              title
              slug
              perex
              status
              createdAt
              updatedAt
            }
          }
        `,
      })
      .expect(200)
      .expect(res => {
        const body = res.body as {
          data: { articles: Array<{ title: string; slug: string; perex: string }> }
        }
        expect(body.data.articles).toBeDefined()
        expect(body.data.articles[0].title).toBe('Test Article 1')
        expect(body.data.articles[0].slug).toBe('test-article-1')
        expect(body.data.articles[0].perex).toBe('Perex 1')
      })
  })

  it('should fetch a single article by ID', () => {
    const article = {
      _id: '1',
      title: 'Test Article 1',
      content: 'Content 1',
      slug: 'test-article-1',
      perex: 'Perex 1',
      status: 'published',
      createdAt: 1234567890,
      updatedAt: 1234567890,
      authorId: '507f1f77bcf86cd799439011',
      tags: [],
    }

    httpServiceMock.get.mockReturnValue(of(mockAxiosResponse(article)))

    return request(app.getHttpServer() as Server)
      .post('/graphql')
      .send({
        query: `
          query {
            article(id: "1") {
              id
              title
              content
            }
          }
        `,
      })
      .expect(200)
      .expect(res => {
        const body = res.body as {
          data: { article: { title: string; id: string } }
        }
        expect(body.data.article).toBeDefined()
        expect(body.data.article.title).toBe('Test Article 1')
        expect(body.data.article.id).toBe('1')
      })
  })

  it('should handle CMS API errors gracefully', () => {
    httpServiceMock.get.mockReturnValue(throwError(() => new Error('CMS API Error')))

    return request(app.getHttpServer() as Server)
      .post('/graphql')
      .send({
        query: `
          query {
            articles {
              id
              title
            }
          }
        `,
      })
      .expect(200)
      .expect(res => {
        const body = res.body as { errors: unknown[] }
        expect(body.errors).toBeDefined()
      })
  })

  describe('Auth mutations', () => {
    it('registerUser should create a Supabase identity, persist the role, and issue a gateway JWT', async () => {
      const cmsUsersUrl = `${CMS_API_URL}/api/users`

      supabaseClientMock.auth.signUp.mockResolvedValue({
        data: {
          user: { id: 'user-123', email: 'writer@example.com' },
          session: {
            access_token: 'supabase-access-token',
            refresh_token: 'supabase-refresh-token',
          },
        },
        error: null,
      })

      httpServiceMock.post.mockImplementation((url: string, data?: Record<string, unknown>) => {
        if (url === cmsUsersUrl) {
          expect(data).toMatchObject({
            externalId: 'user-123',
            email: 'writer@example.com',
            role: 'writer',
          })

          return of(
            mockAxiosResponse({
              id: 'profile-789',
              role: 'writer',
            })
          )
        }

        throw new Error(`Unexpected POST ${url}`)
      })

      const mutation = `
        mutation RegisterWriter {
          registerUser(input: { email: "writer@example.com", password: "SecurePass123!", role: "writer" }) {
            accessToken
            user {
              id
              email
              role
            }
          }
        }
      `

      const response = await request(app.getHttpServer() as Server)
        .post('/graphql')
        .send({ query: mutation })

      expect(supabaseClientMock.auth.signUp).toHaveBeenCalledWith({
        email: 'writer@example.com',
        password: 'SecurePass123!',
      })
      expect(supabaseClientMock.auth.admin.updateUserById).toHaveBeenCalledWith('user-123', {
        app_metadata: { role: 'writer' },
      })

      expect(response.status).toBe(200)
      const payload = (
        response.body as {
          data: {
            registerUser: { accessToken: string; user: { id: string; email: string; role: string } }
          }
        }
      ).data.registerUser

      expect(payload.user).toEqual({ id: 'user-123', email: 'writer@example.com', role: 'writer' })
      expect(payload.accessToken).toBeDefined()

      const decoded: unknown = jwtService.decode(payload.accessToken)
      if (!isJwtPayload(decoded)) {
        throw new Error('Expected JWT payload to include sub and role claims')
      }
      expect(decoded.sub).toBe('user-123')
      expect(decoded.role).toBe('writer')
    })

    it('loginUser should authenticate against Supabase and embed role claims in the issued JWT', async () => {
      supabaseClientMock.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: 'writer-456',
            email: 'writer@example.com',
            app_metadata: { role: 'writer' },
          },
          session: {
            access_token: 'supabase-access-token',
            refresh_token: 'supabase-refresh-token',
          },
        },
        error: null,
      })

      httpServiceMock.get.mockImplementation((url: string) => {
        if (url.includes('/api/users/writer-456')) {
          return of(
            mockAxiosResponse({
              id: 'profile-456',
              role: 'writer',
            })
          )
        }

        throw new Error(`Unexpected GET ${url}`)
      })

      const mutation = `
        mutation LoginWriter {
          loginUser(input: { email: "writer@example.com", password: "SecurePass123!" }) {
            accessToken
            user {
              id
              email
              role
            }
          }
        }
      `

      const response = await request(app.getHttpServer() as Server)
        .post('/graphql')
        .send({ query: mutation })

      expect(supabaseClientMock.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'writer@example.com',
        password: 'SecurePass123!',
      })
      expect(supabaseClientMock.auth.admin.updateUserById).not.toHaveBeenCalled()

      expect(response.status).toBe(200)
      const payload = (
        response.body as {
          data: {
            loginUser: { accessToken: string; user: { id: string; email: string; role: string } }
          }
        }
      ).data.loginUser

      expect(payload.user).toEqual({
        id: 'writer-456',
        email: 'writer@example.com',
        role: 'writer',
      })
      expect(payload.accessToken).toBeDefined()

      const decoded: unknown = jwtService.decode(payload.accessToken)
      if (!isJwtPayload(decoded)) {
        throw new Error('Expected JWT payload to include sub and role claims')
      }
      expect(decoded.sub).toBe('writer-456')
      expect(decoded.role).toBe('writer')
    })
  })
})

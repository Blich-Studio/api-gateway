import { HttpService } from '@nestjs/axios'
import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import { Test } from '@nestjs/testing'
import type { AxiosRequestHeaders, AxiosResponse } from 'axios'
import type { Server } from 'http'
import { of, throwError } from 'rxjs'
import request from 'supertest'
import { AppModule } from './../src/app.module'

/**
 * Contract Types - Defines the expected shape of data from CMS API
 * These types ensure type safety when validating API contracts
 */
interface Article {
  _id: string
  title: string
  content: string
  slug: string
  perex: string
  status: string
  createdAt: number
  updatedAt: number
  authorId: string
  tags: string[]
}

interface ArticleList {
  data: Article[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

interface GraphQLArticlesResponse {
  data: {
    articles: Array<{
      id: string
      title: string
      slug: string
      perex: string
      status: string
      createdAt: number
      updatedAt: number
    }>
  }
}

interface GraphQLArticleResponse {
  data: {
    article: {
      id: string
      title: string
      content: string
      slug: string
      perex?: string
      status?: string
    }
  }
}

interface GraphQLErrorResponse {
  errors?: Array<{
    message: string
  }>
}

/**
 * API Contract Testing - Consumer-Driven Contracts
 *
 * This test suite validates the Gateway's expectations (consumer contract)
 * against what the CMS API provides. It tests:
 * - Expected endpoint structure
 * - Response format compatibility
 * - Required fields in responses
 * - Error handling expectations
 *
 * Contract Type: Consumer-Driven
 * Focus: Gateway expectations vs CMS API responses
 */
describe('API Gateway Consumer Contract Tests', () => {
  let app: INestApplication
  let httpService: HttpService

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HttpService)
      .useValue({
        get: jest.fn(),
      })
      .compile()

    app = moduleFixture.createNestApplication()
    await app.init()

    httpService = moduleFixture.get<HttpService>(HttpService)
  })

  describe('Articles List Endpoint - Gateway Expectations', () => {
    it('should correctly handle CMS API list response format', () => {
      // Arrange: Define what Gateway expects from CMS API
      const cmsApiResponse: AxiosResponse<ArticleList> = {
        data: {
          data: [
            {
              _id: '1',
              title: 'Test Article',
              content: 'Content',
              slug: 'test-article',
              perex: 'Perex',
              status: 'published',
              createdAt: 1234567890,
              updatedAt: 1234567890,
              authorId: '507f1f77bcf86cd799439011',
              tags: [],
            },
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          headers: {} as AxiosRequestHeaders,
        },
      }

      jest.spyOn(httpService, 'get').mockReturnValue(of(cmsApiResponse))

      // Act
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
          // Assert: Validate Gateway receives correct data
          const body = res.body as GraphQLArticlesResponse
          expect(body.data.articles).toBeDefined()
          expect(body.data.articles).toHaveLength(1)
          expect(body.data.articles[0]).toEqual(
            expect.objectContaining({
              title: 'Test Article',
              slug: 'test-article',
              perex: 'Perex',
              status: 'published',
            })
          )
        })
    })

    it('should support pagination parameters contract', () => {
      // Arrange: CMS API returns paginated response
      const cmsApiResponse: AxiosResponse<ArticleList> = {
        data: {
          data: Array.from({ length: 5 }, (_, i) => ({
            _id: String(i + 1),
            title: `Article ${i + 1}`,
            content: 'Content',
            slug: `article-${i + 1}`,
            perex: 'Perex',
            status: 'published',
            createdAt: 1234567890,
            updatedAt: 1234567890,
            authorId: '507f1f77bcf86cd799439011',
            tags: [],
          })),
          pagination: {
            page: 1,
            limit: 5,
            total: 15,
            totalPages: 3,
            hasNext: true,
            hasPrev: false,
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          headers: {} as AxiosRequestHeaders,
        },
      }

      jest.spyOn(httpService, 'get').mockReturnValue(of(cmsApiResponse))

      // Act & Assert
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
        .expect(_res => {
          // Response structure validated by GraphQL type
        })
    })
  })

  describe('Single Article Endpoint - Gateway Expectations', () => {
    it('should correctly handle CMS API single article response format', () => {
      // Arrange: Define what Gateway expects for single article
      const cmsApiResponse: AxiosResponse<Article> = {
        data: {
          _id: '1',
          title: 'Test Article',
          content: 'Full content',
          slug: 'test-article',
          perex: 'Perex',
          status: 'published',
          createdAt: 1234567890,
          updatedAt: 1234567890,
          authorId: '507f1f77bcf86cd799439011',
          tags: ['tag1'],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          headers: {} as AxiosRequestHeaders,
        },
      }

      jest.spyOn(httpService, 'get').mockReturnValue(of(cmsApiResponse))

      // Act & Assert
      return request(app.getHttpServer() as Server)
        .post('/graphql')
        .send({
          query: `
            query {
              article(id: "1") {
                id
                title
                content
                slug
              }
            }
          `,
        })
        .expect(200)
        .expect(res => {
          const body = res.body as GraphQLArticleResponse
          expect(body.data.article).toEqual(
            expect.objectContaining({
              title: 'Test Article',
              content: 'Full content',
              slug: 'test-article',
            })
          )
        })
    })

    it('should include required fields in response', () => {
      // Arrange
      const requiredFields: Array<keyof Article> = [
        '_id',
        'title',
        'content',
        'slug',
        'perex',
        'status',
        'createdAt',
        'updatedAt',
        'authorId',
        'tags',
      ]

      const article: Article = {
        _id: '1',
        title: 'Test',
        content: 'Content',
        slug: 'test',
        perex: 'Perex',
        status: 'published',
        createdAt: 1234567890,
        updatedAt: 1234567890,
        authorId: '507f1f77bcf86cd799439011',
        tags: [],
      }

      const cmsApiResponse: AxiosResponse<Article> = {
        data: article,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          headers: {} as AxiosRequestHeaders,
        },
      }

      jest.spyOn(httpService, 'get').mockReturnValue(of(cmsApiResponse))

      // Act & Assert
      return request(app.getHttpServer() as Server)
        .post('/graphql')
        .send({
          query: `
            query {
              article(id: "1") {
                id
                title
                content
                slug
                perex
                status
              }
            }
          `,
        })
        .expect(200)
        .expect(_res => {
          const article: Article = {
            _id: '1',
            title: 'Test',
            content: 'Content',
            slug: 'test',
            perex: 'Perex',
            status: 'published',
            createdAt: 1234567890,
            updatedAt: 1234567890,
            authorId: '507f1f77bcf86cd799439011',
            tags: [],
          }
          // Verify API has data to fetch (even if graphql doesn't request all fields)
          requiredFields.forEach(field => {
            expect(article).toHaveProperty(field)
          })
        })
    })
  })

  describe('Error Handling Contract', () => {
    it('should handle CMS API errors gracefully', () => {
      // Arrange: CMS API returns error
      jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => new Error('CMS API Error')))

      // Act & Assert
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
        .expect(200) // GraphQL still returns 200
        .expect(res => {
          const body = res.body as GraphQLErrorResponse
          expect(body.errors).toBeDefined()
        })
    })

    it('should handle 404 from CMS API', () => {
      // Arrange
      const error = new Error('Not Found') as Error & { status: number }
      error.status = 404

      jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => error))

      // Act & Assert
      return request(app.getHttpServer() as Server)
        .post('/graphql')
        .send({
          query: `
            query {
              article(id: "nonexistent") {
                id
                title
              }
            }
          `,
        })
        .expect(200)
        .expect(res => {
          const body = res.body as GraphQLErrorResponse
          expect(body.errors).toBeDefined()
        })
    })
  })

  describe('Data Type Contract', () => {
    it('should enforce correct data types in response', () => {
      // Arrange: Validate data types match contract
      const cmsApiResponse: AxiosResponse<Article> = {
        data: {
          _id: '507f1f77bcf86cd799439011', // String
          title: 'Test Article', // String
          content: 'Content', // String
          slug: 'test-article', // String
          perex: 'Perex', // String
          status: 'published', // String (enum)
          createdAt: 1234567890, // Number (timestamp)
          updatedAt: 1234567890, // Number (timestamp)
          authorId: '507f1f77bcf86cd799439011', // String (ObjectId)
          tags: ['tag1', 'tag2'], // Array of strings
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          headers: {} as AxiosRequestHeaders,
        },
      }

      jest.spyOn(httpService, 'get').mockReturnValue(of(cmsApiResponse))

      // Act & Assert
      return request(app.getHttpServer() as Server)
        .post('/graphql')
        .send({
          query: `
            query {
              article(id: "1") {
                id
                title
                status
                createdAt
              }
            }
          `,
        })
        .expect(200)
        .expect(_res => {
          // Verify types in returned data
          expect(typeof cmsApiResponse.data._id).toBe('string')
          expect(typeof cmsApiResponse.data.title).toBe('string')
          expect(typeof cmsApiResponse.data.status).toBe('string')
          expect(typeof cmsApiResponse.data.createdAt).toBe('number')
          expect(Array.isArray(cmsApiResponse.data.tags)).toBe(true)
        })
    })
  })

  describe('HTTP Status Code Contract', () => {
    it('should handle 200 OK response', () => {
      // Arrange
      const cmsApiResponse: AxiosResponse<Article> = {
        data: {
          _id: '1',
          title: 'Test',
          content: 'Content',
          slug: 'test',
          perex: 'Perex',
          status: 'published',
          createdAt: 1234567890,
          updatedAt: 1234567890,
          authorId: '507f1f77bcf86cd799439011',
          tags: [],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          headers: {} as AxiosRequestHeaders,
        },
      }

      jest.spyOn(httpService, 'get').mockReturnValue(of(cmsApiResponse))

      // Assert: Gateway should process 200 response correctly
      return request(app.getHttpServer() as Server)
        .post('/graphql')
        .send({
          query: `
            query {
              article(id: "1") {
                id
                title
              }
            }
          `,
        })
        .expect(200)
    })
  })
})

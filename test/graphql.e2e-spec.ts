import { HttpService } from '@nestjs/axios'
import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import { Test } from '@nestjs/testing'
import type { AxiosRequestHeaders, AxiosResponse } from 'axios'
import type { Server } from 'http'
import { of, throwError } from 'rxjs'
import request from 'supertest'
import { AppModule } from './../src/app.module'

describe('GraphQL (e2e)', () => {
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

    jest.spyOn(httpService, 'get').mockReturnValue(
      of({
        data: { data: articles }, // Assuming CMS API returns { data: [...] }
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          headers: {} as AxiosRequestHeaders,
        },
      } as AxiosResponse)
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

    jest.spyOn(httpService, 'get').mockReturnValue(
      of({
        data: article, // CMS API returns the object directly for getById
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          headers: {} as AxiosRequestHeaders,
        },
      } as AxiosResponse)
    )

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
    jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => new Error('CMS API Error')))

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
})

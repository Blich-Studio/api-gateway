/* eslint-disable @typescript-eslint/no-unsafe-argument */
import type { INestApplication } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { TestingModule } from '@nestjs/testing'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from './../src/app.module'
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter'
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor'

describe('AppController (e2e)', () => {
  let app: INestApplication
  let jwtService: JwtService

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()

    // Apply global interceptors and filters to match main.ts
    app.useGlobalFilters(new HttpExceptionFilter())
    app.useGlobalInterceptors(new TransformInterceptor())

    await app.init()

    jwtService = moduleFixture.get<JwtService>(JwtService)
  })

  it('/public (GET)', () => {
    return request(app.getHttpServer())
      .get('/public')
      .expect(200)
      .expect({ data: { message: 'This is public' } })
  })

  it('/profile (GET) - Unauthorized', () => {
    return request(app.getHttpServer()).get('/profile').expect(401)
  })

  it('/profile (GET) - Authorized', () => {
    const token = jwtService.sign({ sub: '123', username: 'testuser' })
    return request(app.getHttpServer())
      .get('/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({ data: { userId: '123', username: 'testuser' } })
  })
})

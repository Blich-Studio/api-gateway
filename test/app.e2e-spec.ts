import 'reflect-metadata'
import type { TestingModule } from '@nestjs/testing'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import type { Server } from 'http'
import request from 'supertest'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { AppModule } from './../src/app.module'

describe('AppController (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('/ (GET)', async () => {
    const response = await request(app.getHttpServer() as Server).get('/')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ data: 'Hello World!' })
  })
})

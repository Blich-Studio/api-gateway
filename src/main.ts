import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import helmet from 'helmet'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { TransformInterceptor } from './common/interceptors/transform.interceptor'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Security headers
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
      crossOriginOpenerPolicy: false,
      originAgentCluster: false,
    })
  )

  // Enable CORS
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3001',
      'http://localhost:5174',
      'https://studio.apollographql.com',
    ],
    credentials: true,
  })

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    })
  )

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter())

  // Global response interceptor
  app.useGlobalInterceptors(new TransformInterceptor())

  // API prefix
  app.setGlobalPrefix('api/v1')

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Blich Studio API Gateway')
    .setDescription('API Gateway for Blich Studio applications')
    .setVersion('1.0')
    .addBearerAuth()
    .build()
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/v1/docs', app, document)

  await app.listen(3000)
  console.log('🚀 Blich Studio API Gateway running on http://localhost:3000')
  console.log('📚 Swagger documentation available at http://localhost:3000/api/v1/docs')
  console.log('🎮 GraphQL Playground available at http://localhost:3000/graphql')
}
void bootstrap()

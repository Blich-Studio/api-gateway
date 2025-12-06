import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ZodValidationPipe } from 'nestjs-zod'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { Logger } from '@nestjs/common'

async function bootstrap() {
  const logger = new Logger('Bootstrap')
  const app = await NestFactory.create(AppModule)

  // Enable CORS with environment-based configuration
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : process.env.NODE_ENV === 'production'
      ? ['https://blichstudio.com', 'https://www.blichstudio.com']
      : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:4200']

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })

  // Use Zod validation pipe globally to ensure proper 400 errors for validation failures
  app.useGlobalPipes(new ZodValidationPipe())

  // Setup Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Blich Studio API Gateway')
    .setDescription(
      'API Gateway providing authentication, user management, and service orchestration for Blich Studio platform'
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build()
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api', app, document)

  const port = process.env.PORT ?? 3000
  await app.listen(port, '0.0.0.0')
  logger.log(`🚀 Application running on http://0.0.0.0:${port}`)
  logger.log(`📚 API documentation available at http://0.0.0.0:${port}/api`)
}
void bootstrap()

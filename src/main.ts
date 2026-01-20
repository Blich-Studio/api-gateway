import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { ZodValidationPipe } from 'nestjs-zod'
import { AppModule } from './app.module'
import { AppConfigService } from './common/config'

async function bootstrap() {
  const logger = new Logger('Bootstrap')
  const app = await NestFactory.create(AppModule)

  // Get the config service from the DI container
  const appConfig = app.get(AppConfigService)

  // Enable CORS with environment-based configuration
  app.enableCors({
    origin: appConfig.allowedOrigins,
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

  const port = appConfig.port
  await app.listen(port, '0.0.0.0')
  logger.log(`Application running on http://0.0.0.0:${port}`)
  logger.log(`API documentation available at http://0.0.0.0:${port}/api`)
}
void bootstrap()

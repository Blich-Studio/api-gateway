import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ZodValidationPipe } from 'nestjs-zod'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Enable CORS for all origins (configure as needed for production)
  app.enableCors({
    origin: true, // Allow all origins (change to specific domains in production)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  })

  // Use Zod validation pipe globally to ensure proper 400 errors for validation failures
  app.useGlobalPipes(new ZodValidationPipe())

  // Setup Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Blich Studio API Gateway')
    .setDescription('API Gateway for Blich Studio services')
    .setVersion('1.0')
    .addBearerAuth()
    .build()
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api', app, document)

  const port = process.env.PORT ?? 3000
  await app.listen(port, '0.0.0.0')
  console.log(`🚀 Application running on http://0.0.0.0:${port}`)
  console.log(`📚 API documentation available at http://0.0.0.0:${port}/api`)
}
void bootstrap()

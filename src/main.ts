import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ZodValidationPipe } from 'nestjs-zod'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Use Zod validation pipe globally to ensure proper 400 errors for validation failures
  app.useGlobalPipes(new ZodValidationPipe())

  const port = process.env.PORT ?? 3000
  await app.listen(port, '0.0.0.0')
  console.log(`🚀 Application running on http://0.0.0.0:${port}`)
}
void bootstrap()

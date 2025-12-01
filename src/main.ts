import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const port = 3000
  await app.listen(port, '0.0.0.0')
  console.log(`🚀 Application running on http://0.0.0.0:${port}`)
}
void bootstrap()

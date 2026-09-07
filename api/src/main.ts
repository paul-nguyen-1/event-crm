import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { JsonLogger } from './logging/json-logger.service';
import { initSentry } from './observability/sentry';

async function bootstrap() {
  initSentry();
  const app = await NestFactory.create(AppModule, {
    logger: new JsonLogger(),
  });
  app.setGlobalPrefix('v1');
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

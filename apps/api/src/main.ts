import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function bootstrap() {
  const secret = process.env.JWT_SECRET ?? '';
  if (secret.length < 32 || secret.startsWith('change-me')) {
    throw new Error('JWT_SECRET must be set to a random value of at least 32 characters (openssl rand -hex 32)');
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn', 'log'] });
  // Behind a reverse proxy the client IP (used for rate limiting) comes from X-Forwarded-For.
  if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
  configureApp(app);
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  Logger.log(`CareBridge API listening on :${port}`, 'Bootstrap');
}

void bootstrap();

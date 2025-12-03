import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as helmet from 'helmet';
import * as cors from 'cors';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ApiModule } from './api.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(ApiModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const origins =
    (process.env.FRONTEND_ORIGINS || 'http://localhost:3000,http://localhost:3001')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

  app.use(helmet());
  app.use(cookieParser());
  app.use(
    cors({
      origin: origins,
      credentials: true,
    }) as any,
  );

  app.useStaticAssets(join(__dirname, '..', '..', '..', 'uploads'), { prefix: '/uploads' });
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 5000;
  await app.listen(port);
  console.log(`🚀 UniServe API running on http://localhost:${port}/api`);
}
bootstrap();

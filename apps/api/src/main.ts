import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { patchNestjsSwagger } from '@anatine/zod-nestjs';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  const loggerLevels = isProduction
    ? ['debug', 'error']
    : ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'];
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: loggerLevels as any,
  });
  app.set('trust proxy', true);
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));
  app.use(helmet());
  
  // API 문서는 전체 스펙이 노출되므로 운영 환경에서는 비공개로 둔다.
  if (process.env.NODE_ENV !== 'production') {
    patchNestjsSwagger();
    const config = new DocumentBuilder()
      .setTitle('Community Boilerplate API')
      .setDescription('The Community Boilerplate API description')
      .setVersion('1.0')
      .addTag('community')
      .addCookieAuth('sid')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  app.use(cookieParser());
  app.enableCors({
    origin: [process.env.FRONTEND_URL || 'http://localhost:3000'],
    credentials: true,
  });

  // Global Filter & Interceptor
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // 롤링 배포(SIGTERM/SIGINT) 시 onModuleDestroy 훅을 실행해
  // Redis 구독/발행, BullMQ 워커, 진행 중인 SSE 연결을 정상적으로 정리한다.
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();

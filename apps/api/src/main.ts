import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { requestTimeoutMiddleware } from './common/middlewares/request-timeout.middleware';
import { ShutdownService } from './common/shutdown/shutdown.service';
import { validateEnvironmentVariables } from './config/env.validator';
import * as express from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Enforce strict environment variables first
  validateEnvironmentVariables();

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.enableShutdownHooks();

  const configService = app.get(AppConfigService);

  app.useLogger(app.get('PinoLogger'));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: configService.isProduction,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter(app.get(Logger), configService));

  app.useGlobalInterceptors(
    new CorrelationIdInterceptor(),
    new LoggingInterceptor(),
  );

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  app.enableCors({
    origin: configService.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Client-Version', 'Accept-Language'],
    exposedHeaders: ['X-Request-ID', 'X-Trace-ID'],
    credentials: true,
    maxAge: 86400,
  });

  app.setGlobalPrefix('api');

  // Abuse Burst Protection & Memory Hardening
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));
  app.use(requestTimeoutMiddleware);



  if (configService.isDevelopment) {
    const config = new DocumentBuilder()
      .setTitle('WORKER Platform API')
      .setDescription('Government Integrated Official Employment Platform')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication endpoints')
      .addTag('health', 'Health check endpoints')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.port;
  const server = await app.listen(port);

  const shutdownService = app.get(ShutdownService);
  shutdownService.setHttpServer(server);

  logger.log(`Application running on port ${port}`);
  logger.log(`Environment: ${configService.nodeEnv}`);
  logger.log(`Rate limiting: ${configService.rateLimitMaxRequests} requests per ${configService.rateLimitWindowMs}ms`);
}

bootstrap();

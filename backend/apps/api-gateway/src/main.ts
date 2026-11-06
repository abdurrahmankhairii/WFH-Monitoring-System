// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import '@app/common/config/load-env';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllHttpExceptionsFilter } from './common/all-exceptions.filter';
import { getUploadsDirectory } from './storage/photo-metadata.util';

// Feature: Core Architecture — Purpose: Bootstraps the HTTP API Gateway on port 3000 with CORS, DTO ValidationPipe, static `/uploads` serving, global standardized.
// OOP: Functional Helper Module — Connected To: Entry point for all HTTP requests from the React frontend (`frontend/src/api/client.ts`).
async function bootstrap(): Promise<void> {
  const logger = new Logger('ApiGateway');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
    exposedHeaders: ['Content-Disposition', 'X-Export-Row-Count'],
  });

  app.setGlobalPrefix('api');
  app.useStaticAssets(getUploadsDirectory(), { prefix: '/uploads/' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );

  app.useGlobalFilters(new AllHttpExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Dexa Group — WFH Attendance & Employee Monitoring API')
    .setDescription(
      'NestJS Microservices API Gateway (:3000) communicating over TCP with Employee Service (:3001) and Attendance Service (:3002). © 2026 Abdurrahman Khairi — All Rights Reserved.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT || process.env.API_GATEWAY_PORT || 3000);
  await app.listen(port, '0.0.0.0');
  logger.log(`API Gateway running on http://localhost:${port}/api (Swagger Docs: http://localhost:${port}/api/docs)`);
}

void bootstrap();

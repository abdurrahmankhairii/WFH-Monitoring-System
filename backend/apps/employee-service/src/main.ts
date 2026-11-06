// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import '@app/common/config/load-env';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AllRpcExceptionsFilter } from '@app/common';
import { EmployeeServiceModule } from './employee-service.module';

// Feature: Core System Architecture — Purpose: Bootstraps the `employee-service` TCP microservice listening on port 3001 (configurable via EMPLOYEE_SERVICE_PORT).
// OOP: Functional Helper Module — Connected To: Reached by `api-gateway` over TCP; connects to MySQL via TypeORM.
async function bootstrap(): Promise<void> {
  const logger = new Logger('EmployeeMicroservice');
  const host = process.env.EMPLOYEE_SERVICE_HOST || '0.0.0.0';
  const port = Number(process.env.EMPLOYEE_SERVICE_PORT || 3001);

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(EmployeeServiceModule, {
    transport: Transport.TCP,
    options: { host, port },
  });

  app.useGlobalFilters(new AllRpcExceptionsFilter());
  await app.listen();
  logger.log(`Employee & Auth Microservice is listening via TCP on ${host}:${port}`);
}

void bootstrap();

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
import { AttendanceServiceModule } from './attendance-service.module';

// Feature: Core System Architecture — Purpose: Bootstraps the `attendance-service` TCP microservice listening on port 3002 (configurable via ATTENDANCE_SERVICE_PORT).
// OOP: Functional Helper Module — Connected To: Reached by `api-gateway` over TCP; connects to MySQL via TypeORM.
async function bootstrap(): Promise<void> {
  const logger = new Logger('AttendanceMicroservice');
  const host = process.env.ATTENDANCE_SERVICE_HOST || '0.0.0.0';
  const port = Number(process.env.ATTENDANCE_SERVICE_PORT || 3002);

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AttendanceServiceModule, {
    transport: Transport.TCP,
    options: { host, port },
  });

  app.useGlobalFilters(new AllRpcExceptionsFilter());
  await app.listen();
  logger.log(`Attendance Microservice is listening via TCP on ${host}:${port}`);
}

void bootstrap();

// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_ENTITIES, DatabaseModule } from '@app/common';
import { AttendanceServiceController } from './attendance-service.controller';
import { AttendanceService } from './attendance/attendance.service';
import { ExportService } from './export/export.service';
import { AttendanceRequestsService } from './requests/attendance-requests.service';

// Feature: #5, #6, #7, #8, #9 — Purpose: Root module for `attendance-service` (TCP :3002).
// OOP: Functional Helper Module — Connected To: Bootstrapped by apps/attendance-service/src/main.ts.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule.forRoot({ allowSchemaSync: false }),
    TypeOrmModule.forFeature(ALL_ENTITIES),
  ],
  controllers: [AttendanceServiceController],
  providers: [AttendanceService, AttendanceRequestsService, ExportService],
})
export class AttendanceServiceModule {}

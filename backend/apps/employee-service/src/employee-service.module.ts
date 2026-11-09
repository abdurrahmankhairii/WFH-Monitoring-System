// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_ENTITIES, DatabaseModule } from '@app/common';
import { AccessRequestsService } from './access-requests/access-requests.service';
import { AuthService } from './auth/auth.service';
import { OtpService } from './auth/otp.service';
import { DatabaseManagementService } from './database-management/database-management.service';
import { EmployeeServiceController } from './employee-service.controller';
import { EmployeesService } from './employees/employees.service';
import { MailService } from './mail/mail.service';
import { SeedService } from './seed/seed.service';
import { SupportService } from './support/support.service';

// Feature: Core Microservice Architecture — Purpose: Root module for `employee-service` (TCP :3001) providing Auth, Master Employee, Support, and Database Studio management.
// OOP: NestJS Root Module (Dependency Injection Composition) — Connected To: Bootstrapped by apps/employee-service/src/main.ts.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule.forRoot({ allowSchemaSync: true }),
    TypeOrmModule.forFeature(ALL_ENTITIES),
    JwtModule.register({}),
  ],
  controllers: [EmployeeServiceController],
  providers: [
    MailService,
    OtpService,
    AuthService,
    EmployeesService,
    AccessRequestsService,
    SupportService,
    SeedService,
    DatabaseManagementService,
  ],
})
export class EmployeeServiceModule {}

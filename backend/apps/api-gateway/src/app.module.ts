// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ATTENDANCE_SERVICE, EMPLOYEE_SERVICE } from '@app/common';
import { AttendanceController } from './attendance/attendance.controller';
import { AuthController } from './auth/auth.controller';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { EmployeesController } from './employee/employees.controller';
import { SupportController } from './support/support.controller';
import { SystemController } from './system/system.controller';

// Feature: Core System Architecture — Purpose: Root module for the HTTP API Gateway (:3000).
// OOP: Functional Helper Module — Connected To: Bootstrapped by backend/apps/api-gateway/src/main.ts.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({}),
    ClientsModule.registerAsync([
      {
        name: EMPLOYEE_SERVICE,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('EMPLOYEE_SERVICE_HOST', '127.0.0.1'),
            port: Number(config.get<string>('EMPLOYEE_SERVICE_PORT', '3001')),
          },
        }),
      },
      {
        name: ATTENDANCE_SERVICE,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('ATTENDANCE_SERVICE_HOST', '127.0.0.1'),
            port: Number(config.get<string>('ATTENDANCE_SERVICE_PORT', '3002')),
          },
        }),
      },
    ]),
  ],
  controllers: [SystemController, AuthController, EmployeesController, AttendanceController, SupportController],
  providers: [JwtAuthGuard, RolesGuard],
})
export class AppModule {}

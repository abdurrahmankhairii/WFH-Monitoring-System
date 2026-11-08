// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { AccessRequest } from './access-request.entity';
import { AttendanceRequest } from './attendance-request.entity';
import { Attendance } from './attendance.entity';
import { Department } from './department.entity';
import { Employee } from './employee.entity';
import { OtpCode } from './otp-code.entity';
import { SupportTicket } from './support-ticket.entity';
import { SystemSetting } from './system-setting.entity';
import { User } from './user.entity';

export { AccessRequest, Attendance, AttendanceRequest, Department, Employee, OtpCode, SupportTicket, SystemSetting, User };

// Feature: Core System Architecture — Purpose: Complete entity list registered with TypeORM by every microservice.
// OOP: Domain Entity (TypeORM Relational Model) — Connected To: libs/common/src/database/database.module.ts.
export const ALL_ENTITIES = [User, Department, Employee, Attendance, AttendanceRequest, OtpCode, AccessRequest, SupportTicket, SystemSetting];

// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import {
  ApprovalStatus,
  AttendanceRequestType,
  AttendanceStatus,
  ExportFormat,
  PhotoCaptureSource,
  SupportCategory,
  WfhWorkflowMode,
} from '../constants/enums';
import { PaginationQueryDto } from './employee.dto';
import { EmptyToUndefined, TIME_HHMM_REGEX, Trim } from './transformers';

// Feature: WFH Attendance & Request Validation DTOs — Purpose: Multipart text fields sent with the Clock-In photo.
// OOP: Data Transfer Object (Encapsulated Validation Contract) — Connected To: POST /api/attendances/clock-in (api-gateway attendance.controller.ts) -> attendance-service clockIn().
export class ClockInDto {
  @IsEnum(PhotoCaptureSource)
  captureSource: PhotoCaptureSource;

  @EmptyToUndefined()
  @IsOptional()
  @IsDateString({}, { message: 'photoCapturedAt must be an ISO-8601 timestamp' })
  photoCapturedAt?: string;

  @EmptyToUndefined()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  dailyPlan?: string;
}

// Feature: WFH Attendance & Request Validation DTOs — Purpose: Multipart text fields sent with the Clock-Out photo, including the mandatory daily accomplishment summary.
// OOP: Data Transfer Object (Encapsulated Validation Contract) — Connected To: POST /api/attendances/clock-out -> attendance-service clockOut().
export class ClockOutDto {
  @IsEnum(PhotoCaptureSource)
  captureSource: PhotoCaptureSource;

  @EmptyToUndefined()
  @IsOptional()
  @IsDateString()
  photoCapturedAt?: string;

  @Trim()
  @IsString()
  @MinLength(10, { message: 'Daily accomplishment is mandatory (minimum 10 characters) before closing the session' })
  @MaxLength(2000)
  dailyAccomplishment: string;
}

// Feature: WFH Attendance & Request Validation DTOs — Purpose: Filter set for HRD monitoring list and payroll export.
// OOP: Data Transfer Object (Encapsulated Validation Contract) — Connected To: GET /api/attendances & GET /api/attendances/export -> attendance.service.ts findAll()/export().
export class AttendanceQueryDto extends PaginationQueryDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  department?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  search?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsEnum(PhotoCaptureSource)
  captureSource?: PhotoCaptureSource;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(['true', 'false'])
  verified?: 'true' | 'false';
}

// Feature: WFH Attendance & Request Validation DTOs — Purpose: Export query = monitoring filters + output format.
// OOP: Data Transfer Object (Encapsulated Validation Contract) — Connected To: GET /api/attendances/export -> export.service.ts.
export class ExportQueryDto extends AttendanceQueryDto {
  @IsEnum(ExportFormat, { message: 'format must be xlsx or csv' })
  format: ExportFormat;
}

// Feature: WFH Attendance & Request Validation DTOs — Purpose: Date selector for the HRD dashboard summary.
// OOP: Data Transfer Object (Encapsulated Validation Contract) — Connected To: GET /api/attendances/summary -> attendance.service.ts summary().
export class SummaryQueryDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsDateString()
  date?: string;
}

// Feature: WFH Attendance & Request Validation DTOs — Purpose: Date range for an employee's personal attendance history.
// OOP: Data Transfer Object (Encapsulated Validation Contract) — Connected To: GET /api/attendances/my-history -> attendance.service.ts myHistory().
export class MyHistoryQueryDto extends PaginationQueryDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// Feature: WFH Attendance & Request Validation DTOs — Purpose: Self-service WFH Approval, Overtime, Leave, Sick, or Correction request (multipart, optional proof attachment).
// OOP: Data Transfer Object (Encapsulated Validation Contract) — Connected To: POST /api/attendance-requests -> attendance-requests.service.ts create().
export class CreateAttendanceRequestDto {
  @IsEnum(AttendanceRequestType)
  requestType: AttendanceRequestType;

  @IsDateString({}, { message: 'Target date must be a valid date (YYYY-MM-DD)' })
  targetDate: string;

  @EmptyToUndefined()
  @IsOptional()
  @Matches(TIME_HHMM_REGEX, { message: 'Requested clock-in must use HH:mm format' })
  requestedClockIn?: string;

  @EmptyToUndefined()
  @IsOptional()
  @Matches(TIME_HHMM_REGEX, { message: 'Requested clock-out must use HH:mm format' })
  requestedClockOut?: string;

  @EmptyToUndefined()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(720)
  overtimeMinutes?: number;

  @Trim()
  @IsString()
  @MinLength(10, { message: 'Reason must be at least 10 characters' })
  @MaxLength(2000)
  reason: string;
}

// Feature: WFH Attendance & Request Validation DTOs — Purpose: Filters for the HRD request review queue.
// OOP: Data Transfer Object (Encapsulated Validation Contract) — Connected To: GET /api/attendance-requests -> attendance-requests.service.ts findAll().
export class AttendanceRequestQueryDto extends PaginationQueryDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsEnum(ApprovalStatus)
  status?: ApprovalStatus;

  @EmptyToUndefined()
  @IsOptional()
  @IsEnum(AttendanceRequestType)
  requestType?: AttendanceRequestType;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  search?: string;
}

// Feature: WFH Attendance & Request Validation DTOs — Purpose: HR Admin decision on a pending attendance request.
// OOP: Data Transfer Object (Encapsulated Validation Contract) — Connected To: PATCH /api/attendance-requests/:id/review -> attendance-requests.service.ts review().
export class ReviewAttendanceRequestDto {
  @IsIn([ApprovalStatus.APPROVED, ApprovalStatus.REJECTED], { message: 'decision must be APPROVED or REJECTED' })
  decision: ApprovalStatus.APPROVED | ApprovalStatus.REJECTED;

  @EmptyToUndefined()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  reviewNotes?: string;
}

// Feature: WFH Attendance & Request Validation DTOs — Purpose: Support ticket submitted from the Contact Developer modal.
// OOP: Data Transfer Object (Encapsulated Validation Contract) — Connected To: POST /api/support/contact-developer -> support.service.ts contactDeveloper().
export class ContactDeveloperDto {
  @IsEnum(SupportCategory)
  category: SupportCategory;

  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  moduleLocation: string;

  @Trim()
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  subject: string;

  @Trim()
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  message: string;
}

// Feature: Company Policy & Workflow Configuration DTO — Purpose: Validates HR Admin / System Admin payload for updating WFH workflow mode, Overtime calculation toggle, and weekly quota.
// OOP: Data Transfer Object (Encapsulated Validation Contract) — Connected To: PATCH /api/system/policy (api-gateway system.controller.ts) -> attendance-service updatePolicy().
export class UpdatePolicyDto {
  @IsOptional()
  @IsEnum(WfhWorkflowMode)
  wfhWorkflowMode?: WfhWorkflowMode;

  @IsOptional()
  @IsBoolean()
  enableOvertime?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  maxWfhDaysPerWeek?: number;
}

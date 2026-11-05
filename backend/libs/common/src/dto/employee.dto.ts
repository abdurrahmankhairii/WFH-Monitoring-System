// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEmail, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ApprovalStatus, EmployeeStatus, UserRole } from '../constants/enums';
import { EmptyToUndefined, NormalizeEmail, Trim } from './transformers';

// Feature: Master Employee Validation DTOs — Purpose: Shared pagination query fields.
// OOP: Data Transfer Object (Encapsulated Validation Contract) — Connected To: Extended by every list query DTO.
export class PaginationQueryDto {
  @EmptyToUndefined()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @EmptyToUndefined()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

// Feature: Master Employee Validation DTOs — Purpose: HR Admin / System Admin payload to register a new employee (provisions users + employees rows and emails a verification OTP).
// OOP: Data Transfer Object (Encapsulated Validation Contract) — Connected To: POST /api/employees -> employee-service employees.service.ts create().
export class CreateEmployeeDto {
  @Trim()
  @IsString()
  @Matches(/^[A-Z0-9-]{3,50}$/, { message: 'Employee code (NIP) may only contain uppercase letters, digits and dashes' })
  employeeCode: string;

  @Trim()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  fullName: string;

  @NormalizeEmail()
  @IsEmail({}, { message: 'A valid email address is required' })
  email: string;

  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  department: string;

  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  position: string;

  @EmptyToUndefined()
  @IsOptional()
  @Matches(/^[0-9+\-\s]{8,30}$/, { message: 'Phone number may only contain digits, spaces, + and -' })
  phoneNumber?: string;

  @IsDateString({}, { message: 'Join date must be a valid date (YYYY-MM-DD)' })
  joinDate: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

// Feature: Master Employee Validation DTOs — Purpose: HR Admin payload to update an employee profile, role or active/on-leave status (deactivation uses soft delete instead).
// OOP: Data Transfer Object (Encapsulated Validation Contract) — Connected To: PATCH /api/employees/:id -> employees.service.ts update().
export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {
  @EmptyToUndefined()
  @IsOptional()
  @IsIn([EmployeeStatus.ACTIVE, EmployeeStatus.ON_LEAVE], { message: 'Status can only be ACTIVE or ON_LEAVE (use deactivate for INACTIVE)' })
  status?: EmployeeStatus;
}

// Feature: Master Employee Validation DTOs — Purpose: Filters for the Master Employee table.
// OOP: Data Transfer Object (Encapsulated Validation Contract) — Connected To: GET /api/employees -> employees.service.ts findAll().
export class EmployeeQueryDto extends PaginationQueryDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  search?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  department?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @EmptyToUndefined()
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @EmptyToUndefined()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  @IsBoolean()
  includeInactive?: boolean;
}

// Feature: Master Employee Validation DTOs — Purpose: Filters for the Access Request review table.
// OOP: Data Transfer Object (Encapsulated Validation Contract) — Connected To: GET /api/access-requests -> access-requests.service.ts findAll().
export class AccessRequestQueryDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsEnum(ApprovalStatus)
  status?: ApprovalStatus;
}

// Feature: Master Employee Validation DTOs — Purpose: HR Admin approval of an access request (optionally choosing the role).
// OOP: Data Transfer Object (Encapsulated Validation Contract) — Connected To: PATCH /api/access-requests/:id/approve -> access-requests.service.ts approve().
export class ApproveAccessRequestDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @EmptyToUndefined()
  @IsOptional()
  @IsDateString()
  joinDate?: string;

  @EmptyToUndefined()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  reviewNotes?: string;
}

// Feature: Master Employee Validation DTOs — Purpose: HR Admin rejection of an access request with a mandatory reason.
// OOP: Data Transfer Object (Encapsulated Validation Contract) — Connected To: PATCH /api/access-requests/:id/reject -> access-requests.service.ts reject().
export class RejectAccessRequestDto {
  @Trim()
  @IsString()
  @MinLength(5, { message: 'Please provide a rejection reason of at least 5 characters' })
  @MaxLength(1000)
  reviewNotes: string;
}

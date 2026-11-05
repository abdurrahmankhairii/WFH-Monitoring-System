// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { EmptyToUndefined, NormalizeEmail, STRONG_PASSWORD_MESSAGE, STRONG_PASSWORD_REGEX, Trim } from './transformers';

// Feature: Authentication & OTP Validation DTOs — Purpose: Daily login credentials (Email + Password -> JWT, no OTP).
// OOP: Data Transfer Object (Encapsulated Validation Contract) — Connected To: POST /api/auth/login (api-gateway auth.controller.ts) -> employee-service auth.service.ts login().
export class LoginDto {
  @NormalizeEmail()
  @IsEmail({}, { message: 'A valid email address is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}

// Feature: Authentication & OTP Validation DTOs — Purpose: Refresh token exchange payload.
// OOP: Data Transfer Object (Encapsulated Validation Contract) — Connected To: POST /api/auth/refresh -> auth.service.ts refresh().
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

// Feature: Authentication & OTP Validation DTOs — Purpose: Public onboarding request from a prospective employee, reviewed by HR Admin.
// OOP: Data Transfer Object (Encapsulated Validation Contract) — Connected To: POST /api/auth/request-access -> access-requests.service.ts create().
export class RequestAccessDto {
  @Trim()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  fullName: string;

  @NormalizeEmail()
  @IsEmail({}, { message: 'A valid email address is required' })
  email: string;

  @EmptyToUndefined()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(50)
  employeeCode?: string;

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

  @EmptyToUndefined()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

// Feature: Authentication & OTP Validation DTOs — Purpose: Activates a newly provisioned account with the emailed 6-digit OTP and sets the user's own password.
// OOP: Data Transfer Object (Encapsulated Validation Contract) — Connected To: POST /api/auth/verify-account -> auth.service.ts verifyAccount() -> otp.service.ts.
export class VerifyAccountDto {
  @NormalizeEmail()
  @IsEmail()
  email: string;

  @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
  otp: string;

  @Matches(STRONG_PASSWORD_REGEX, { message: STRONG_PASSWORD_MESSAGE })
  newPassword: string;
}

// Feature: Authentication & OTP Validation DTOs — Purpose: Email-only payload used for resend-verification and forgot-password requests.
// OOP: Data Transfer Object (Encapsulated Validation Contract) — Connected To: POST /api/auth/resend-verification and POST /api/auth/forgot-password.
export class EmailOnlyDto {
  @NormalizeEmail()
  @IsEmail({}, { message: 'A valid email address is required' })
  email: string;
}

// Feature: Authentication & OTP Validation DTOs — Purpose: Resets a forgotten password using the emailed 6-digit OTP.
// OOP: Data Transfer Object (Encapsulated Validation Contract) — Connected To: POST /api/auth/reset-password -> auth.service.ts resetPassword().
export class ResetPasswordDto {
  @NormalizeEmail()
  @IsEmail()
  email: string;

  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
  otp: string;

  @Matches(STRONG_PASSWORD_REGEX, { message: STRONG_PASSWORD_MESSAGE })
  newPassword: string;
}

// Feature: Authentication & OTP Validation DTOs — Purpose: Authenticated password change from the Profile page.
// OOP: Data Transfer Object (Encapsulated Validation Contract) — Connected To: PATCH /api/auth/change-password -> auth.service.ts changePassword().
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @Matches(STRONG_PASSWORD_REGEX, { message: STRONG_PASSWORD_MESSAGE })
  newPassword: string;
}

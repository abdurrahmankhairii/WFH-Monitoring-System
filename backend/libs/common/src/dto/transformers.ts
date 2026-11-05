// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Transform } from 'class-transformer';

// Feature: Validation DTO Value Transformers — Purpose: Converts empty strings (common in query strings & multipart forms) to undefined so @IsOptional() validators skip them.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: Optional fields in every libs/common/src/dto/*.dto.ts file.
export function EmptyToUndefined(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => (value === '' || value === null ? undefined : value));
}

// Feature: Validation DTO Value Transformers — Purpose: Trims surrounding whitespace from string inputs.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: Free-text fields (names, notes, messages) in DTOs.
export function Trim(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));
}

// Feature: Validation DTO Value Transformers — Purpose: Lower-cases and trims email inputs so uniqueness checks are case-insensitive.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: Email fields in auth.dto.ts, employee.dto.ts.
export function NormalizeEmail(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));
}

export const STRONG_PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/;
export const STRONG_PASSWORD_MESSAGE = 'Password must be 8-64 characters and contain at least one letter and one number';
export const TIME_HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

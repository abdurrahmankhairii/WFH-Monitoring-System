// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { IsNull, Repository } from 'typeorm';
import { OtpCode, OtpType, throwRpcError } from '@app/common';

const OTP_TTL_MINUTES = 15;
const MAX_OTP_ATTEMPTS = 5;

// Feature: Core System Architecture — Purpose: Generates, hashes, stores, and validates 6-digit OTP codes for New Account Verification and Forgot Password.
// OOP: Injectable Domain Service (Business Logic Encapsulation) — Connected To: Used by auth.service.ts, employees.service.ts, and access-requests.service.ts -> Persists to MySQL.
@Injectable()
export class OtpService {
  constructor(
    @InjectRepository(OtpCode)
    private readonly otpRepo: Repository<OtpCode>,
  ) {}

  // Feature: Core System Architecture — Purpose: Issues a fresh 6-digit OTP code for a user, invalidating any prior unused OTP of the same type.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: Called by auth.service.ts (forgotPassword, resendVerification), employees.service.ts (create), and.
  async issueOtp(params: { userId: string; email: string; type: OtpType; fixedCode?: string }): Promise<string> {
    await this.otpRepo.update(
      { userId: params.userId, type: params.type, usedAt: IsNull() },
      { usedAt: new Date() },
    );

    const rawCode = params.fixedCode ?? String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(rawCode, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    const record = this.otpRepo.create({
      userId: params.userId,
      email: params.email.toLowerCase(),
      codeHash,
      type: params.type,
      attempts: 0,
      expiresAt,
      usedAt: null,
    });
    await this.otpRepo.save(record);
    return rawCode;
  }

  // Feature: Core System Architecture — Purpose: Validates a submitted 6-digit OTP against the latest active OTP row and marks it as used on success.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: Called by auth.service.ts verifyAccount() and resetPassword().
  async consumeOtp(params: { email: string; code: string; type: OtpType; where: string }): Promise<OtpCode> {
    const latest = await this.otpRepo.findOne({
      where: { email: params.email.toLowerCase(), type: params.type, usedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });

    if (!latest) {
      throwRpcError(
        400,
        params.where,
        'OTP verification failed',
        'No active 6-digit OTP code was found for this email address. Please request a new code.',
      );
    }

    if (latest.expiresAt.getTime() < Date.now()) {
      throwRpcError(
        400,
        params.where,
        'OTP code has expired',
        'The 6-digit OTP code has exceeded its 15-minute validity window. Please request a new OTP code.',
      );
    }

    if (latest.attempts >= MAX_OTP_ATTEMPTS) {
      throwRpcError(
        429,
        params.where,
        'Maximum OTP attempts exceeded',
        'This OTP code has been locked after 5 failed attempts. Please request a new OTP code.',
      );
    }

    const matches = await bcrypt.compare(params.code, latest.codeHash);
    if (!matches) {
      latest.attempts += 1;
      await this.otpRepo.save(latest);
      throwRpcError(
        400,
        params.where,
        'Invalid 6-digit OTP code',
        `The OTP code entered does not match our records (${MAX_OTP_ATTEMPTS - latest.attempts} attempts remaining).`,
      );
    }

    latest.usedAt = new Date();
    return this.otpRepo.save(latest);
  }
}

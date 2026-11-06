// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import {
  ActorContext,
  ChangePasswordPayload,
  EmailOnlyDto,
  Employee,
  JwtPayload,
  LoginDto,
  OtpType,
  RefreshTokenDto,
  ResetPasswordDto,
  StandardApiResponse,
  User,
  VerifyAccountDto,
  buildResponse,
  durationToSeconds,
  throwRpcError,
} from '@app/common';
import { MailService } from '../mail/mail.service';
import { OtpService } from './otp.service';

// Feature: JWT & RBAC Authentication — Purpose: Handles JWT authentication, token refresh, profile lookup, password change, and OTP-based Account Verification & Forgot Password.
// OOP: Injectable Domain Service (Business Logic Encapsulation) — Connected To: Exposed via AuthController (@MessagePattern AUTH_PATTERNS) -> Consumed by api-gateway AuthController.
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly otpService: OtpService,
    private readonly mailService: MailService,
  ) {}

  // Feature: User Authentication & JWT Session — Purpose: Authenticates daily login via Email + Password (bcrypt) and issues JWT access & refresh tokens without daily OTP friction.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: POST /api/auth/login -> frontend/src/pages/auth/LoginPage.tsx.
  async login(dto: LoginDto): Promise<StandardApiResponse> {
    const where = 'Auth - Login';
    const email = dto.email.trim().toLowerCase();

    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.employee', 'employee')
      .where('LOWER(user.email) = :email', { email })
      .getOne();

    if (!user) {
      throwRpcError(401, where, 'Authentication failed', `No account is registered with email "${email}".`);
    }

    if (!user.isActive || (user.employee && !user.employee.isActive)) {
      throwRpcError(
        403,
        where,
        'Account is deactivated',
        'Your employee account has been deactivated by HRD Admin. Please contact HRD or use Contact Developer for assistance.',
      );
    }

    if (!user.isVerified) {
      throwRpcError(
        403,
        where,
        'Account verification required',
        'Your new employee account has not been verified yet. Please open "Verify New Account" and enter your 6-digit email OTP.',
      );
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throwRpcError(401, where, 'Invalid email or password', 'The password you entered does not match the registered account credentials.');
    }

    user.lastLoginAt = new Date();
    await this.userRepo.save(user);

    const tokens = await this.issueTokens(user, user.employee ?? null);
    const fullName = user.employee?.fullName ?? user.email;

    return buildResponse({
      where,
      what: `Welcome back, ${fullName}`,
      why: `Authenticated as ${user.role} (${user.email}) with an active JWT session.`,
      data: {
        ...tokens,
        user: this.serializeUserProfile(user, user.employee ?? null),
      },
    });
  }

  // Feature: JWT Access Token Renewal — Purpose: Exchanges a valid refresh JWT for a new access + refresh token pair.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: POST /api/auth/refresh -> frontend/src/api/client.ts interceptor.
  async refresh(dto: RefreshTokenDto): Promise<StandardApiResponse> {
    const where = 'Auth - Token Refresh';
    try {
      const secret = this.config.get<string>('JWT_REFRESH_SECRET', this.config.get<string>('JWT_SECRET', 'dexa-wfh-secret-2026'));
      const decoded = await this.jwtService.verifyAsync<JwtPayload>(dto.refreshToken, { secret });
      if (decoded.tokenType !== 'refresh') {
        throwRpcError(401, where, 'Invalid refresh token', 'Provided token is not a refresh token.');
      }

      const user = await this.userRepo.findOne({
        where: { id: decoded.sub },
        relations: ['employee'],
      });
      if (!user || !user.isActive) {
        throwRpcError(401, where, 'Session expired', 'User account is no longer active.');
      }

      const tokens = await this.issueTokens(user, user.employee ?? null);
      return buildResponse({
        type: 'info',
        where,
        what: 'Session token refreshed',
        why: `Issued a new JWT access token for ${user.email}.`,
        data: {
          ...tokens,
          user: this.serializeUserProfile(user, user.employee ?? null),
        },
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'getError' in error) throw error;
      throwRpcError(401, where, 'Session expired', 'Your refresh token is invalid or has expired. Please sign in again.');
    }
  }

  // Feature: JWT & RBAC Authentication — Purpose: Returns the currently authenticated user's full account and employee profile.
  // OOP: Context Provider Pattern (State Abstraction & Dependency Injection) — Connected To: GET /api/auth/me -> frontend AuthContext & ProfilePage.
  async getMe(actor: ActorContext): Promise<StandardApiResponse> {
    const where = 'Auth - Current Profile';
    const user = await this.userRepo.findOne({
      where: { id: actor.userId },
      relations: ['employee'],
    });
    if (!user) {
      throwRpcError(404, where, 'User profile not found', 'The authenticated user record no longer exists in the database.');
    }

    return buildResponse({
      type: 'info',
      where,
      what: 'Profile loaded successfully',
      why: `Retrieved account and employee profile for ${user.email} (${user.role}).`,
      data: this.serializeUserProfile(user, user.employee ?? null),
    });
  }

  // Feature: Account Verification via Email OTP — Purpose: Verifies a newly created employee account using the 6-digit OTP and sets their chosen password.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: POST /api/auth/verify-account -> frontend/src/pages/auth/VerifyAccountPage.tsx.
  async verifyAccount(dto: VerifyAccountDto): Promise<StandardApiResponse> {
    const where = 'Auth - Verify New Account';
    const email = dto.email.trim().toLowerCase();

    const user = await this.userRepo.findOne({
      where: { email },
      relations: ['employee'],
    });
    if (!user) {
      throwRpcError(404, where, 'Account not found', `No user account matches email "${email}".`);
    }
    if (user.isVerified) {
      throwRpcError(400, where, 'Account already verified', `Account "${email}" is already verified and active. Please proceed to Sign In.`);
    }

    await this.otpService.consumeOtp({
      email,
      code: dto.otp,
      type: OtpType.ACCOUNT_VERIFICATION,
      where,
    });

    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    user.isVerified = true;
    user.isActive = true;
    user.lastLoginAt = new Date();
    await this.userRepo.save(user);

    const tokens = await this.issueTokens(user, user.employee ?? null);

    return buildResponse({
      where,
      what: 'New account verified and activated',
      why: `6-digit OTP verified for ${email}. Your password has been saved and your session is now active.`,
      data: {
        ...tokens,
        user: this.serializeUserProfile(user, user.employee ?? null),
      },
    });
  }

  // Feature: Verification OTP Resend — Purpose: Re-sends a fresh 6-digit Account Verification OTP to an unverified user's email.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: POST /api/auth/resend-verification -> frontend VerifyAccountPage.tsx.
  async resendVerification(dto: EmailOnlyDto): Promise<StandardApiResponse> {
    const where = 'Auth - Resend Verification OTP';
    const email = dto.email.trim().toLowerCase();

    const user = await this.userRepo.findOne({
      where: { email },
      relations: ['employee'],
    });
    if (!user) {
      throwRpcError(404, where, 'Email not registered', `No account was found with email "${email}".`);
    }
    if (user.isVerified) {
      throwRpcError(400, where, 'Account already verified', `The account "${email}" is already verified. You can sign in directly.`);
    }

    const otpCode = await this.otpService.issueOtp({
      userId: user.id,
      email: user.email,
      type: OtpType.ACCOUNT_VERIFICATION,
    });

    const delivered = await this.mailService.sendOtpEmail({
      toEmail: user.email,
      fullName: user.employee?.fullName ?? user.email,
      otpCode,
      type: OtpType.ACCOUNT_VERIFICATION,
      employeeCode: user.employee?.employeeCode,
    });

    return buildResponse({
      type: 'info',
      where,
      what: 'Verification OTP sent',
      why: delivered
        ? `A new 6-digit verification OTP has been dispatched via SMTP to ${user.email}.`
        : `A new 6-digit verification OTP (${otpCode}) was generated for ${user.email} (local SMTP preview mode).`,
      data: { email: user.email, expiresInMinutes: 15, demoOtpHint: process.env.NODE_ENV === 'production' ? undefined : otpCode },
    });
  }

  // Feature: Password Recovery Email OTP — Purpose: Issues a 6-digit OTP code for resetting a forgotten password and sends it via SMTP.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: POST /api/auth/forgot-password -> frontend/src/pages/auth/ForgotPasswordPage.tsx.
  async forgotPassword(dto: EmailOnlyDto): Promise<StandardApiResponse> {
    const where = 'Auth - Forgot Password';
    const email = dto.email.trim().toLowerCase();

    const user = await this.userRepo.findOne({
      where: { email },
      relations: ['employee'],
    });
    if (!user) {
      throwRpcError(404, where, 'Account not found', `No user account is registered under "${email}".`);
    }

    const otpCode = await this.otpService.issueOtp({
      userId: user.id,
      email: user.email,
      type: OtpType.FORGOT_PASSWORD,
    });

    const delivered = await this.mailService.sendOtpEmail({
      toEmail: user.email,
      fullName: user.employee?.fullName ?? user.email,
      otpCode,
      type: OtpType.FORGOT_PASSWORD,
      employeeCode: user.employee?.employeeCode,
    });

    return buildResponse({
      type: 'info',
      where,
      what: 'Password reset OTP dispatched',
      why: delivered
        ? `A 6-digit password reset OTP has been sent to ${user.email} (valid for 15 minutes).`
        : `A 6-digit password reset OTP (${otpCode}) was generated for ${user.email} (local SMTP preview mode).`,
      data: { email: user.email, expiresInMinutes: 15, demoOtpHint: process.env.NODE_ENV === 'production' ? undefined : otpCode },
    });
  }

  // Feature: Password Reset via OTP — Purpose: Validates the 6-digit Forgot Password OTP and updates the user's password hash.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: POST /api/auth/reset-password -> frontend/src/pages/auth/ForgotPasswordPage.tsx.
  async resetPassword(dto: ResetPasswordDto): Promise<StandardApiResponse> {
    const where = 'Auth - Reset Password';
    const email = dto.email.trim().toLowerCase();

    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      throwRpcError(404, where, 'Account not found', `No user account matches "${email}".`);
    }

    await this.otpService.consumeOtp({
      email,
      code: dto.otp,
      type: OtpType.FORGOT_PASSWORD,
      where,
    });

    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    user.isVerified = true;
    await this.userRepo.save(user);

    return buildResponse({
      where,
      what: 'Password updated successfully',
      why: `Your password for ${email} has been reset using your 6-digit OTP. You may now sign in with your new password.`,
      data: { email },
    });
  }

  // Feature: Self-Service Password Management — Purpose: Allows a logged-in user to change their current password from the Profile page.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: PATCH /api/auth/change-password -> frontend ProfilePage.tsx.
  async changePassword(payload: ChangePasswordPayload): Promise<StandardApiResponse> {
    const where = 'Profile - Change Password';
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: payload.actor.userId })
      .getOne();

    if (!user) {
      throwRpcError(404, where, 'User not found', 'Your user account could not be located.');
    }

    const matches = await bcrypt.compare(payload.dto.currentPassword, user.passwordHash);
    if (!matches) {
      throwRpcError(400, where, 'Incorrect current password', 'The current password you entered does not match your existing password.');
    }

    user.passwordHash = await bcrypt.hash(payload.dto.newPassword, 10);
    await this.userRepo.save(user);

    return buildResponse({
      where,
      what: 'Password changed successfully',
      why: `Your account password for ${user.email} has been re-hashed with bcrypt and updated in MySQL.`,
    });
  }

  // Feature: JWT Access Token Renewal — Purpose: Signs JWT access and refresh tokens containing RBAC role and employee profile identifiers.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: Used by login(), refresh(), and verifyAccount().
  private async issueTokens(user: User, employee: Employee | null): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const accessSecret = this.config.get<string>('JWT_SECRET', 'dexa-wfh-secret-2026');
    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET', 'dexa-wfh-refresh-secret-2026');
    const accessTtl = durationToSeconds(this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '8h'), 8 * 3600);
    const refreshTtl = durationToSeconds(this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'), 7 * 86400);

    const basePayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      employeeId: employee?.id ?? null,
      fullName: employee?.fullName ?? user.email,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync({ ...basePayload, tokenType: 'access' } satisfies JwtPayload, {
        secret: accessSecret,
        expiresIn: accessTtl,
      }),
      this.jwtService.signAsync({ ...basePayload, tokenType: 'refresh' } satisfies JwtPayload, {
        secret: refreshSecret,
        expiresIn: refreshTtl,
      }),
    ]);

    return { accessToken, refreshToken, expiresIn: accessTtl };
  }

  // Feature: JWT & RBAC Authentication — Purpose: Shapes a clean user + employee profile object safe for returning to the React client.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: login(), refresh(), getMe(), verifyAccount().
  private serializeUserProfile(user: User, employee: Employee | null) {
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      employeeId: employee?.id ?? null,
      employeeCode: employee?.employeeCode ?? null,
      fullName: employee?.fullName ?? user.email,
      department: employee?.department ?? 'Management',
      position: employee?.position ?? (user.role === 'HR_ADMIN' ? 'HRD Administrator' : 'Employee'),
      phoneNumber: employee?.phoneNumber ?? null,
      joinDate: employee?.joinDate ?? null,
      status: employee?.status ?? 'ACTIVE',
      avatarUrl: employee?.avatarUrl ?? null,
    };
  }
}

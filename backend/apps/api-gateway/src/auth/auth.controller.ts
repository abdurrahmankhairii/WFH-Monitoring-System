// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Body, Controller, Get, Inject, Patch, Post, UseGuards } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AUTH_PATTERNS,
  ActorContext,
  ChangePasswordDto,
  EMPLOYEE_PATTERNS,
  EMPLOYEE_SERVICE,
  EmailOnlyDto,
  LoginDto,
  RefreshTokenDto,
  RequestAccessDto,
  ResetPasswordDto,
  VerifyAccountDto,
} from '@app/common';
import { sendRpc } from '../common/rpc.util';
import { CurrentUser } from './decorators';
import { JwtAuthGuard } from './jwt-auth.guard';

// Feature: JWT & RBAC Authentication — Purpose: HTTP Gateway controller for Authentication, RBAC profile inspection, Request Access, and 6-digit OTP workflows.
// OOP: API Gateway Controller (HTTP Ingress Adapter) — Connected To: Forwards requests over TCP to `employee-service` (:3001) -> Consumed by frontend/src/pages/auth/*.tsx.
@ApiTags('Authentication & OTP')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(EMPLOYEE_SERVICE)
    private readonly employeeClient: ClientProxy,
  ) {}

  // Feature: User Authentication & JWT Session — Purpose: Daily login endpoint (Email + Password -> JWT access & refresh tokens).
  // OOP: Controller Action (HTTP Request Handler) — Connected To: TCP `auth.login` on employee-service -> frontend LoginPage.tsx.
  @Post('login')
  @ApiOperation({ summary: 'Sign in with email & password to receive JWT access and refresh tokens' })
  login(@Body() dto: LoginDto) {
    return sendRpc(this.employeeClient, AUTH_PATTERNS.LOGIN, dto);
  }

  // Feature: JWT Access Token Renewal — Purpose: Renews JWT access token using a refresh token.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: TCP `auth.refresh` on employee-service -> frontend Axios interceptor.
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh JWT access token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return sendRpc(this.employeeClient, AUTH_PATTERNS.REFRESH, dto);
  }

  // Feature: User Identity & Profile Inspection — Purpose: Returns the authenticated user's profile and linked employee details.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: TCP `auth.me` on employee-service -> frontend AuthContext & ProfilePage.tsx.
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user and employee profile' })
  me(@CurrentUser() actor: ActorContext) {
    return sendRpc(this.employeeClient, AUTH_PATTERNS.ME, { actor });
  }

  // Feature: Self-Service Password Management — Purpose: Allows an authenticated user to change their password.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: TCP `auth.change_password` on employee-service -> frontend ProfilePage.tsx.
  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change current user password' })
  changePassword(@CurrentUser() actor: ActorContext, @Body() dto: ChangePasswordDto) {
    return sendRpc(this.employeeClient, AUTH_PATTERNS.CHANGE_PASSWORD, { actor, dto });
  }

  // Feature: Public Department Directory — Purpose: Exposes active departments from database table department for registration dropdown.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: TCP `employee.department_directory` -> frontend/src/pages/auth/RequestAccessPage.tsx.
  @Get('departments')
  @ApiOperation({ summary: 'Get active departments from database table department for registration dropdown' })
  getDepartments() {
    return sendRpc(this.employeeClient, EMPLOYEE_PATTERNS.DEPARTMENT_DIRECTORY, {});
  }

  // Feature: Employee Onboarding Access Request — Purpose: Public endpoint for new employees to submit an onboarding access request for HRD approval.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: TCP `auth.request_access` on employee-service -> frontend RequestAccessPage.tsx.
  @Post('request-access')
  @ApiOperation({ summary: 'Submit a new employee account access request for HRD review' })
  requestAccess(@Body() dto: RequestAccessDto) {
    return sendRpc(this.employeeClient, AUTH_PATTERNS.REQUEST_ACCESS, dto);
  }

  // Feature: Account Verification via Email OTP — Purpose: Verifies a newly provisioned account using the emailed 6-digit OTP and sets the user's chosen password.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: TCP `auth.verify_account` on employee-service -> frontend VerifyAccountPage.tsx.
  @Post('verify-account')
  @ApiOperation({ summary: 'Verify new account with 6-digit email OTP and set password' })
  verifyAccount(@Body() dto: VerifyAccountDto) {
    return sendRpc(this.employeeClient, AUTH_PATTERNS.VERIFY_ACCOUNT, dto);
  }

  // Feature: Verification OTP Resend — Purpose: Re-sends a fresh 6-digit Account Verification OTP to an unverified email.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: TCP `auth.resend_verification` on employee-service -> frontend VerifyAccountPage.tsx.
  @Post('resend-verification')
  @ApiOperation({ summary: 'Resend 6-digit account verification OTP email' })
  resendVerification(@Body() dto: EmailOnlyDto) {
    return sendRpc(this.employeeClient, AUTH_PATTERNS.RESEND_VERIFICATION, dto);
  }

  // Feature: Password Recovery Email OTP — Purpose: Sends a 6-digit Forgot Password OTP to the user's registered email.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: TCP `auth.forgot_password` on employee-service -> frontend ForgotPasswordPage.tsx.
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request a 6-digit password reset OTP via email' })
  forgotPassword(@Body() dto: EmailOnlyDto) {
    return sendRpc(this.employeeClient, AUTH_PATTERNS.FORGOT_PASSWORD, dto);
  }

  // Feature: Password Reset via OTP — Purpose: Validates the 6-digit Forgot Password OTP and updates the account password.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: TCP `auth.reset_password` on employee-service -> frontend ForgotPasswordPage.tsx.
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using 6-digit email OTP' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return sendRpc(this.employeeClient, AUTH_PATTERNS.RESET_PASSWORD, dto);
  }
}

// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  ACCESS_REQUEST_PATTERNS,
  AUTH_PATTERNS,
  AccessRequestQueryPayload,
  ActorPayload,
  ApproveAccessRequestPayload,
  ChangePasswordPayload,
  ContactDeveloperPayload,
  CreateEmployeePayload,
  EMPLOYEE_PATTERNS,
  EmailOnlyDto,
  EmployeeQueryPayload,
  IdActorPayload,
  LoginDto,
  RefreshTokenDto,
  RejectAccessRequestPayload,
  RequestAccessDto,
  ResetPasswordDto,
  SUPPORT_PATTERNS,
  UpdateEmployeePayload,
  VerifyAccountDto,
} from '@app/common';
import { AccessRequestsService } from './access-requests/access-requests.service';
import { AuthService } from './auth/auth.service';
import { EmployeesService } from './employees/employees.service';
import { SupportService } from './support/support.service';

// Feature: covering s #1, #4, #10 — Purpose: TCP microservice controller exposing all Auth, Master Employee CRUD, Access Request, and Support handlers on TCP :3001.
// OOP: API Gateway Controller (HTTP Ingress Adapter) — Connected To: Receives TCP messages from backend/apps/api-gateway/src/**/*.controller.ts -> Delegates to AuthService,.
@Controller()
export class EmployeeServiceController {
  constructor(
    private readonly authService: AuthService,
    private readonly employeesService: EmployeesService,
    private readonly accessRequestsService: AccessRequestsService,
    private readonly supportService: SupportService,
  ) {}

  // Feature: Core System Architecture — Purpose: Handles TCP `auth.login` message from API Gateway.
  // OOP: Message Handler (TCP Request Handler) — Connected To: AuthService.login() -> POST /api/auth/login.
  @MessagePattern(AUTH_PATTERNS.LOGIN)
  login(@Payload() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `auth.refresh` message for renewing JWT tokens.
  // OOP: Message Handler (TCP Request Handler) — Connected To: AuthService.refresh() -> POST /api/auth/refresh.
  @MessagePattern(AUTH_PATTERNS.REFRESH)
  refresh(@Payload() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `auth.me` message to fetch the authenticated user's profile.
  // OOP: Message Handler (TCP Request Handler) — Connected To: AuthService.getMe() -> GET /api/auth/me.
  @MessagePattern(AUTH_PATTERNS.ME)
  me(@Payload() payload: ActorPayload) {
    return this.authService.getMe(payload.actor);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `auth.change_password` message.
  // OOP: Message Handler (TCP Request Handler) — Connected To: AuthService.changePassword() -> PATCH /api/auth/change-password.
  @MessagePattern(AUTH_PATTERNS.CHANGE_PASSWORD)
  changePassword(@Payload() payload: ChangePasswordPayload) {
    return this.authService.changePassword(payload);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `auth.request_access` message for new employee onboarding requests.
  // OOP: Message Handler (TCP Request Handler) — Connected To: AccessRequestsService.create() -> POST /api/auth/request-access.
  @MessagePattern(AUTH_PATTERNS.REQUEST_ACCESS)
  requestAccess(@Payload() dto: RequestAccessDto) {
    return this.accessRequestsService.create(dto);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `auth.verify_account` message (6-digit OTP verification for new accounts).
  // OOP: Message Handler (TCP Request Handler) — Connected To: AuthService.verifyAccount() -> POST /api/auth/verify-account.
  @MessagePattern(AUTH_PATTERNS.VERIFY_ACCOUNT)
  verifyAccount(@Payload() dto: VerifyAccountDto) {
    return this.authService.verifyAccount(dto);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `auth.resend_verification` message.
  // OOP: Message Handler (TCP Request Handler) — Connected To: AuthService.resendVerification() -> POST /api/auth/resend-verification.
  @MessagePattern(AUTH_PATTERNS.RESEND_VERIFICATION)
  resendVerification(@Payload() dto: EmailOnlyDto) {
    return this.authService.resendVerification(dto);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `auth.forgot_password` message (issues 6-digit reset OTP).
  // OOP: Message Handler (TCP Request Handler) — Connected To: AuthService.forgotPassword() -> POST /api/auth/forgot-password.
  @MessagePattern(AUTH_PATTERNS.FORGOT_PASSWORD)
  forgotPassword(@Payload() dto: EmailOnlyDto) {
    return this.authService.forgotPassword(dto);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `auth.reset_password` message (validates 6-digit OTP & updates password).
  // OOP: Message Handler (TCP Request Handler) — Connected To: AuthService.resetPassword() -> POST /api/auth/reset-password.
  @MessagePattern(AUTH_PATTERNS.RESET_PASSWORD)
  resetPassword(@Payload() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `employee.find_all` message for HRD Master Employee table.
  // OOP: Message Handler (TCP Request Handler) — Connected To: EmployeesService.findAll() -> GET /api/employees.
  @MessagePattern(EMPLOYEE_PATTERNS.FIND_ALL)
  findAllEmployees(@Payload() payload: EmployeeQueryPayload) {
    return this.employeesService.findAll(payload);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `employee.find_one` message.
  // OOP: Message Handler (TCP Request Handler) — Connected To: EmployeesService.findOne() -> GET /api/employees/:id.
  @MessagePattern(EMPLOYEE_PATTERNS.FIND_ONE)
  findOneEmployee(@Payload() payload: IdActorPayload) {
    return this.employeesService.findOne(payload);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `employee.create` message.
  // OOP: Message Handler (TCP Request Handler) — Connected To: EmployeesService.create() -> POST /api/employees.
  @MessagePattern(EMPLOYEE_PATTERNS.CREATE)
  createEmployee(@Payload() payload: CreateEmployeePayload) {
    return this.employeesService.create(payload);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `employee.update` message.
  // OOP: Message Handler (TCP Request Handler) — Connected To: EmployeesService.update() -> PATCH /api/employees/:id.
  @MessagePattern(EMPLOYEE_PATTERNS.UPDATE)
  updateEmployee(@Payload() payload: UpdateEmployeePayload) {
    return this.employeesService.update(payload);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `employee.soft_delete` message.
  // OOP: Message Handler (TCP Request Handler) — Connected To: EmployeesService.softDelete() -> DELETE /api/employees/:id.
  @MessagePattern(EMPLOYEE_PATTERNS.SOFT_DELETE)
  softDeleteEmployee(@Payload() payload: IdActorPayload) {
    return this.employeesService.softDelete(payload);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `employee.restore` message.
  // OOP: Message Handler (TCP Request Handler) — Connected To: EmployeesService.restore() -> PATCH /api/employees/:id/restore.
  @MessagePattern(EMPLOYEE_PATTERNS.RESTORE)
  restoreEmployee(@Payload() payload: IdActorPayload) {
    return this.employeesService.restore(payload);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `employee.departments` message.
  // OOP: Message Handler (TCP Request Handler) — Connected To: EmployeesService.getDepartments() -> GET /api/employees/departments.
  @MessagePattern(EMPLOYEE_PATTERNS.DEPARTMENTS)
  getDepartments() {
    return this.employeesService.getDepartments();
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `employee.resend_verification` message triggered by HRD Admin.
  // OOP: Message Handler (TCP Request Handler) — Connected To: EmployeesService.resendVerificationByAdmin() -> POST /api/employees/:id/resend-otp.
  @MessagePattern(EMPLOYEE_PATTERNS.RESEND_VERIFICATION)
  resendEmployeeOtp(@Payload() payload: IdActorPayload) {
    return this.employeesService.resendVerificationByAdmin(payload);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `access_request.find_all` message.
  // OOP: Message Handler (TCP Request Handler) — Connected To: AccessRequestsService.findAll() -> GET /api/access-requests.
  @MessagePattern(ACCESS_REQUEST_PATTERNS.FIND_ALL)
  findAllAccessRequests(@Payload() payload: AccessRequestQueryPayload) {
    return this.accessRequestsService.findAll(payload);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `access_request.approve` message.
  // OOP: Message Handler (TCP Request Handler) — Connected To: AccessRequestsService.approve() -> PATCH /api/access-requests/:id/approve.
  @MessagePattern(ACCESS_REQUEST_PATTERNS.APPROVE)
  approveAccessRequest(@Payload() payload: ApproveAccessRequestPayload) {
    return this.accessRequestsService.approve(payload);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `access_request.reject` message.
  // OOP: Message Handler (TCP Request Handler) — Connected To: AccessRequestsService.reject() -> PATCH /api/access-requests/:id/reject.
  @MessagePattern(ACCESS_REQUEST_PATTERNS.REJECT)
  rejectAccessRequest(@Payload() payload: RejectAccessRequestPayload) {
    return this.accessRequestsService.reject(payload);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `support.contact_developer` message (SMTP sender = logged-in user's email).
  // OOP: Message Handler (TCP Request Handler) — Connected To: SupportService.contactDeveloper() -> POST /api/support/contact-developer.
  @MessagePattern(SUPPORT_PATTERNS.CONTACT_DEVELOPER)
  contactDeveloper(@Payload() payload: ContactDeveloperPayload) {
    return this.supportService.contactDeveloper(payload);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `support.find_tickets` message.
  // OOP: Message Handler (TCP Request Handler) — Connected To: SupportService.findTickets() -> GET /api/support/tickets.
  @MessagePattern(SUPPORT_PATTERNS.FIND_TICKETS)
  findSupportTickets(@Payload() payload: ActorPayload) {
    return this.supportService.findTickets(payload);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `support.resolve` message.
  // OOP: Message Handler (TCP Request Handler) — Connected To: SupportService.resolveTicket() -> PATCH /api/support/tickets/:id/resolve.
  @MessagePattern(SUPPORT_PATTERNS.RESOLVE)
  resolveSupportTicket(@Payload() payload: IdActorPayload) {
    return this.supportService.resolveTicket(payload);
  }
}

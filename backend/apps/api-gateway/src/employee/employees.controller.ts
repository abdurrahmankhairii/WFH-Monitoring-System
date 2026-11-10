// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Body, Controller, Delete, Get, HttpException, Inject, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { BiometricClientService } from '../biometric/biometric-client.service';
import { ClientProxy } from '@nestjs/microservices';

import {
  ACCESS_REQUEST_PATTERNS,
  AccessRequestQueryDto,
  ActorContext,
  ApproveAccessRequestDto,
  CreateEmployeeDto,
  EMPLOYEE_PATTERNS,
  EMPLOYEE_SERVICE,
  EmployeeQueryDto,
  RejectAccessRequestDto,
  UpdateEmployeeDto,
  UpdateMyProfileDto,
  ToggleSiblingExemptionDto,
  UserRole,
} from '@app/common';
import { CurrentUser, Roles } from '../auth/decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { sendRpc } from '../common/rpc.util';
import { persistAvatarFile } from '../storage/photo-metadata.util';

// Feature: Master Employee Management — Purpose: HTTP Gateway controller for Master Employee Management (CRUD + Soft Delete + Restore) and Access Request review by HRD Admin.
// OOP: API Gateway Controller (HTTP Ingress Adapter) — Connected To: Forwards TCP commands to `employee-service` (:3001) -> Consumed by frontend client portals.
@ApiTags('Master Employees & Access Requests (HRD Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class EmployeesController {
  constructor(
    @Inject(EMPLOYEE_SERVICE)
    private readonly employeeClient: ClientProxy,
    private readonly biometricClient: BiometricClientService,
  ) {}

  // Feature: Biometric Face Enrollment — Purpose: Enrolls the authenticated employee face embedding into database using InsightFace ArcFace.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: POST /api/employees/me/enroll-face -> frontend FaceEnrollmentPage.tsx.
  @Post('employees/me/enroll-face')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo', { storage: memoryStorage() }))
  @ApiOperation({ summary: 'Enroll face biometric embedding for the authenticated employee' })
  async enrollFace(
    @CurrentUser() actor: ActorContext,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    const where = 'Biometric - Face Enrollment';
    if (!file || !file.buffer) {
      throw new HttpException(
        {
          statusCode: 400,
          where,
          what: 'Photo proof is required',
          why: 'Please capture a clear photo of your face using your webcam.',
        },
        400,
      );
    }

    const extractResult = await this.biometricClient.extractEmbedding(file.buffer, file.originalname);
    if (extractResult.status !== 'SUCCESS' || !extractResult.embedding || extractResult.face_count !== 1) {
      throw new HttpException(
        {
          statusCode: 422,
          where,
          what:
            extractResult.status === 'NO_FACE'
              ? 'No face detected in photo'
              : extractResult.status === 'MULTIPLE_FACES'
                ? 'Multiple faces detected'
                : 'Biometric feature extraction failed',
          why: extractResult.message,
        },
        422,
      );
    }

    const photoUrl = persistAvatarFile(file, actor);

    return sendRpc(this.employeeClient, EMPLOYEE_PATTERNS.ENROLL_FACE, {
      actor,
      embedding: extractResult.embedding,
      photoUrl,
    });
  }

  // Feature: Master Employee Department Directory — Purpose: Lists distinct departments for filter dropdowns.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: TCP `employee.departments` -> frontend filter bars.
  @Get('employees/departments')
  @ApiOperation({ summary: 'Get distinct employee departments' })
  getDepartments() {
    return sendRpc(this.employeeClient, EMPLOYEE_PATTERNS.DEPARTMENTS, {});
  }

  // Feature: Master Department Approval Directory — Purpose: Returns full department records including Manager email, HRD PIC email, and weekly WFH quota.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: TCP `employee.department_directory` -> frontend LeaveAndCorrectionModal & MasterEmployeesPage.

  // Feature: Self-Service Employee Profile — Purpose: Allows any logged-in user to update their profile and registered home geofence coordinates.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: TCP `employee.update_profile` -> frontend ProfilePage.tsx.
  @Patch('employees/me/profile')
  @ApiOperation({ summary: 'Update personal contact details and registered home geofence (Self-Service)' })
  updateMyProfile(@CurrentUser() actor: ActorContext, @Body() dto: UpdateMyProfileDto) {
    return sendRpc(this.employeeClient, EMPLOYEE_PATTERNS.UPDATE_PROFILE, { actor, dto });
  }

  @Get('employees/department-directory')
  @ApiOperation({ summary: 'Get master department directory with Manager emails and weekly WFH quota' })
  getDepartmentDirectory() {
    return sendRpc(this.employeeClient, EMPLOYEE_PATTERNS.DEPARTMENT_DIRECTORY, {});
  }

  // Feature: Master Employee Management — Purpose: Lists master employee records with pagination, search, and filters (restricted to HR_ADMIN).
  // OOP: Controller Action (HTTP Request Handler) — Connected To: TCP `employee.find_all` -> frontend MasterEmployeesPage.tsx.
  @Get('employees')
  @Roles(UserRole.HR_ADMIN)
  @ApiOperation({ summary: 'List master employees with search, filter, and pagination (HR_ADMIN)' })
  findAll(@CurrentUser() actor: ActorContext, @Query() query: EmployeeQueryDto) {
    return sendRpc(this.employeeClient, EMPLOYEE_PATTERNS.FIND_ALL, { actor, query });
  }

  // Feature: Master Employee Management — Purpose: Retrieves a single employee record by ID.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: TCP `employee.find_one` -> frontend MasterEmployeesPage.tsx.
  @Get('employees/:id')
  @Roles(UserRole.HR_ADMIN)
  @ApiOperation({ summary: 'Get employee details by ID (HR_ADMIN)' })
  findOne(@CurrentUser() actor: ActorContext, @Param('id') id: string) {
    return sendRpc(this.employeeClient, EMPLOYEE_PATTERNS.FIND_ONE, { actor, id });
  }

  // Feature: Master Employee Management — Purpose: Registers a new employee and sends a 6-digit Account Verification OTP email.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: TCP `employee.create` -> frontend MasterEmployeesPage.tsx.
  @Post('employees')
  @Roles(UserRole.HR_ADMIN)
  @ApiOperation({ summary: 'Create a new employee and dispatch 6-digit verification OTP (HR_ADMIN)' })
  create(@CurrentUser() actor: ActorContext, @Body() dto: CreateEmployeeDto) {
    return sendRpc(this.employeeClient, EMPLOYEE_PATTERNS.CREATE, { actor, dto });
  }

  // Feature: Master Employee Management — Purpose: Updates an employee's profile, department, position, status, or RBAC role.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: TCP `employee.update` -> frontend MasterEmployeesPage.tsx.
  @Patch('employees/:id')
  @Roles(UserRole.HR_ADMIN)
  @ApiOperation({ summary: 'Update employee master data or role (HR_ADMIN)' })
  update(@CurrentUser() actor: ActorContext, @Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return sendRpc(this.employeeClient, EMPLOYEE_PATTERNS.UPDATE, { actor, id, dto });
  }

  // Feature: Master Employee Soft Deletion — Purpose: Soft-deletes (deactivates) an employee while preserving all historical attendance logs.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: TCP `employee.soft_delete` -> frontend MasterEmployeesPage.tsx.
  @Delete('employees/:id')
  @Roles(UserRole.HR_ADMIN)
  @ApiOperation({ summary: 'Soft-delete (deactivate) an employee without breaking attendance foreign keys (HR_ADMIN)' })
  softDelete(@CurrentUser() actor: ActorContext, @Param('id') id: string) {
    return sendRpc(this.employeeClient, EMPLOYEE_PATTERNS.SOFT_DELETE, { actor, id });
  }

  // Feature: Master Employee Account Restoration — Purpose: Restores a soft-deleted employee back to ACTIVE status.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: TCP `employee.restore` -> frontend MasterEmployeesPage.tsx.
  @Patch('employees/:id/restore')
  @Roles(UserRole.HR_ADMIN)
  @ApiOperation({ summary: 'Restore a soft-deleted employee account (HR_ADMIN)' })
  restore(@CurrentUser() actor: ActorContext, @Param('id') id: string) {
    return sendRpc(this.employeeClient, EMPLOYEE_PATTERNS.RESTORE, { actor, id });
  }

  // Feature: Biometric Sibling Exemption — Purpose: Grants or revokes sibling biometric exemption for an employee with an identical twin or high facial resemblance.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: TCP `employee.toggle_sibling_exemption` -> frontend MasterEmployeesPage.tsx.
  @Patch('employees/:id/sibling-exemption')
  @Roles(UserRole.HR_ADMIN)
  @ApiOperation({ summary: 'Toggle sibling biometric exemption for an employee (HR_ADMIN)' })
  toggleSiblingExemption(
    @CurrentUser() actor: ActorContext,
    @Param('id') id: string,
    @Body() dto: ToggleSiblingExemptionDto,
  ) {
    return sendRpc(this.employeeClient, EMPLOYEE_PATTERNS.TOGGLE_SIBLING_EXEMPTION, { actor, id, dto });
  }

  // Feature: Account Verification & OTP Resend — Purpose: Re-sends a 6-digit verification OTP to an unverified employee.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: TCP `employee.resend_verification` -> frontend MasterEmployeesPage.tsx.
  @Post('employees/:id/resend-otp')
  @Roles(UserRole.HR_ADMIN)
  @ApiOperation({ summary: 'Resend 6-digit verification OTP to an unverified employee (HR_ADMIN)' })
  resendOtp(@CurrentUser() actor: ActorContext, @Param('id') id: string) {
    return sendRpc(this.employeeClient, EMPLOYEE_PATTERNS.RESEND_VERIFICATION, { actor, id });
  }

  // Feature: Employee Onboarding Approval Workflow — Purpose: Lists onboarding access requests submitted from the public Request Access screen.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: TCP `access_request.find_all` -> frontend MasterEmployeesPage.tsx.
  @Get('access-requests')
  @Roles(UserRole.HR_ADMIN)
  @ApiOperation({ summary: 'List employee onboarding access requests (HR_ADMIN)' })
  findAllAccessRequests(@CurrentUser() actor: ActorContext, @Query() query: AccessRequestQueryDto) {
    return sendRpc(this.employeeClient, ACCESS_REQUEST_PATTERNS.FIND_ALL, { actor, query });
  }

  // Feature: Employee Onboarding Approval Workflow — Purpose: Approves a pending access request, provisioning the employee account and sending a verification OTP.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: TCP `access_request.approve` -> frontend MasterEmployeesPage.tsx.
  @Patch('access-requests/:id/approve')
  @Roles(UserRole.HR_ADMIN)
  @ApiOperation({ summary: 'Approve an access request and provision the employee account (HR_ADMIN)' })
  approveAccessRequest(
    @CurrentUser() actor: ActorContext,
    @Param('id') id: string,
    @Body() dto: ApproveAccessRequestDto,
  ) {
    return sendRpc(this.employeeClient, ACCESS_REQUEST_PATTERNS.APPROVE, { actor, id, dto });
  }

  // Feature: Employee Onboarding Approval Workflow — Purpose: Rejects a pending access request with reviewer notes.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: TCP `access_request.reject` -> frontend MasterEmployeesPage.tsx.
  @Patch('access-requests/:id/reject')
  @Roles(UserRole.HR_ADMIN)
  @ApiOperation({ summary: 'Reject an access request (HR_ADMIN)' })
  rejectAccessRequest(
    @CurrentUser() actor: ActorContext,
    @Param('id') id: string,
    @Body() dto: RejectAccessRequestDto,
  ) {
    return sendRpc(this.employeeClient, ACCESS_REQUEST_PATTERNS.REJECT, { actor, id, dto });
  }
}

// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AccessRequest,
  AccessRequestQueryPayload,
  ApprovalStatus,
  ApproveAccessRequestPayload,
  RejectAccessRequestPayload,
  RequestAccessDto,
  StandardApiResponse,
  User,
  UserRole,
  buildResponse,
  throwRpcError,
  toJakartaDateString,
} from '@app/common';
import { EmployeesService } from '../employees/employees.service';

// Feature: Core System Architecture — Purpose: Handles public "Request Access" submissions from new employees and HR Admin approval/rejection workflow.
// OOP: Injectable Domain Service (Business Logic Encapsulation) — Connected To: AccessRequestsController (@MessagePattern ACCESS_REQUEST_PATTERNS & AUTH_PATTERNS.REQUEST_ACCESS).
@Injectable()
export class AccessRequestsService {
  constructor(
    @InjectRepository(AccessRequest)
    private readonly accessReqRepo: Repository<AccessRequest>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly employeesService: EmployeesService,
  ) {}

  // Feature: Core System Architecture — Purpose: Submits a new access request from the public Request Access screen.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: POST /api/auth/request-access -> frontend/src/pages/auth/RequestAccessPage.tsx.
  async create(dto: RequestAccessDto): Promise<StandardApiResponse> {
    const where = 'Auth - Request Access';
    const email = dto.email.trim().toLowerCase();

    const existingUser = await this.userRepo.findOne({ where: { email } });
    if (existingUser) {
      throwRpcError(409, where, 'Account already exists', `An employee account is already registered under "${email}".`);
    }

    const pendingReq = await this.accessReqRepo.findOne({
      where: { email, status: ApprovalStatus.PENDING },
    });
    if (pendingReq) {
      throwRpcError(409, where, 'Pending request already exists', `An access request for "${email}" is already awaiting HRD Admin approval.`);
    }

    const record = this.accessReqRepo.create({
      fullName: dto.fullName.trim(),
      email,
      employeeCode: dto.employeeCode?.trim().toUpperCase() ?? null,
      department: dto.department.trim(),
      position: dto.position.trim(),
      phoneNumber: dto.phoneNumber ?? null,
      reason: dto.reason ?? null,
      status: ApprovalStatus.PENDING,
    });
    const saved = await this.accessReqRepo.save(record);

    return buildResponse({
      where,
      what: 'Access request submitted for HRD review',
      why: `Your request for ${saved.fullName} (${saved.email}) has been recorded with status PENDING. Once approved by HRD, a 6-digit verification OTP will be emailed to you.`,
      data: saved,
    });
  }

  // Feature: Core System Architecture — Purpose: Lists all employee access requests for HR Admin review.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: GET /api/access-requests -> frontend MasterEmployeesPage.tsx (Access Requests tab).
  async findAll(payload: AccessRequestQueryPayload): Promise<StandardApiResponse> {
    const where = 'HRD Admin - Access Requests';
    const qb = this.accessReqRepo.createQueryBuilder('req').orderBy('req.createdAt', 'DESC');
    if (payload.query.status) {
      qb.andWhere('req.status = :status', { status: payload.query.status });
    }
    const items = await qb.getMany();
    return buildResponse({
      type: 'info',
      where,
      what: `Loaded ${items.length} access request(s)`,
      why: payload.query.status ? `Filtered access requests with status ${payload.query.status}.` : 'Retrieved all employee access requests.',
      data: items,
    });
  }

  // Feature: Core System Architecture — Purpose: Approves a pending access request, automatically provisioning the User + Employee records and emailing a 6-digit verification OTP.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: PATCH /api/access-requests/:id/approve -> frontend MasterEmployeesPage.tsx.
  async approve(payload: ApproveAccessRequestPayload): Promise<StandardApiResponse> {
    const where = 'HRD Admin - Approve Access Request';
    const req = await this.accessReqRepo.findOne({ where: { id: payload.id } });
    if (!req) {
      throwRpcError(404, where, 'Access request not found', `No access request exists with ID "${payload.id}".`);
    }
    if (req.status !== ApprovalStatus.PENDING) {
      throwRpcError(400, where, 'Request already processed', `This access request was already marked as ${req.status}.`);
    }

    const employeeCode = req.employeeCode?.trim() || (await this.employeesService.generateNextEmployeeCode());

    const createResult = await this.employeesService.create({
      actor: payload.actor,
      dto: {
        employeeCode,
        fullName: req.fullName,
        email: req.email,
        department: req.department,
        position: req.position,
        phoneNumber: req.phoneNumber ?? undefined,
        joinDate: payload.dto.joinDate ?? toJakartaDateString(),
        role: payload.dto.role ?? UserRole.EMPLOYEE,
      },
    });

    req.status = ApprovalStatus.APPROVED;
    req.reviewedById = payload.actor.userId;
    req.reviewNotes = payload.dto.reviewNotes ?? 'Approved by HRD Admin';
    req.reviewedAt = new Date();
    await this.accessReqRepo.save(req);

    return buildResponse({
      where,
      what: `Approved access request for ${req.fullName}`,
      why: `Provisioned employee account (${req.email}) and dispatched a 6-digit Account Verification OTP via SMTP.`,
      data: {
        accessRequest: req,
        employee: createResult.data,
      },
    });
  }

  // Feature: Core System Architecture — Purpose: Rejects a pending access request and records the HR Admin's reason.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: PATCH /api/access-requests/:id/reject -> frontend MasterEmployeesPage.tsx.
  async reject(payload: RejectAccessRequestPayload): Promise<StandardApiResponse> {
    const where = 'HRD Admin - Reject Access Request';
    const req = await this.accessReqRepo.findOne({ where: { id: payload.id } });
    if (!req) {
      throwRpcError(404, where, 'Access request not found', `No access request exists with ID "${payload.id}".`);
    }
    if (req.status !== ApprovalStatus.PENDING) {
      throwRpcError(400, where, 'Request already processed', `This access request was already marked as ${req.status}.`);
    }

    req.status = ApprovalStatus.REJECTED;
    req.reviewedById = payload.actor.userId;
    req.reviewNotes = payload.dto.reviewNotes;
    req.reviewedAt = new Date();
    const saved = await this.accessReqRepo.save(req);

    return buildResponse({
      where,
      what: `Rejected access request for ${req.fullName}`,
      why: `Marked request (${req.email}) as REJECTED: "${payload.dto.reviewNotes}".`,
      data: saved,
    });
  }
}

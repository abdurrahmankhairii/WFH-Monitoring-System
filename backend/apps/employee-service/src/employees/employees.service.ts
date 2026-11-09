// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { DataSource, Not, Repository } from 'typeorm';
import {
  ActorContext,
  CreateEmployeePayload,
  Department,
  Employee,
  EmployeeQueryPayload,
  EmployeeStatus,
  IdActorPayload,
  OtpType,
  StandardApiResponse,
  ToggleSiblingExemptionDto,
  ToggleSiblingExemptionPayload,
  UpdateEmployeePayload,
  UpdateMyProfilePayload,
  reverseGeocodeCoordinates,
  User,
  UserRole,
  buildPaginationMeta,
  buildResponse,
  resolvePagination,
  throwRpcError,
} from '@app/common';
import { OtpService } from '../auth/otp.service';
import { MailService } from '../mail/mail.service';

// Feature: Master Employee Management — Purpose: Implements Master Employee Management (Create, Read, Update, Soft Delete & Restore) and syncs with `users` and `departments`.
// OOP: Injectable Domain Service (Business Logic Encapsulation) — Connected To: Exposed via EmployeesController (@MessagePattern EMPLOYEE_PATTERNS) -> Consumed by api-gateway.
@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
    private readonly dataSource: DataSource,
    private readonly otpService: OtpService,
    private readonly mailService: MailService,
  ) {}


  // Feature: Self-Service Employee Profile Update — Purpose: Allows employees to update contact details and registered WFH home coordinates.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: PATCH /api/employees/me/profile -> frontend ProfilePage.tsx.
  async updateProfile(payload: UpdateMyProfilePayload): Promise<StandardApiResponse> {
    const where = 'Employee Profile - Update';
    const employee = await this.employeeRepo.findOne({
      where: { userId: payload.actor.userId },
      relations: ['user', 'departmentRef'],
      withDeleted: false,
    });
    if (!employee) {
      throwRpcError(404, where, 'Employee not found', 'No active employee profile is linked to this account.');
    }

    if (payload.dto.fullName && payload.dto.fullName.trim().length >= 3) {
      employee.fullName = payload.dto.fullName.trim();
    }
    if (payload.dto.phoneNumber !== undefined) {
      employee.phoneNumber = payload.dto.phoneNumber || null;
    }
    if (typeof payload.dto.homeLatitude === 'number') {
      employee.homeLatitude = payload.dto.homeLatitude;
    }
    if (typeof payload.dto.homeLongitude === 'number') {
      employee.homeLongitude = payload.dto.homeLongitude;
    }
    if (payload.dto.homeAddress !== undefined && payload.dto.homeAddress) {
      employee.homeAddress = payload.dto.homeAddress.trim();
    } else if (typeof payload.dto.homeLatitude === 'number' && typeof payload.dto.homeLongitude === 'number') {
      employee.homeAddress = await reverseGeocodeCoordinates(payload.dto.homeLatitude, payload.dto.homeLongitude);
    }

    const saved = await this.employeeRepo.save(employee);
    saved.user = await this.userRepo.findOne({ where: { id: employee.userId } }) || undefined;

    return buildResponse({
      where,
      what: `Updated profile for ${saved.fullName}`,
      why: `Personal contact information and registered home coordinates saved to MySQL.`,
      data: this.serializeEmployee(saved),
    });
  }

  // Feature: Master Employee Management — Purpose: Retrieves a paginated, searchable, and filterable list of master employees for HRD Admin.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: GET /api/employees -> frontend/src/pages/hrd/MasterEmployeesPage.tsx.
  async findAll(payload: EmployeeQueryPayload): Promise<StandardApiResponse> {
    const where = 'Master Employee - Load Directory';
    const { query } = payload;
    const { page, limit, skip } = resolvePagination(query.page, query.limit);

    const qb = this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('employee.departmentRef', 'departmentRef')
      .orderBy('employee.createdAt', 'DESC');

    if (query.includeInactive) {
      qb.withDeleted();
    } else {
      qb.andWhere('employee.isActive = :active', { active: true });
    }

    if (query.department) {
      qb.andWhere('employee.department = :department', { department: query.department });
    }

    if (query.status) {
      qb.andWhere('employee.status = :status', { status: query.status });
    }

    if (query.role) {
      qb.andWhere('user.role = :role', { role: query.role });
    }

    if (query.search) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(employee.fullName) LIKE :search OR LOWER(employee.email) LIKE :search OR LOWER(employee.employeeCode) LIKE :search OR LOWER(employee.position) LIKE :search)',
        { search },
      );
    }

    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();

    const formatted = items.map((emp) => this.serializeEmployee(emp));
    return buildResponse({
      type: 'info',
      where,
      what: `Loaded ${formatted.length} of ${total} employee records`,
      why: query.search || query.department || query.status
        ? `Filtered master employee directory (page ${page} of ${Math.max(1, Math.ceil(total / limit))}).`
        : `Displaying active master employee directory from MySQL (page ${page}).`,
      data: formatted,
      meta: buildPaginationMeta(page, limit, total),
    });
  }

  // Feature: Master Employee Management — Purpose: Retrieves a single employee record by ID including account role, department manager email, and base salary.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: GET /api/employees/:id -> frontend MasterEmployeesPage.tsx.
  async findOne(payload: IdActorPayload): Promise<StandardApiResponse> {
    const where = 'Master Employee - Detail';
    const emp = await this.employeeRepo.findOne({
      where: { id: payload.id },
      relations: ['user', 'departmentRef'],
      withDeleted: true,
    });

    if (!emp) {
      throwRpcError(404, where, 'Employee not found', `No employee record exists with ID "${payload.id}".`);
    }

    return buildResponse({
      type: 'info',
      where,
      what: `Loaded employee ${emp.fullName}`,
      why: `Retrieved profile and account details for ${emp.employeeCode} (${emp.department}).`,
      data: this.serializeEmployee(emp),
    });
  }

  // Feature: Master Employee Registration — Purpose: Creates a new employee + user account in a database transaction and dispatches a 6-digit Account Verification OTP email.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: POST /api/employees -> frontend MasterEmployeesPage.tsx.
  async create(payload: CreateEmployeePayload): Promise<StandardApiResponse> {
    const where = 'Master Employee - Create';
    const { dto } = payload;
    const email = dto.email.trim().toLowerCase();

    const existingEmail = await this.userRepo.findOne({ where: { email } });
    if (existingEmail) {
      throwRpcError(409, where, 'Failed to register new employee', `Email address "${email}" is already registered to another user account.`);
    }

    if (!dto.employeeCode || !dto.employeeCode.trim()) {
      throwRpcError(400, where, 'Failed to register new employee', 'Employee code (NIP) is mandatory and cannot be empty.');
    }
    const employeeCode = dto.employeeCode.trim().toUpperCase();
    const existingCode = await this.employeeRepo.findOne({
      where: { employeeCode },
      withDeleted: true,
    });
    if (existingCode) {
      throwRpcError(409, where, 'Duplicate employee code (NIP)', `Employee code "${employeeCode}" is already assigned to ${existingCode.fullName}.`);
    }

    const departmentName = dto.department.trim();
    const matchedDept = await this.departmentRepo.findOne({ where: { name: departmentName } });
    const baseSalary = dto.baseSalary && dto.baseSalary >= 1000000 ? Math.round(dto.baseSalary) : 12000000;

    const tempPasswordHash = await bcrypt.hash(`DexaTemp#${Math.random().toString(36).slice(2, 10)}`, 10);
    const assignedRole = dto.role ?? UserRole.EMPLOYEE;

    const { savedUser, savedEmployee } = await this.dataSource.transaction(async (manager) => {
      const user = manager.create(User, {
        email,
        passwordHash: tempPasswordHash,
        role: assignedRole,
        isVerified: false,
        isActive: true,
      });
      const createdUser = await manager.save(User, user);

      const employee = manager.create(Employee, {
        userId: createdUser.id,
        employeeCode,
        fullName: dto.fullName.trim(),
        email,
        department: departmentName,
        departmentId: matchedDept?.id ?? null,
        position: dto.position.trim(),
        phoneNumber: dto.phoneNumber ?? null,
        joinDate: dto.joinDate,
        baseSalary,
        status: EmployeeStatus.ACTIVE,
        isActive: true,
      });
      const createdEmployee = await manager.save(Employee, employee);
      createdEmployee.user = createdUser;
      createdEmployee.departmentRef = matchedDept ?? null;
      return { savedUser: createdUser, savedEmployee: createdEmployee };
    });

    const otpCode = await this.otpService.issueOtp({
      userId: savedUser.id,
      email: savedUser.email,
      type: OtpType.ACCOUNT_VERIFICATION,
    });

    const delivered = await this.mailService.sendOtpEmail({
      toEmail: savedUser.email,
      fullName: savedEmployee.fullName,
      otpCode,
      type: OtpType.ACCOUNT_VERIFICATION,
      employeeCode: savedEmployee.employeeCode,
    });

    return buildResponse({
      where,
      what: `Employee ${savedEmployee.fullName} (${savedEmployee.employeeCode}) registered`,
      why: delivered
        ? `Saved to MySQL and sent a 6-digit Account Verification OTP to ${savedUser.email}.`
        : `Saved to MySQL. Verification OTP (${otpCode}) generated for ${savedUser.email} (local SMTP preview).`,
      data: {
        ...this.serializeEmployee(savedEmployee),
        verificationOtpPreview: process.env.NODE_ENV === 'production' ? undefined : otpCode,
      },
    });
  }

  // Feature: Master Employee Management — Purpose: Updates an employee's master data (name, NIP, email, department, baseSalary, position, status, or RBAC role) and syncs with `users`.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: PATCH /api/employees/:id -> frontend MasterEmployeesPage.tsx.
  async update(payload: UpdateEmployeePayload): Promise<StandardApiResponse> {
    const where = 'Master Employee - Update';
    const { id, dto } = payload;

    const employee = await this.employeeRepo.findOne({
      where: { id },
      relations: ['user', 'departmentRef'],
      withDeleted: true,
    });
    if (!employee || !employee.user) {
      throwRpcError(404, where, 'Employee not found', `No employee record exists with ID "${id}".`);
    }

    if (dto.email && dto.email.toLowerCase() !== employee.email.toLowerCase()) {
      const normalized = dto.email.toLowerCase();
      const emailTaken = await this.userRepo.findOne({ where: { email: normalized } });
      if (emailTaken && emailTaken.id !== employee.userId) {
        throwRpcError(409, where, 'Email address already in use', `Email "${normalized}" belongs to another account.`);
      }
      employee.email = normalized;
      employee.user.email = normalized;
    }

    if (dto.employeeCode && dto.employeeCode.toUpperCase() !== employee.employeeCode) {
      const normalizedCode = dto.employeeCode.toUpperCase();
      const codeTaken = await this.employeeRepo.findOne({ where: { employeeCode: normalizedCode }, withDeleted: true });
      if (codeTaken && codeTaken.id !== employee.id) {
        throwRpcError(409, where, 'Employee code (NIP) already in use', `Employee code "${normalizedCode}" is already assigned.`);
      }
      employee.employeeCode = normalizedCode;
    }

    if (dto.fullName !== undefined) employee.fullName = dto.fullName.trim();
    if (dto.department !== undefined) {
      employee.department = dto.department.trim();
      const matchedDept = await this.departmentRepo.findOne({ where: { name: employee.department } });
      employee.departmentId = matchedDept?.id ?? null;
      employee.departmentRef = matchedDept ?? null;
    }
    if (dto.position !== undefined) employee.position = dto.position.trim();
    if (dto.homeLatitude !== undefined) employee.homeLatitude = dto.homeLatitude;
    if (dto.homeLongitude !== undefined) employee.homeLongitude = dto.homeLongitude;
    if (dto.homeAddress !== undefined) employee.homeAddress = dto.homeAddress;
    if (dto.phoneNumber !== undefined) employee.phoneNumber = dto.phoneNumber ?? null;
    if (dto.joinDate !== undefined) employee.joinDate = dto.joinDate;
    if (dto.baseSalary !== undefined && dto.baseSalary >= 1000000) employee.baseSalary = Math.round(dto.baseSalary);
    if (dto.status !== undefined) employee.status = dto.status;
    if (dto.role !== undefined) employee.user.role = dto.role;

    await this.userRepo.save(employee.user);
    const updated = await this.employeeRepo.save(employee);
    updated.user = employee.user;
    updated.departmentRef = employee.departmentRef;

    return buildResponse({
      where,
      what: `Updated ${updated.fullName} (${updated.employeeCode})`,
      why: `Master data changes (${updated.department} - ${updated.position}, role: ${employee.user.role}) saved to MySQL.`,
      data: this.serializeEmployee(updated),
    });
  }

  // Feature: Master Employee Soft Deletion — Purpose: Soft-deletes (deactivates) an employee by setting `is_active = false`, `status = INACTIVE`, and `deleted_at = NOW()`.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: DELETE /api/employees/:id -> frontend MasterEmployeesPage.tsx.
  async softDelete(payload: IdActorPayload): Promise<StandardApiResponse> {
    const where = 'Master Employee - Soft Delete';
    const employee = await this.employeeRepo.findOne({
      where: { id: payload.id },
      relations: ['user', 'departmentRef'],
      withDeleted: true,
    });

    if (!employee) {
      throwRpcError(404, where, 'Employee not found', `No employee record exists with ID "${payload.id}".`);
    }

    if (employee.userId === payload.actor.userId) {
      throwRpcError(400, where, 'Cannot deactivate your own account', 'HRD Admin cannot soft-delete the currently signed-in administrator account.');
    }

    employee.isActive = false;
    employee.status = EmployeeStatus.INACTIVE;
    employee.deletedAt = new Date();
    await this.employeeRepo.save(employee);

    if (employee.user) {
      employee.user.isActive = false;
      await this.userRepo.save(employee.user);
    }

    return buildResponse({
      where,
      what: `Deactivated ${employee.fullName} (${employee.employeeCode})`,
      why: 'Applied soft delete (is_active = false & deleted_at timestamp) while preserving all historical WFH attendance logs.',
      data: this.serializeEmployee(employee),
    });
  }

  // Feature: Master Employee Account Restoration — Purpose: Restores a previously soft-deleted employee back to ACTIVE status.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: PATCH /api/employees/:id/restore -> frontend MasterEmployeesPage.tsx.
  async restore(payload: IdActorPayload): Promise<StandardApiResponse> {
    const where = 'Master Employee - Restore Account';
    const employee = await this.employeeRepo.findOne({
      where: { id: payload.id },
      relations: ['user', 'departmentRef'],
      withDeleted: true,
    });

    if (!employee) {
      throwRpcError(404, where, 'Employee not found', `No employee record exists with ID "${payload.id}".`);
    }

    employee.isActive = true;
    employee.status = EmployeeStatus.ACTIVE;
    employee.deletedAt = null;
    await this.employeeRepo.save(employee);

    if (employee.user) {
      employee.user.isActive = true;
      await this.userRepo.save(employee.user);
    }

    return buildResponse({
      where,
      what: `Restored ${employee.fullName} (${employee.employeeCode})`,
      why: 'Cleared deleted_at timestamp and reactivated both the employee profile and login credentials.',
      data: this.serializeEmployee(employee),
    });
  }

  // Feature: Master Employee Management — Purpose: Returns distinct department names for filter dropdowns across HRD pages.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: GET /api/employees/departments -> frontend MasterEmployeesPage & MonitoringPage.
  async getDepartments(): Promise<StandardApiResponse<string[]>> {
    const rows = await this.employeeRepo
      .createQueryBuilder('employee')
      .select('DISTINCT employee.department', 'department')
      .withDeleted()
      .orderBy('employee.department', 'ASC')
      .getRawMany<{ department: string }>();

    const departments = rows.map((r) => r.department).filter(Boolean);
    return buildResponse({
      type: 'info',
      where: 'Master Employee - Departments',
      what: `Loaded ${departments.length} departments`,
      why: 'Retrieved distinct department list from master employee table.',
      data: departments,
    });
  }

  // Feature: Master Department Approval Directory — Purpose: Returns full department records including managerName, managerEmail, hrPicEmail, and maxWfhDaysPerWeek.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: GET /api/employees/department-directory -> frontend LeaveAndCorrectionModal & MasterEmployeesPage.
  async getDepartmentDirectory(): Promise<StandardApiResponse> {
    const items = await this.departmentRepo.find({
      where: { isActive: true },
      order: { code: 'ASC' },
    });
    return buildResponse({
      type: 'info',
      where: 'Master Department - Approval Routing Directory',
      what: `Loaded ${items.length} department approval routes`,
      why: 'Retrieved master department directory with Manager emails and weekly WFH quota limits.',
      data: items,
    });
  }

  // Feature: Account Verification & OTP Resend — Purpose: Allows HRD Admin to re-issue and email a 6-digit Account Verification OTP for an unverified employee.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: POST /api/employees/:id/resend-otp -> frontend MasterEmployeesPage.tsx.
  async resendVerificationByAdmin(payload: IdActorPayload): Promise<StandardApiResponse> {
    const where = 'Master Employee - Resend Verification OTP';
    const employee = await this.employeeRepo.findOne({
      where: { id: payload.id },
      relations: ['user'],
      withDeleted: true,
    });
    if (!employee || !employee.user) {
      throwRpcError(404, where, 'Employee not found', `No employee record exists with ID "${payload.id}".`);
    }
    if (employee.user.isVerified) {
      throwRpcError(400, where, 'Employee already verified', `${employee.fullName} (${employee.email}) has already verified their account.`);
    }

    const otpCode = await this.otpService.issueOtp({
      userId: employee.user.id,
      email: employee.user.email,
      type: OtpType.ACCOUNT_VERIFICATION,
    });

    const delivered = await this.mailService.sendOtpEmail({
      toEmail: employee.user.email,
      fullName: employee.fullName,
      otpCode,
      type: OtpType.ACCOUNT_VERIFICATION,
      employeeCode: employee.employeeCode,
    });

    return buildResponse({
      type: 'info',
      where,
      what: `Sent verification OTP to ${employee.fullName}`,
      why: delivered
        ? `6-digit Account Verification OTP sent via SMTP to ${employee.user.email}.`
        : `6-digit Account Verification OTP (${otpCode}) generated for ${employee.user.email} (local SMTP preview).`,
      data: {
        email: employee.user.email,
        verificationOtpPreview: process.env.NODE_ENV === 'production' ? undefined : otpCode,
      },
    });
  }

  // Feature: Master Employee Management — Purpose: Generates the next sequential employee code (`DEXA-2026-XXX`) when not explicitly supplied.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: Used by create() and AccessRequestsService.approve().
  async generateNextEmployeeCode(): Promise<string> {
    const count = await this.employeeRepo.count({ withDeleted: true });
    const nextNumber = count + 1;
    return `DEXA-2026-${String(nextNumber).padStart(3, '0')}`;
  }

  // Feature: Master Employee Management — Purpose: Formats an Employee + User + Department entity triple into a flat, consistent DTO for the frontend.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: All EmployeesService responses.
  // Feature: Biometric Face Enrollment — Purpose: Persists the 512-dim ArcFace embedding vector and enrollment photo into MySQL.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: POST /api/employees/me/enroll-face -> FaceEnrollmentPage.tsx.
  async enrollFace(payload: { actor: ActorContext; embedding: number[]; photoUrl?: string }): Promise<StandardApiResponse> {
    const where = 'Biometric - Face Enrollment';
    const employee = await this.employeeRepo.findOne({
      where: { userId: payload.actor.userId },
      relations: ['user'],
    });

    if (!employee) {
      throwRpcError(404, where, 'Employee not found', 'No employee record is linked to your account.');
    }

    if (!payload.embedding || !Array.isArray(payload.embedding) || payload.embedding.length !== 512) {
      throwRpcError(400, where, 'Invalid face embedding', 'Face embedding must be a 512-dimensional float array.');
    }

    // Step: Duplicate Face Prevention & Sibling Exemption Check (Pertamina Reference Standard)
    await this.checkDuplicateFace(
      payload.embedding,
      employee.id,
      Boolean(employee.isSiblingExempt),
      employee.siblingExemptApprovedBy,
    );

    employee.faceEmbedding = payload.embedding;
    employee.faceEnrolledAt = new Date();
    if (payload.photoUrl) {
      employee.faceEnrolledPhotoUrl = payload.photoUrl;
      employee.avatarUrl = payload.photoUrl;
    }

    const saved = await this.employeeRepo.save(employee);

    return buildResponse({
      where,
      what: 'Face biometric enrolled successfully',
      why: 'Face biometric verification is active for your account. Full attendance access is now granted.',
      data: {
        isFaceEnrolled: true,
        faceEnrolledAt: saved.faceEnrolledAt,
        avatarUrl: saved.avatarUrl,
      },
    });
  }


  // Feature: Duplicate Face Detection & Sibling Exemption — Purpose: Checks cosine similarity against all enrolled faces with a 3-tier check (unique, sibling suspect with exemption override, identical duplicate block).
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: Called by enrollFace() before persisting embedding vector.
  private async checkDuplicateFace(
    probeEmbedding: number[],
    currentEmployeeId: string,
    isSiblingExempt: boolean,
    approvedBy?: string | null,
  ): Promise<void> {
    const where = 'Biometric - Duplicate Face Check';
    const candidates = await this.employeeRepo.find({
      where: {
        id: Not(currentEmployeeId),
        isActive: true,
      },
      select: ['id', 'employeeCode', 'fullName', 'faceEmbedding'],
    });

    let bestSim = -1.0;
    let bestMatch: { fullName: string; employeeCode: string; similarity: number } | undefined;

    for (const candidate of candidates) {
      if (!candidate.faceEmbedding || !Array.isArray(candidate.faceEmbedding) || candidate.faceEmbedding.length !== 512) {
        continue;
      }

      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      for (let i = 0; i < 512; i++) {
        const a = probeEmbedding[i];
        const b = candidate.faceEmbedding[i];
        dotProduct += a * b;
        normA += a * a;
        normB += b * b;
      }

      const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
      const similarity = magnitude > 0 ? Math.max(0, Math.min(1, dotProduct / magnitude)) : 0;

      if (similarity > bestSim) {
        bestSim = similarity;
        if (similarity >= 0.50) {
          bestMatch = {
            fullName: candidate.fullName,
            employeeCode: candidate.employeeCode,
            similarity: Math.round(similarity * 1000) / 10,
          };
        }
      }
    }

    if (!bestMatch) {
      // Tier 1: Unique face (< 0.50)
      return;
    }

    // Tier 3: Hard duplicate / Identical image spoof (similarity >= 0.90)
    if (bestMatch.similarity >= 90.0) {
      throwRpcError(
        409,
        where,
        'Duplicate face registration blocked',
        `Wajah terdeteksi identik (${bestMatch.similarity}%) dengan karyawan '${bestMatch.fullName}' (${bestMatch.employeeCode}). Sistem menolak pendaftaran foto yang sama untuk akun berbeda demi keamanan biometrik.`,
      );
    }

    // Tier 2: Sibling / Identical twin resemblance (0.50 <= similarity < 0.90)
    if (isSiblingExempt) {
      this.logger.log(
        `[SIBLING_EXEMPTION_APPLIED] Employee ${currentEmployeeId} enrolled face with ${bestMatch.similarity}% resemblance to ${bestMatch.fullName} (${bestMatch.employeeCode}) under HR exemption approved by: ${approvedBy || 'HR Admin'}.`,
      );
      return;
    }

    // Not exempt: Block and direct user to HR Admin for sibling exemption verification
    throwRpcError(
      409,
      where,
      'Biometric conflict detected',
      `Wajah sudah terdaftar! Wajah ini memiliki kemiripan biometrik ${bestMatch.similarity}% dengan profil karyawan '${bestMatch.fullName}' (${bestMatch.employeeCode}). Jika Anda memiliki saudara kandung atau kembar di Dexa Group, hubungi HR Admin untuk mengaktifkan Sibling Biometric Exemption.`,
    );
  }

  // Feature: Biometric Sibling Exemption — Purpose: Enables or disables the sibling exemption override flag for an employee with an identical twin or high facial resemblance.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: PATCH /api/employees/:id/sibling-exemption -> EmployeesController.toggleSiblingExemption().
  async toggleSiblingExemption(payload: {
    actor: ActorContext;
    id: string;
    dto: ToggleSiblingExemptionDto;
  }): Promise<StandardApiResponse> {
    const where = 'Master Employee - Sibling Exemption';
    const employee = await this.employeeRepo.findOne({
      where: { id: payload.id },
      relations: ['user', 'departmentRef'],
    });

    if (!employee) {
      throwRpcError(404, where, 'Employee not found', `No employee record exists with ID "${payload.id}".`);
    }

    employee.isSiblingExempt = Boolean(payload.dto.isSiblingExempt);
    employee.siblingExemptReason = payload.dto.reason || null;
    employee.siblingExemptApprovedBy = payload.dto.isSiblingExempt
      ? `${payload.actor.fullName} (${payload.actor.email})`
      : null;

    const saved = await this.employeeRepo.save(employee);

    return buildResponse({
      type: 'success',
      where,
      what: `${saved.isSiblingExempt ? 'Granted' : 'Revoked'} sibling biometric exemption for ${saved.fullName}`,
      why: saved.isSiblingExempt
        ? `Employee is now exempted from sibling face conflict checks (Approved by: ${saved.siblingExemptApprovedBy}).`
        : 'Sibling biometric exemption has been revoked.',
      data: this.serializeEmployee(saved),
    });
  }

  serializeEmployee(emp: Employee) {
    const baseSalary = Number(emp.baseSalary ?? 12000000);
    return {
      id: emp.id,
      userId: emp.userId,
      employeeCode: emp.employeeCode,
      fullName: emp.fullName,
      email: emp.email,
      department: emp.department,
      departmentId: emp.departmentId ?? emp.departmentRef?.id ?? null,
      managerName: emp.departmentRef?.managerName ?? null,
      managerEmail: emp.departmentRef?.managerEmail ?? null,
      maxWfhDaysPerWeek: emp.departmentRef?.maxWfhDaysPerWeek ?? 1,
      position: emp.position,
      phoneNumber: emp.phoneNumber,
      joinDate: emp.joinDate,
      baseSalary,
      hourlyOvertimeRate: Math.round(baseSalary / 173),
      status: emp.status,
      isActive: emp.isActive,
      avatarUrl: emp.avatarUrl,
      homeLatitude: emp.homeLatitude !== null && emp.homeLatitude !== undefined ? Number(emp.homeLatitude) : null,
      homeLongitude: emp.homeLongitude !== null && emp.homeLongitude !== undefined ? Number(emp.homeLongitude) : null,
      homeAddress: emp.homeAddress ?? null,
      isSiblingExempt: Boolean(emp.isSiblingExempt),
      siblingExemptReason: emp.siblingExemptReason ?? null,
      siblingExemptApprovedBy: emp.siblingExemptApprovedBy ?? null,
      role: emp.user?.role ?? UserRole.EMPLOYEE,
      isVerified: emp.user?.isVerified ?? false,
      lastLoginAt: emp.user?.lastLoginAt ?? null,
      createdAt: emp.createdAt,
      updatedAt: emp.updatedAt,
      deletedAt: emp.deletedAt,
    };
  }
}

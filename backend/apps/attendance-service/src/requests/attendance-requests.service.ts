// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  ActorContext,
  ActorPayload,
  ApprovalStatus,
  Attendance,
  AttendanceRequest,
  AttendanceRequestQueryPayload,
  AttendanceRequestType,
  AttendanceStatus,
  CreateAttendanceRequestPayload,
  Department,
  Employee,
  MailDispatchResult,
  PhotoCaptureSource,
  ReviewAttendanceRequestPayload,
  SmtpMailerService,
  StandardApiResponse,
  User,
  UserRole,
  WfhWorkflowMode,
  buildPaginationMeta,
  buildResponse,
  calculateOvertimeAndPay,
  describeMailDispatch,
  evaluateClockIn,
  evaluateClockOut,
  getIsoWeekRange,
  getWorkScheduleConfig,
  jakartaDateTimeToUtc,
  resolvePagination,
  throwRpcError,
  toJakartaDateString,
} from '@app/common';
import { AttendanceService } from '../attendance/attendance.service';

// Feature: Hybrid WFH Approval, Overtime & Leave Requests — Purpose: Implements WFH Approval (1 Day/Week quota), Overtime Pay requests, Leave/Sick/Correction, and SMTP routing to Manager & HRD.
// OOP: Injectable Domain Service (Business Logic Encapsulation) — Connected To: AttendanceServiceController (@MessagePattern ATTENDANCE_REQUEST_PATTERNS) -> api-gateway, libs/common smtp-mailer.service.ts.
@Injectable()
export class AttendanceRequestsService {
  private readonly logger = new Logger(AttendanceRequestsService.name);
  private static readonly EMAIL_BODY_ANCHOR = '<div style="padding:24px;color:#1e293b;">';

  constructor(
    @InjectRepository(AttendanceRequest)
    private readonly requestRepo: Repository<AttendanceRequest>,
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly attendanceService: AttendanceService,
    private readonly mailer: SmtpMailerService,
  ) {}

  // Feature: Hybrid WFH, Overtime & Leave Submission — Purpose: Validates weekly WFH quota (1 day/week), calculates overtime pay (1/173 * 1.5x/2.0x), saves request, and emails Manager + HRD.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: POST /api/attendance-requests -> frontend/src/components/custom/LeaveAndCorrectionModal.tsx.
  async create(payload: CreateAttendanceRequestPayload): Promise<StandardApiResponse> {
    const where = 'Attendance Request - Submit & Dispatch Email';
    const employee = await this.attendanceService.requireActiveEmployee(payload.actor.userId, payload.actor.employeeId, where);
    const { dto, attachmentUrl } = payload;

    const policy = await this.attendanceService.getSystemPolicy();
    const dept = await this.departmentRepo.findOne({ where: { name: employee.department } });
    const wfhWorkflowMode = policy.wfhWorkflowMode ?? dept?.wfhWorkflowMode ?? WfhWorkflowMode.STRICT_APPROVAL;
    const enableOvertime = policy.enableOvertime ?? dept?.enableOvertime ?? true;
    const hrPicEmail = dept?.hrPicEmail ?? 'admin.hrd@dexagroup.com';
    const isManagerOrAdmin = payload.actor.role === UserRole.MANAGER || payload.actor.role === UserRole.SYSTEM_ADMIN;
    const managerName = isManagerOrAdmin
      ? 'Dr. Rina Kusuma, M.Psi (Head of HRD & People Operations)'
      : (dept?.managerName ?? 'Ir. Hendra Wijaya, M.Kom');
    const managerEmail = isManagerOrAdmin
      ? hrPicEmail
      : (dept?.managerEmail ?? 'manager.it@dexagroup.com');
    const maxWfhDaysPerWeek = policy.maxWfhDaysPerWeek ?? dept?.maxWfhDaysPerWeek ?? 1;
    // A manager or system admin request also copies the active System Administrator accounts from the users table.
    const adminCc = isManagerOrAdmin ? await this.findActiveSystemAdminEmails() : [];
    const ccList = Array.from(
      new Set([...adminCc, hrPicEmail, employee.email].map((address) => address.trim().toLowerCase()).filter(Boolean)),
    );

    if (dto.requestType === AttendanceRequestType.CORRECTION && !dto.requestedClockIn && !dto.requestedClockOut) {
      throwRpcError(
        400,
        where,
        'Missing correction timestamps',
        'Attendance Correction requests must specify at least a requested Clock-In or Clock-Out time (HH:mm).',
      );
    }

    const requestedClockIn = dto.requestedClockIn ? jakartaDateTimeToUtc(dto.targetDate, dto.requestedClockIn) : null;
    const requestedClockOut = dto.requestedClockOut ? jakartaDateTimeToUtc(dto.targetDate, dto.requestedClockOut) : null;

    if (requestedClockIn && requestedClockOut && requestedClockOut.getTime() <= requestedClockIn.getTime()) {
      throwRpcError(
        400,
        where,
        'Invalid correction time range',
        'Requested Clock-Out time must be later than the requested Clock-In time.',
      );
    }

    let overtimeMinutes = 0;
    let estimatedOvertimePay = 0;

    if (dto.requestType === AttendanceRequestType.WFH_APPROVAL) {
      const duplicateSameDay = await this.requestRepo.findOne({
        where: {
          employeeId: employee.id,
          requestType: AttendanceRequestType.WFH_APPROVAL,
          targetDate: dto.targetDate,
          status: In([ApprovalStatus.PENDING, ApprovalStatus.APPROVED]),
        },
      });
      if (duplicateSameDay) {
        throwRpcError(
          409,
          where,
          'Duplicate WFH request for this date',
          `You already have a ${duplicateSameDay.status} WFH request for ${dto.targetDate}.`,
        );
      }

      const { weekStart, weekEnd } = getIsoWeekRange(dto.targetDate);
      const usedThisWeek = await this.requestRepo
        .createQueryBuilder('req')
        .where('req.employeeId = :empId', { empId: employee.id })
        .andWhere('req.requestType = :type', { type: AttendanceRequestType.WFH_APPROVAL })
        .andWhere('req.status IN (:...statuses)', { statuses: [ApprovalStatus.PENDING, ApprovalStatus.APPROVED] })
        .andWhere('req.targetDate BETWEEN :weekStart AND :weekEnd', { weekStart, weekEnd })
        .getCount();

      if (usedThisWeek >= maxWfhDaysPerWeek) {
        throwRpcError(
          400,
          where,
          `Weekly WFH quota reached (${usedThisWeek}/${maxWfhDaysPerWeek} day used)`,
          `Hybrid WFH policy allows max ${maxWfhDaysPerWeek} day per week. You already have a WFH request in week ${weekStart} to ${weekEnd}.`,
        );
      }
    } else if (dto.requestType === AttendanceRequestType.OVERTIME) {
      if (!enableOvertime) {
        throwRpcError(
          400,
          where,
          'Overtime request is disabled',
          'Overtime pay calculation and overtime requests are currently disabled by company policy.',
        );
      }
      const requestedMins = dto.overtimeMinutes && dto.overtimeMinutes >= 30 ? dto.overtimeMinutes : 120;
      const otCalc = calculateOvertimeAndPay(requestedMins, Number(employee.baseSalary ?? 12000000));
      overtimeMinutes = otCalc.overtimeMinutes;
      estimatedOvertimePay = otCalc.overtimePayAmount;
    }

    const isNoticeOnlyWfh =
      dto.requestType === AttendanceRequestType.WFH_APPROVAL &&
      wfhWorkflowMode === WfhWorkflowMode.NOTICE_ONLY;

    // Email dispatched after record creation below with requestId

    let emailDispatched = false;
    const record = this.requestRepo.create({
      employeeId: employee.id,
      requestType: dto.requestType,
      targetDate: dto.targetDate,
      requestedClockIn,
      requestedClockOut,
      overtimeMinutes,
      estimatedOvertimePay,
      managerEmail,
      ccEmails: ccList.join(', '),
      emailDispatched,
      reason: dto.reason,
      attachmentUrl,
      status: isNoticeOnlyWfh ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING,
      reviewNotes: isNoticeOnlyWfh ? 'Auto-approved via Notice-Only workflow policy' : null,
      reviewedAt: isNoticeOnlyWfh ? new Date() : null,
    });
    const saved = await this.requestRepo.save(record);
    saved.employee = employee;

    const dispatch = await this.sendApprovalRequestEmail({
      employee,
      managerName,
      managerEmail,
      ccList,
      requestType: dto.requestType,
      targetDate: dto.targetDate,
      reason: dto.reason,
      overtimeMinutes,
      estimatedOvertimePay,
      maxWfhDaysPerWeek,
      isNoticeOnly: isNoticeOnlyWfh,
      requestId: saved.id,
    });
    emailDispatched = dispatch.delivered;
    if (emailDispatched !== record.emailDispatched) {
      saved.emailDispatched = emailDispatched;
      await this.requestRepo.update(saved.id, { emailDispatched });
    }

    const labelMap: Record<AttendanceRequestType, string> = {
      [AttendanceRequestType.WFH_APPROVAL]: isNoticeOnlyWfh ? 'WFH Notice' : 'WFH Approval',
      [AttendanceRequestType.OVERTIME]: 'Overtime (Lembur)',
      [AttendanceRequestType.LEAVE]: 'Annual Leave',
      [AttendanceRequestType.SICK]: 'Sick Leave',
      [AttendanceRequestType.CORRECTION]: 'Attendance Correction',
    };
    const typeLabel = labelMap[dto.requestType] ?? dto.requestType;

    const deliveryReport = describeMailDispatch(dispatch);
    if (!emailDispatched) {
      return buildResponse({
        type: 'info',
        where,
        what: `${typeLabel} saved, email not delivered`,
        why: isNoticeOnlyWfh
          ? `Notice for ${dto.targetDate} is saved and Clock-In is unlocked, but the email to Manager (${managerEmail}) did not go out. ${deliveryReport}`
          : `Request for ${dto.targetDate} is saved as PENDING in the review queue, but the email to Manager (${managerEmail}) did not go out. ${deliveryReport}`,
        data: saved,
      });
    }

    return buildResponse({
      where,
      what: isNoticeOnlyWfh
        ? `WFH Notice delivered to ${managerEmail} (Clock-In Unlocked)`
        : `${typeLabel} submitted & emailed to ${managerEmail}`,
      why: isNoticeOnlyWfh
        ? `Notice for ${dto.targetDate} is recorded and Clock-In is unlocked under Notice-Only policy. ${deliveryReport}`
        : `Request for ${dto.targetDate} queued (PENDING) for Manager & HRD review. ${deliveryReport}`,
      data: saved,
    });
  }

  // Feature: Personal Attendance Requests — Purpose: Returns all WFH, Overtime, Leave, Sick, and Correction requests submitted by the signed-in employee.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: GET /api/attendance-requests/my -> frontend MyAttendanceHistoryPage.tsx & LeaveAndCorrectionModal.tsx.
  async findMyRequests(payload: ActorPayload): Promise<StandardApiResponse> {
    const where = 'Attendance Request - My Requests';
    const employee = await this.attendanceService.requireActiveEmployee(payload.actor.userId, payload.actor.employeeId, where);

    const items = await this.requestRepo.find({
      where: { employeeId: employee.id },
      relations: ['employee'],
      order: { createdAt: 'DESC' },
    });

    return buildResponse({
      type: 'info',
      where,
      what: `Loaded ${items.length} personal attendance request(s)`,
      why: `Retrieved WFH approval, overtime, leave, sick, and correction requests for ${employee.fullName}.`,
      data: items,
    });
  }

  // Feature: HRD Request Queue & Approval Workflow — Purpose: Lists all employee WFH, Overtime, Leave, Sick, and Correction requests for HRD Admin with filtering and pagination.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: GET /api/attendance-requests -> frontend AttendanceMonitoringPage.tsx (Requests tab).
  async findAll(payload: AttendanceRequestQueryPayload): Promise<StandardApiResponse> {
    const where = 'HRD Admin - Attendance Requests';
    const { query } = payload;
    const { page, limit, skip } = resolvePagination(query.page, query.limit);

    const qb = this.requestRepo
      .createQueryBuilder('req')
      .withDeleted()
      .leftJoinAndSelect('req.employee', 'employee')
      .orderBy('req.createdAt', 'DESC');

    if (payload.actor.role === UserRole.MANAGER) {
      const managerEmployee = await this.employeeRepo.findOne({ where: { userId: payload.actor.userId } });
      if (managerEmployee) {
        qb.andWhere('employee.department = :mgrDept', { mgrDept: managerEmployee.department });
      }
    }

    if (query.status) {
      qb.andWhere('req.status = :status', { status: query.status });
    }
    if (query.requestType) {
      qb.andWhere('req.requestType = :requestType', { requestType: query.requestType });
    }
    if (query.search) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(employee.fullName) LIKE :search OR LOWER(employee.employeeCode) LIKE :search OR LOWER(req.reason) LIKE :search)',
        { search },
      );
    }

    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return buildResponse({
      type: 'info',
      where,
      what: `Loaded ${items.length} of ${total} attendance request(s)`,
      why: query.status ? `Filtered attendance requests with status ${query.status}.` : 'Retrieved employee WFH, overtime, leave, sick, and correction requests.',
      data: items,
      meta: buildPaginationMeta(page, limit, total),
    });
  }

  // Feature: HRD Request Review & Payroll Sync — Purpose: Approves or rejects an AttendanceRequest, syncs the `attendances` table (WFH/Overtime/Leave/Correction), and emails the employee.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: PATCH /api/attendance-requests/:id/review -> frontend AttendanceMonitoringPage.tsx.
  async review(payload: ReviewAttendanceRequestPayload): Promise<StandardApiResponse> {
    const where = 'HRD Admin - Review Attendance Request';
    const req = await this.requestRepo.findOne({
      where: { id: payload.id },
      relations: ['employee'],
      withDeleted: true,
    });
    if (!req) {
      throwRpcError(404, where, 'Attendance request not found', `No request exists with ID "${payload.id}".`);
    }
    if (payload.actor.role === UserRole.MANAGER) {
      const managerEmployee = await this.employeeRepo.findOne({ where: { userId: payload.actor.userId } });
      if (managerEmployee && req.employee && req.employee.department !== managerEmployee.department) {
        throwRpcError(403, where, 'Unauthorized department review', 'You can only review attendance requests for employees in your department.');
      }
    }

    if (req.status !== ApprovalStatus.PENDING) {
      throwRpcError(400, where, 'Request already reviewed', `This request has already been marked as ${req.status}.`);
    }

    req.status = payload.dto.decision;
    req.reviewedById = payload.actor.userId;
    req.reviewNotes = payload.dto.reviewNotes ?? null;
    req.reviewedAt = new Date();
    const savedReq = await this.requestRepo.save(req);

    let syncedAttendance: Attendance | null = null;
    if (payload.dto.decision === ApprovalStatus.APPROVED) {
      syncedAttendance = await this.syncApprovedRequestToAttendance(req);
    }

    const decisionMail = req.employee ? await this.sendDecisionNotificationEmail(req, payload.actor) : null;
    const decisionMailReport = decisionMail
      ? decisionMail.delivered
        ? ` Decision email: ${describeMailDispatch(decisionMail)}`
        : ` Decision email not delivered: ${describeMailDispatch(decisionMail)}`
      : '';

    const empName = req.employee?.fullName ?? 'Employee';
    return buildResponse({
      where,
      what: `${payload.dto.decision === ApprovalStatus.APPROVED ? 'Approved' : 'Rejected'} ${req.requestType} for ${empName}`,
      why:
        payload.dto.decision === ApprovalStatus.APPROVED
          ? `Request approved and attendance record for ${req.targetDate} synced.${decisionMailReport}`
          : `Request marked as REJECTED${payload.dto.reviewNotes ? `: "${payload.dto.reviewNotes}".` : '.'}${decisionMailReport}`,
      data: {
        request: savedReq,
        syncedAttendance,
      },
    });
  }

  // Feature: Automated Attendance & Overtime Payroll Sync — Purpose: Upserts the employee's `attendances` record on `targetDate` when HRD approves WFH_APPROVAL, OVERTIME, LEAVE, SICK, or CORRECTION.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: Called by review() above.
  private async syncApprovedRequestToAttendance(req: AttendanceRequest): Promise<Attendance> {
    const schedule = getWorkScheduleConfig();
    const baseSalary = Number(req.employee?.baseSalary ?? 12000000);
    let attendance = await this.attendanceRepo.findOne({
      where: { employeeId: req.employeeId, attendanceDate: req.targetDate },
    });

    const todayDate = toJakartaDateString(new Date());
    if (!attendance) {
      if (req.requestType === AttendanceRequestType.WFH_APPROVAL && req.targetDate > todayDate) {
        return null as any;
      }
      attendance = this.attendanceRepo.create({
        employeeId: req.employeeId,
        attendanceDate: req.targetDate,
        wfhApproved: req.requestType === AttendanceRequestType.WFH_APPROVAL,
        status: req.requestType === AttendanceRequestType.WFH_APPROVAL || req.requestType === AttendanceRequestType.OVERTIME
          ? AttendanceStatus.ON_TIME
          : AttendanceStatus.ON_LEAVE,
      });
    } else if (req.requestType !== AttendanceRequestType.WFH_APPROVAL && !attendance.clockInTime) {
      attendance.wfhApproved = false;
    }

    if (req.requestType === AttendanceRequestType.WFH_APPROVAL) {
      attendance.wfhApproved = true;
      attendance.dailyPlan = attendance.dailyPlan ?? `Approved Hybrid WFH (1 Day/Week): ${req.reason}`;
      attendance.hrNote = req.reviewNotes ?? 'Approved Hybrid WFH (1 Day/Week Quota) by Manager & HRD';
    } else if (req.requestType === AttendanceRequestType.OVERTIME) {
      const otCalc = calculateOvertimeAndPay(req.overtimeMinutes || 120, baseSalary);
      attendance.overtimeMinutes = otCalc.overtimeMinutes;
      attendance.overtimeMultiplierHours = otCalc.overtimeMultiplierHours;
      attendance.overtimePayAmount = otCalc.overtimePayAmount;
      attendance.dailyAccomplishment = attendance.dailyAccomplishment ?? `Approved Overtime (${otCalc.overtimeMinutes}m): ${req.reason}`;
      attendance.hrNote =
        req.reviewNotes ??
        `Approved Overtime: ${otCalc.overtimeMinutes}m (${otCalc.overtimeMultiplierHours}x hrs = IDR ${otCalc.overtimePayAmount.toLocaleString('id-ID')})`;
    } else if (req.requestType === AttendanceRequestType.LEAVE) {
      attendance.status = AttendanceStatus.ON_LEAVE;
      attendance.dailyPlan = `Approved Leave: ${req.reason}`;
      attendance.hrNote = req.reviewNotes ?? 'Approved Annual/Personal Leave by HRD';
      attendance.isTimestampVerified = true;
    } else if (req.requestType === AttendanceRequestType.SICK) {
      attendance.status = AttendanceStatus.SICK;
      attendance.dailyPlan = `Approved Sick Leave: ${req.reason}`;
      attendance.hrNote = req.reviewNotes ?? 'Approved Medical/Sick Leave by HRD';
      if (req.attachmentUrl) {
        attendance.clockInPhotoUrl = req.attachmentUrl;
      }
      attendance.isTimestampVerified = true;
    } else {
      const clockIn = req.requestedClockIn ?? attendance.clockInTime ?? jakartaDateTimeToUtc(req.targetDate, schedule.workStartTime);
      const clockOut = req.requestedClockOut ?? attendance.clockOutTime;
      attendance.clockInTime = clockIn;
      const inEval = evaluateClockIn(clockIn, schedule);
      attendance.lateMinutes = inEval.lateMinutes;
      attendance.status = inEval.status;

      if (clockOut) {
        attendance.clockOutTime = clockOut;
        const outEval = evaluateClockOut(clockIn, clockOut, schedule);
        attendance.workDurationMinutes = outEval.workDurationMinutes;
        attendance.status = outEval.status;
        const otCalc = calculateOvertimeAndPay(outEval.overtimeMinutes, baseSalary);
        attendance.overtimeMinutes = otCalc.overtimeMinutes;
        attendance.overtimeMultiplierHours = otCalc.overtimeMultiplierHours;
        attendance.overtimePayAmount = otCalc.overtimePayAmount;
      }
      if (req.attachmentUrl && !attendance.clockInPhotoUrl) {
        attendance.clockInPhotoUrl = req.attachmentUrl;
      }
      attendance.photoCaptureSource = attendance.photoCaptureSource ?? PhotoCaptureSource.FILE_UPLOAD;
      attendance.isTimestampVerified = true;
      attendance.dailyAccomplishment = attendance.dailyAccomplishment ?? `Corrected via HRD approval: ${req.reason}`;
      attendance.hrNote = req.reviewNotes ?? 'Attendance timestamps corrected via HRD approval';
    }

    return this.attendanceRepo.save(attendance);
  }

  // Feature: Request Email Routing — Purpose: Returns the email of every active System Administrator account so manager requests copy the real admins.
  // OOP: Private Repository Query — Connected To: create() above and the users table (role SYSTEM_ADMIN, is_active).
  private async findActiveSystemAdminEmails(): Promise<string[]> {
    const admins = await this.userRepo.find({ where: { role: UserRole.SYSTEM_ADMIN, isActive: true } });
    const emails = admins.map((admin) => admin.email).filter(Boolean);
    return emails.length > 0 ? emails : ['sysadmin@dexagroup.com'];
  }

  // Feature: Department Manager & HRD SMTP Dispatch — Purpose: Sends the approval request as the employee (relay mode) or from the system sender, To the Department Manager and Cc HRD plus the employee.
  // OOP: Encapsulated Helper Method — Connected To: create() above -> libs/common SmtpMailerService.send() (SMTP_SENDER_MODE).
  private async sendApprovalRequestEmail(params: {
    employee: Employee;
    managerName: string;
    managerEmail: string;
    ccList: string[];
    requestType: AttendanceRequestType;
    targetDate: string;
    reason: string;
    overtimeMinutes: number;
    estimatedOvertimePay: number;
    maxWfhDaysPerWeek: number;
    isNoticeOnly?: boolean;
    requestId?: string;
  }): Promise<MailDispatchResult> {
    const {
      employee,
      managerName,
      managerEmail,
      ccList,
      requestType,
      targetDate,
      reason,
      overtimeMinutes,
      estimatedOvertimePay,
      maxWfhDaysPerWeek,
      isNoticeOnly,
      requestId,
    } = params;

    const baseSalary = Number(employee.baseSalary ?? 12000000);
    const hourlyRate = Math.round(baseSalary / 173);
    const subject = isNoticeOnly
      ? `Dexa Group WFH Notification — ${employee.fullName} (${employee.employeeCode}) for ${targetDate}`
      : `Dexa Group ${requestType.replace('_', ' ')} Request — ${employee.fullName} (${employee.employeeCode}) for ${targetDate}`;

    const extraSection =
      requestType === AttendanceRequestType.WFH_APPROVAL
        ? `<p style="margin:6px 0;font-size:13px;color:#1e3a8a;"><strong>Weekly Hybrid WFH Policy:</strong> Max ${maxWfhDaysPerWeek} Day / Week (${isNoticeOnly ? 'Notice Dispatched' : 'Within Approved Quota'})</p>`
        : requestType === AttendanceRequestType.OVERTIME
          ? `<p style="margin:6px 0;font-size:13px;color:#065f46;"><strong>Overtime Duration & Payroll Rate (PP 35/2021):</strong> ${overtimeMinutes} mins • Base Hourly Rate IDR ${hourlyRate.toLocaleString('id-ID')} (1/173) • Estimated Overtime Pay: <strong>IDR ${estimatedOvertimePay.toLocaleString('id-ID')}</strong></p>`
          : '';

    const html = `
      <div style="font-family:'Inter',Arial,sans-serif;max-width:640px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#ffffff;">
        <div style="background:linear-gradient(135deg,#0A2D62 0%,#1a3d6e 100%);padding:20px 24px;color:#ffffff;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;opacity:0.85;">Dexa Group • Hybrid WFH & Payroll Approval Routing</div>
          <h2 style="margin:6px 0 0;font-size:18px;font-weight:700;">${isNoticeOnly ? 'WFH Shift Notification (Notice Only)' : `${requestType.replace('_', ' ')} Approval Request`}</h2>
        </div>
        <div style="padding:24px;color:#1e293b;">
          <p style="margin:0 0 12px;font-size:14px;">Dear <strong>${managerName}</strong> (${employee.department}) &amp; HRD Operations,</p>
          <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#475569;">
            ${
              isNoticeOnly
                ? `<strong>${employee.fullName}</strong> (${employee.employeeCode} — ${employee.position}) has dispatched a <strong>WFH Notification</strong> for <strong>${targetDate}</strong> under Dexa's Notice-Only WFH policy.`
                : `<strong>${employee.fullName}</strong> (${employee.employeeCode} — ${employee.position}) has submitted a <strong>${requestType.replace('_', ' ')}</strong> request for <strong>${targetDate}</strong> requiring Manager &amp; HRD review.`
            }
          </p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;margin-bottom:16px;">
            <p style="margin:4px 0;font-size:13px;"><strong>Employee:</strong> ${employee.fullName} (${employee.employeeCode})</p>
            <p style="margin:4px 0;font-size:13px;"><strong>Department:</strong> ${employee.department} (Manager: ${managerEmail})</p>
            <p style="margin:4px 0;font-size:13px;"><strong>Target Date:</strong> ${targetDate}</p>
            ${extraSection}
            <p style="margin:8px 0 0;font-size:13px;"><strong>Deliverables / Reason:</strong> ${reason}</p>
          </div>
          ${!isNoticeOnly && requestId ? `
          <div style="margin:24px 0 16px;text-align:center;">
            <a href="http://localhost:5173/manager/approvals?requestId=${requestId}" style="background-color:#0A2D62;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:10px;font-weight:600;font-size:13px;display:inline-block;letter-spacing:0.3px;">
              Review &amp; Approve in System Portal &rarr;
            </a>
          </div>
          <p style="margin:0 0 16px;font-size:11px;color:#64748b;text-align:center;">
            Direct Deep-Link: Approvals are authenticated and securely recorded directly within the Dexa WFH Attendance Portal.
          </p>
          ` : isNoticeOnly ? `
          <div style="margin:20px 0 12px;text-align:center;">
            <a href="http://localhost:5173/manager/approvals" style="background-color:#f1f5f9;color:#0A2D62;padding:10px 22px;text-decoration:none;border:1px solid #cbd5e1;border-radius:8px;font-weight:600;font-size:12px;display:inline-block;">
              View Team Attendance in Portal &rarr;
            </a>
          </div>
          ` : ''}
          <p style="margin:0;font-size:11px;color:#64748b;">
            © 2026 Abdurrahman Khairi - Created strictly for Technical Assessment evaluation. Unauthorized commercial use is prohibited
          </p>
        </div>
      </div>
    `;

    // The employee is the sender: SMTP_SENDER_MODE=relay sends as the employee, otherwise the system sender sends on their behalf.
    const result = await this.mailer.send({
      sender: { email: employee.email, name: employee.fullName },
      to: [managerEmail],
      cc: ccList,
      subject,
      text: `${subject}\nEmployee: ${employee.fullName} (${employee.employeeCode})\nDepartment: ${employee.department}\nTarget Date: ${targetDate}\nReason: ${reason}${!isNoticeOnly && requestId ? `\nReview: http://localhost:5173/manager/approvals?requestId=${requestId}` : ''}`,
      html,
      bannerAnchor: AttendanceRequestsService.EMAIL_BODY_ANCHOR,
    });
    this.logger.log(`[REQUEST_EMAIL] ${requestType} ${requestId ?? ''} -> delivered=${result.delivered} mode=${result.mode} intendedTo=${managerEmail} intendedCc=${ccList.join(', ')}`);
    return result;
  }

  // Feature: Approval Decision Email Notification — Purpose: Sends the decision as the reviewer (relay mode) or from the system sender, To the employee and Cc the Department Manager and the department HR PIC.
  // OOP: Encapsulated Helper Method — Connected To: review() above -> libs/common SmtpMailerService.send() and the departments table (hr_pic_email).
  private async sendDecisionNotificationEmail(req: AttendanceRequest, reviewer: ActorContext): Promise<MailDispatchResult | null> {
    if (!req.employee) return null;
    const reviewerEmail = reviewer.email;
    const toEmail = req.employee.email;
    const dept = await this.departmentRepo.findOne({ where: { name: req.employee.department } });
    const ccEmails = [req.managerEmail, dept?.hrPicEmail ?? 'admin.hrd@dexagroup.com'].filter(Boolean) as string[];
    const subject = `Dexa Group ${req.requestType.replace('_', ' ')} ${req.status} — ${req.targetDate}`;
    const isApproved = req.status === ApprovalStatus.APPROVED;

    const html = `
      <div style="font-family:'Inter',Arial,sans-serif;max-width:640px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#ffffff;">
        <div style="background:linear-gradient(135deg,#0A2D62 0%,#1a3d6e 100%);padding:20px 24px;color:#ffffff;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;opacity:0.85;">Dexa Group • Attendance Request Review</div>
          <h2 style="margin:6px 0 0;font-size:18px;font-weight:700;">Request ${req.status}: ${req.requestType.replace('_', ' ')}</h2>
        </div>
        <div style="padding:24px;color:#1e293b;">
          <p style="margin:0 0 12px;font-size:14px;">Hello <strong>${req.employee.fullName}</strong>,</p>
          <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#475569;">
            Your <strong>${req.requestType.replace('_', ' ')}</strong> request for <strong>${req.targetDate}</strong> has been reviewed and marked as:
          </p>
          <div style="padding:14px 18px;border-radius:8px;margin-bottom:16px;background:${isApproved ? '#ecfdf5' : '#fef2f2'};border:1px solid ${isApproved ? '#a7f3d0' : '#fecaca'};">
            <span style="font-weight:700;font-size:15px;color:${isApproved ? '#065f46' : '#991b1b'};">
              ● ${req.status}
            </span>
            ${req.reviewNotes ? `<p style="margin:8px 0 0;font-size:13px;color:#334155;"><strong>Reviewer Notes:</strong> ${req.reviewNotes}</p>` : ''}
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:12px;color:#64748b;">
            <div>Target Date: <strong style="color:#0f172a;">${req.targetDate}</strong></div>
            <div>Department Manager: <strong style="color:#0f172a;">${req.managerEmail}</strong></div>
            <div>Reviewed By: <strong style="color:#0f172a;">${reviewerEmail || 'HRD Administration'}</strong></div>
          </div>
          <p style="margin:0;font-size:11px;color:#64748b;">
            © 2026 Abdurrahman Khairi - Created strictly for Technical Assessment evaluation. Unauthorized commercial use is prohibited
          </p>
        </div>
      </div>
    `;

    // The reviewer is the sender: SMTP_SENDER_MODE=relay sends as the reviewer, otherwise the system sender sends on their behalf.
    const result = await this.mailer.send({
      sender: { email: reviewerEmail || 'admin.hrd@dexagroup.com', name: reviewer.fullName || 'Dexa Group HRD Approval' },
      to: [toEmail],
      cc: ccEmails,
      subject,
      text: `Your ${req.requestType} request for ${req.targetDate} has been marked as ${req.status}. Notes: ${req.reviewNotes ?? 'None'}. Reviewed by ${reviewerEmail || 'HRD Administration'}.`,
      html,
      bannerAnchor: AttendanceRequestsService.EMAIL_BODY_ANCHOR,
    });
    this.logger.log(`[DECISION_EMAIL] ${req.id} ${req.status} -> delivered=${result.delivered} mode=${result.mode} intendedTo=${toEmail} intendedCc=${ccEmails.join(', ')}`);
    return result;
  }
}

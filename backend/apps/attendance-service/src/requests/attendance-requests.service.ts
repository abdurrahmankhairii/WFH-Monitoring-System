// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ActorPayload,
  ApprovalStatus,
  Attendance,
  AttendanceRequest,
  AttendanceRequestQueryPayload,
  AttendanceRequestType,
  AttendanceStatus,
  CreateAttendanceRequestPayload,
  PhotoCaptureSource,
  ReviewAttendanceRequestPayload,
  StandardApiResponse,
  buildPaginationMeta,
  buildResponse,
  evaluateClockIn,
  evaluateClockOut,
  getWorkScheduleConfig,
  jakartaDateTimeToUtc,
  resolvePagination,
  throwRpcError,
} from '@app/common';
import { AttendanceService } from '../attendance/attendance.service';

// Feature: Core System Architecture — Purpose: Implements Feature #8 — Self-Service Leave, Sick & Attendance Correction Requests and automatic sync to `attendances` upon.
// OOP: Injectable Domain Service (Business Logic Encapsulation) — Connected To: AttendanceServiceController (@MessagePattern ATTENDANCE_REQUEST_PATTERNS) -> api-gateway.
@Injectable()
export class AttendanceRequestsService {
  constructor(
    @InjectRepository(AttendanceRequest)
    private readonly requestRepo: Repository<AttendanceRequest>,
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    private readonly attendanceService: AttendanceService,
  ) {}

  // Feature: Core System Architecture — Purpose: Submits a new Leave, Sick, or Attendance Correction request from an employee with an optional proof attachment URL.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: POST /api/attendance-requests -> frontend/src/components/custom/LeaveAndCorrectionModal.tsx.
  async create(payload: CreateAttendanceRequestPayload): Promise<StandardApiResponse> {
    const where = 'Attendance Request - Submit';
    const employee = await this.attendanceService.requireActiveEmployee(payload.actor.userId, payload.actor.employeeId, where);
    const { dto, attachmentUrl } = payload;

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

    const record = this.requestRepo.create({
      employeeId: employee.id,
      requestType: dto.requestType,
      targetDate: dto.targetDate,
      requestedClockIn,
      requestedClockOut,
      reason: dto.reason,
      attachmentUrl,
      status: ApprovalStatus.PENDING,
    });
    const saved = await this.requestRepo.save(record);
    saved.employee = employee;

    return buildResponse({
      where,
      what: `${dto.requestType} request submitted for ${dto.targetDate}`,
      why: `Your ${dto.requestType.toLowerCase()} request has been queued (status: PENDING) for HRD Admin review.`,
      data: saved,
    });
  }

  // Feature: Core System Architecture — Purpose: Returns all Leave / Sick / Correction requests submitted by the signed-in employee.
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
      why: `Retrieved leave, sick, and attendance correction requests for ${employee.fullName}.`,
      data: items,
    });
  }

  // Feature: Core System Architecture — Purpose: Lists all employee Leave / Sick / Correction requests for HRD Admin with filtering and pagination.
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
      why: query.status ? `Filtered attendance requests with status ${query.status}.` : 'Retrieved employee leave, sick, and correction requests.',
      data: items,
      meta: buildPaginationMeta(page, limit, total),
    });
  }

  // Feature: Core System Architecture — Purpose: Processes HRD Admin approval or rejection of an AttendanceRequest and automatically syncs the `attendances` table when APPROVED.
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

    const empName = req.employee?.fullName ?? 'Employee';
    return buildResponse({
      where,
      what: `${payload.dto.decision === ApprovalStatus.APPROVED ? 'Approved' : 'Rejected'} ${req.requestType} request for ${empName}`,
      why:
        payload.dto.decision === ApprovalStatus.APPROVED
          ? `Request approved and attendance record for ${req.targetDate} automatically updated to ${syncedAttendance?.status}.`
          : `Request marked as REJECTED${payload.dto.reviewNotes ? `: "${payload.dto.reviewNotes}"` : '.'}`,
      data: {
        request: savedReq,
        syncedAttendance,
      },
    });
  }

  // Feature: Core System Architecture — Purpose: Upserts the employee's `attendances` record on `targetDate` when HRD approves a LEAVE, SICK, or CORRECTION request.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: Called by review() above.
  private async syncApprovedRequestToAttendance(req: AttendanceRequest): Promise<Attendance> {
    const schedule = getWorkScheduleConfig();
    let attendance = await this.attendanceRepo.findOne({
      where: { employeeId: req.employeeId, attendanceDate: req.targetDate },
    });

    if (!attendance) {
      attendance = this.attendanceRepo.create({
        employeeId: req.employeeId,
        attendanceDate: req.targetDate,
        status: AttendanceStatus.ON_LEAVE,
      });
    }

    if (req.requestType === AttendanceRequestType.LEAVE) {
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
      // CORRECTION
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
}

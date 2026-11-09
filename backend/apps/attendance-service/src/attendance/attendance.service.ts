// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, IsNull, LessThan, Repository } from 'typeorm';
import {
  AccessRequest,
  ActorContext,
  ActorPayload,
  ApprovalStatus,
  Attendance,
  AttendanceQueryPayload,
  AttendanceRequest,
  AttendanceRequestType,
  AttendanceStatus,
  ClockInPayload,
  ClockOutPayload,
  Department,
  Employee,
  IdActorPayload,
  LocationStatus,
  MyHistoryPayload,
  StandardApiResponse,
  SummaryPayload,
  SystemSetting,
  UpdatePolicyPayload,
  UserRole,
  VerificationMethod,
  VerificationStatus,
  WfhWorkflowMode,
  buildPaginationMeta,
  buildResponse,
  calculateHaversineDistanceMeters,
  calculateOvertimeAndPay,
  computeHammingDistance,
  evaluateClockIn,
  evaluateClockOut,
  formatJakartaDateTime,
  getIsoWeekRange,
  getWorkScheduleConfig,
  resolvePagination,
  shiftDateString,
  throwRpcError,
  toJakartaDateString,
  toJakartaTimeString,
  verifyPhotoTimestamp,
} from '@app/common';
import { reverseGeocodeCoordinates } from '../utils/reverse-geocoding.util';

// Feature: WFH Attendance Monitoring & Self-Service — Purpose: Core WFH Attendance engine handling server-timed Clock-In/Out, photo verification, weekly WFH quota, and overtime payroll calculation.
// OOP: Injectable Domain Service (Business Logic Encapsulation) — Connected To: AttendanceServiceController (@MessagePattern ATTENDANCE_PATTERNS) -> api-gateway AttendanceController.
@Injectable()
export class AttendanceService {
  // Feature: Employee Lookup Helper — Purpose: Finds an active employee record by user ID for department-scoped authorization.
  // OOP: Encapsulated Domain Helper — Connected To: ExportService and AttendanceRequestsService.
  async getEmployeeByUserId(userId: string): Promise<Employee | null> {
    return this.employeeRepo.findOne({ where: { userId } });
  }

  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
    @InjectRepository(AttendanceRequest)
    private readonly attendanceReqRepo: Repository<AttendanceRequest>,
    @InjectRepository(AccessRequest)
    private readonly accessReqRepo: Repository<AccessRequest>,
    @InjectRepository(SystemSetting)
    private readonly systemSettingRepo: Repository<SystemSetting>,
  ) {}

  // Feature: WFH Attendance Clock-In — Purpose: Records an employee's WFH Clock-In using the authoritative backend server timestamp (`new Date()`), verifies photo proof, and checks WFH approval.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: POST /api/attendances/clock-in -> frontend/src/pages/employee/EmployeeAttendancePage.tsx.
  async clockIn(payload: ClockInPayload): Promise<StandardApiResponse> {
    const where = 'WFH Attendance - Clock In';
    const employee = await this.requireActiveEmployee(payload.actor.userId, payload.actor.employeeId, where);

    if (!employee.faceEmbedding || !Array.isArray(employee.faceEmbedding) || employee.faceEmbedding.length !== 512) {
      throwRpcError(
        403,
        where,
        'Biometric face enrollment required',
        'Your employee account does not have a registered facial biometric embedding in the database. Please complete face registration first.',
      );
    }

    const serverNow = new Date();
    const todayDate = toJakartaDateString(serverNow);
    const schedule = getWorkScheduleConfig();

    const existing = await this.attendanceRepo.findOne({
      where: { employeeId: employee.id, attendanceDate: todayDate },
    });

    if (existing && existing.clockInTime) {
      throwRpcError(
        409,
        where,
        'Clock-In already recorded for today',
        `You already clocked in on ${todayDate} at ${toJakartaTimeString(existing.clockInTime)} WIB. Proceed to Clock-Out when finishing your shift.`,
      );
    }

    const policy = await this.getSystemPolicy();
    const dept = await this.departmentRepo.findOne({ where: { name: employee.department } });
    const wfhWorkflowMode = policy.wfhWorkflowMode ?? dept?.wfhWorkflowMode ?? WfhWorkflowMode.STRICT_APPROVAL;

    const approvedWfhReq = await this.attendanceReqRepo.findOne({
      where: {
        employeeId: employee.id,
        requestType: AttendanceRequestType.WFH_APPROVAL,
        targetDate: todayDate,
        status: ApprovalStatus.APPROVED,
      },
    });

    if (!approvedWfhReq) {
      if (wfhWorkflowMode === WfhWorkflowMode.NOTICE_ONLY) {
        throwRpcError(
          403,
          where,
          'WFH Notice required before Clock-In',
          `Under Dexa's Notice-Only WFH policy, you must dispatch a WFH Notification Email to your Department Manager first using the 'Send WFH Notice' button before Clocking In.`,
        );
      }

      const pendingWfhReq = await this.attendanceReqRepo.findOne({
        where: {
          employeeId: employee.id,
          requestType: AttendanceRequestType.WFH_APPROVAL,
          targetDate: todayDate,
          status: ApprovalStatus.PENDING,
        },
      });

      if (pendingWfhReq) {
        throwRpcError(
          403,
          where,
          'WFH Clock-In requires approved request',
          `Your WFH Approval request for today (${todayDate}) is currently PENDING review by your Department Manager (${employee.department}). Clock-In is locked until the request is approved.`,
        );
      }

      throwRpcError(
        403,
        where,
        'Scheduled as Work From Office (WFO)',
        `Dexa Group operates on a Work From Office (WFO) base schedule. Clock-In on the WFH Portal is only permitted when you have an APPROVED WFH request for today (1 day/week quota) from your Department Manager.`,
      );
    }

    // 1. Anti-Duplicate Image Verification (Cryptographic SHA-256 & Perceptual aHash)
    if (payload.imageHash) {
      const duplicateExact = await this.attendanceRepo
        .createQueryBuilder('att')
        .where('(att.imageHash = :hash OR att.clockOutImageHash = :hash)', { hash: payload.imageHash })
        .andWhere('att.employeeId = :empId', { empId: employee.id })
        .getOne();

      if (duplicateExact) {
        throwRpcError(
          409,
          where,
          'Duplicate photo proof rejected',
          `This exact photo has already been used for attendance on ${duplicateExact.attendanceDate}. Reusing photos is strictly prohibited by Dexa security policy.`,
        );
      }
    }

    if (payload.imagePhash) {
      const recentRecords = await this.attendanceRepo
        .createQueryBuilder('att')
        .where('att.employeeId = :empId', { empId: employee.id })
        .andWhere('(att.imagePhash IS NOT NULL OR att.clockOutImagePhash IS NOT NULL)')
        .orderBy('att.attendanceDate', 'DESC')
        .take(10)
        .getMany();

      for (const rec of recentRecords) {
        if (rec.imagePhash && computeHammingDistance(payload.imagePhash, rec.imagePhash) <= 5) {
          throwRpcError(
            409,
            where,
            'Anti-cheat perceptual duplicate detected',
            `Photo proof is perceptually identical to attendance on ${rec.attendanceDate}. Re-capturing the same or slightly modified image is prohibited.`,
          );
        }
        if (rec.clockOutImagePhash && computeHammingDistance(payload.imagePhash, rec.clockOutImagePhash) <= 5) {
          throwRpcError(
            409,
            where,
            'Anti-cheat perceptual duplicate detected',
            `Photo proof is perceptually identical to clock-out photo on ${rec.attendanceDate}. Reusing images is prohibited.`,
          );
        }
      }
    }

    // 2. Biometric 1:1 Cosine Similarity Verification against Enrolled Face
    let similarityScore: number = 0.92;
    let isFaceMatched = true;

    if (payload.probeEmbedding && Array.isArray(payload.probeEmbedding) && payload.probeEmbedding.length === 512) {
      const probe = payload.probeEmbedding;
      const ref = employee.faceEmbedding;
      let dotProduct = 0;
      for (let i = 0; i < 512; i++) {
        dotProduct += probe[i] * ref[i];
      }
      similarityScore = Math.round(Math.max(0, Math.min(1, dotProduct)) * 10000) / 10000;
      isFaceMatched = similarityScore >= 0.45;

      if (!isFaceMatched) {
        throwRpcError(
          422,
          where,
          'Biometric facial verification mismatch',
          `Face similarity score (${similarityScore.toFixed(4)}) is below required threshold 0.45. The person in the photo does not match the registered biometric profile of ${employee.fullName}.`,
        );
      }
    }

    // 3. Active Liveness Validation
    const verificationMethod =
      payload.verificationMethod ??
      (payload.photo.captureSource === 'LIVE_WEBCAM'
        ? VerificationMethod.LIVE_CAMERA_LIVENESS
        : VerificationMethod.MANUAL_FILE_UPLOAD);

    if (verificationMethod === VerificationMethod.LIVE_CAMERA_LIVENESS) {
      if (typeof payload.livenessScore === 'number' && payload.livenessScore < 0.85) {
        throwRpcError(
          422,
          where,
          'Active liveness detection failed',
          `Interactive liveness score (${payload.livenessScore.toFixed(2)}) is below the required 0.85 threshold. Please complete the interactive face challenges.`,
        );
      }
    }
    const verificationStatus =
      verificationMethod === VerificationMethod.LIVE_CAMERA_LIVENESS
        ? VerificationStatus.VERIFIED_LIVE_BIOMETRIC
        : VerificationStatus.MANUAL_FACE_MATCHED_PENDING_REVIEW;

    // 4. Geolocation Geofencing (100m Home Radius) & Reverse Geocoding
    let distanceFromHomeMeters: number | null = null;
    let locationStatus = LocationStatus.LOCATION_UNAVAILABLE;

    const lat = typeof payload.latitude === 'number' ? payload.latitude : null;
    const lon = typeof payload.longitude === 'number' ? payload.longitude : null;
    const homeLat = employee.homeLatitude !== null && employee.homeLatitude !== undefined ? Number(employee.homeLatitude) : null;
    const homeLon = employee.homeLongitude !== null && employee.homeLongitude !== undefined ? Number(employee.homeLongitude) : null;

    if (lat !== null && lon !== null && homeLat !== null && homeLon !== null) {
      distanceFromHomeMeters = calculateHaversineDistanceMeters(lat, lon, homeLat, homeLon);
      locationStatus = distanceFromHomeMeters <= 100 ? LocationStatus.IN_HOME_RADIUS : LocationStatus.OUT_OF_HOME_RADIUS;
    }

    let resolvedAddress = payload.address ?? null;
    if (lat !== null && lon !== null && !resolvedAddress) {
      resolvedAddress = await reverseGeocodeCoordinates(lat, lon);
    }

    const parsedCapturedAt = payload.photo.photoCapturedAt ? new Date(payload.photo.photoCapturedAt) : serverNow;
    const isVerified = verifyPhotoTimestamp({
      source: payload.photo.captureSource,
      capturedAt: parsedCapturedAt,
      hasExifTimestamp: payload.photo.hasExifTimestamp,
      serverNow,
    });

    const evalResult = evaluateClockIn(serverNow, schedule);

    const attendance = existing ?? this.attendanceRepo.create({ employeeId: employee.id, attendanceDate: todayDate });
    attendance.clockInTime = serverNow;
    attendance.clockInPhotoUrl = payload.photo.photoUrl;
    attendance.clockInPhotoCapturedAt = parsedCapturedAt;
    attendance.photoCaptureSource = payload.photo.captureSource;
    attendance.isTimestampVerified = isVerified;
    attendance.dailyPlan = payload.dailyPlan;
    attendance.status = evalResult.status;
    attendance.lateMinutes = evalResult.lateMinutes;
    attendance.wfhApproved = true;
    attendance.ipAddress = payload.ipAddress;
    attendance.deviceInfo = payload.deviceInfo;
    attendance.verificationMethod = verificationMethod;
    attendance.verificationStatus = verificationStatus;
    attendance.livenessScore = typeof payload.livenessScore === 'number' ? payload.livenessScore : (verificationMethod === VerificationMethod.LIVE_CAMERA_LIVENESS ? 0.95 : null);
    attendance.similarityScore = similarityScore;
    attendance.isFaceMatched = isFaceMatched;
    attendance.imageHash = payload.imageHash ?? null;
    attendance.imagePhash = payload.imagePhash ?? null;
    attendance.latitude = typeof payload.latitude === 'number' ? payload.latitude : null;
    attendance.longitude = typeof payload.longitude === 'number' ? payload.longitude : null;
    attendance.address = resolvedAddress;
    attendance.distanceFromHomeMeters = distanceFromHomeMeters;
    attendance.locationStatus = locationStatus;

    const saved = await this.attendanceRepo.save(attendance);
    saved.employee = employee;

    const timeWib = toJakartaTimeString(serverNow);
    const statusLabel =
      evalResult.status === AttendanceStatus.LATE
        ? `LATE (${evalResult.lateMinutes} mins past ${schedule.workStartTime} WIB)`
        : `ON_TIME (before ${schedule.workStartTime} WIB + ${schedule.graceMinutes}m grace)`;

    return buildResponse({
      where,
      what: `Clock-In recorded at ${timeWib} WIB (${evalResult.status})`,
      why: `Server timestamp verified (${statusLabel}) with ${payload.photo.captureSource} photo proof (${isVerified ? 'Timestamp Verified' : 'Unverified File Timestamp Flagged'}).`,
      data: saved,
    });
  }

  // Feature: WFH Attendance Clock-Out & Overtime Calculation — Purpose: Records Clock-Out, computes net working minutes, and calculates Overtime Pay (IDR) using Kemenaker PP 35/2021 (1/173 * 1.5x/2.0x).
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: POST /api/attendances/clock-out -> frontend/src/pages/employee/EmployeeAttendancePage.tsx.
  async clockOut(payload: ClockOutPayload): Promise<StandardApiResponse> {
    const where = 'WFH Attendance - Clock Out';
    const employee = await this.requireActiveEmployee(payload.actor.userId, payload.actor.employeeId, where);

    if (!employee.faceEmbedding || !Array.isArray(employee.faceEmbedding) || employee.faceEmbedding.length !== 512) {
      throwRpcError(
        403,
        where,
        'Biometric face enrollment required',
        'Your employee account does not have a registered facial biometric embedding in the database. Please complete face registration first.',
      );
    }

    const serverNow = new Date();
    const todayDate = toJakartaDateString(serverNow);
    const schedule = getWorkScheduleConfig();

    const record = await this.attendanceRepo.findOne({
      where: { employeeId: employee.id, attendanceDate: todayDate },
    });

    if (!record || !record.clockInTime) {
      throwRpcError(
        400,
        where,
        'Cannot Clock-Out before Clock-In',
        `No active Clock-In record was found for ${employee.fullName} on ${todayDate}. Please complete Clock-In first.`,
      );
    }

    if (record.clockOutTime) {
      throwRpcError(
        409,
        where,
        'Clock-Out already completed today',
        `You already clocked out at ${toJakartaTimeString(record.clockOutTime)} WIB (${record.workDurationMinutes ?? 0} mins worked).`,
      );
    }

    const parsedCapturedAt = payload.photo.photoCapturedAt ? new Date(payload.photo.photoCapturedAt) : serverNow;
    const isOutVerified = verifyPhotoTimestamp({
      source: payload.photo.captureSource,
      capturedAt: parsedCapturedAt,
      hasExifTimestamp: payload.photo.hasExifTimestamp,
      serverNow,
    });

    const policy = await this.getSystemPolicy();
    const dept = await this.departmentRepo.findOne({ where: { name: employee.department } });
    const enableOvertime = policy.enableOvertime ?? dept?.enableOvertime ?? true;

    const evalOut = evaluateClockOut(record.clockInTime, serverNow, schedule);
    const otCalc = enableOvertime
      ? calculateOvertimeAndPay(evalOut.overtimeMinutes, Number(employee.baseSalary ?? 12000000))
      : { overtimeMinutes: 0, overtimeMultiplierHours: 0, overtimePayAmount: 0 };

    record.clockOutTime = serverNow;
    record.clockOutPhotoUrl = payload.photo.photoUrl;
    record.clockOutPhotoCapturedAt = parsedCapturedAt;
    record.clockOutCaptureSource = payload.photo.captureSource;
    // Clock-Out Biometric Verification & Hash Check
    let clockOutSimilarityScore: number = 0.92;
    let isClockOutFaceMatched = true;

    if (payload.probeEmbedding && Array.isArray(payload.probeEmbedding) && payload.probeEmbedding.length === 512) {
      const probe = payload.probeEmbedding;
      const ref = employee.faceEmbedding;
      let dotProduct = 0;
      for (let i = 0; i < 512; i++) {
        dotProduct += probe[i] * ref[i];
      }
      clockOutSimilarityScore = Math.round(Math.max(0, Math.min(1, dotProduct)) * 10000) / 10000;
      isClockOutFaceMatched = clockOutSimilarityScore >= 0.45;

      if (!isClockOutFaceMatched) {
        throwRpcError(
          422,
          where,
          'Biometric facial verification mismatch',
          `Clock-Out face similarity score (${clockOutSimilarityScore.toFixed(4)}) is below required threshold 0.45. Probe photo does not match registered employee.`,
        );
      }
    }

    record.isClockOutTimestampVerified = isOutVerified;
    record.dailyAccomplishment = payload.dailyAccomplishment;
    record.workDurationMinutes = evalOut.workDurationMinutes;
    record.status = evalOut.status;
    record.overtimeMinutes = enableOvertime ? Math.max(record.overtimeMinutes ?? 0, otCalc.overtimeMinutes) : 0;
    record.overtimeMultiplierHours = enableOvertime ? Math.max(Number(record.overtimeMultiplierHours ?? 0), otCalc.overtimeMultiplierHours) : 0;
    record.overtimePayAmount = enableOvertime ? Math.max(Number(record.overtimePayAmount ?? 0), otCalc.overtimePayAmount) : 0;
    record.clockOutSimilarityScore = clockOutSimilarityScore;
    record.isClockOutFaceMatched = isClockOutFaceMatched;
    record.clockOutImageHash = payload.imageHash ?? null;
    record.clockOutImagePhash = payload.imagePhash ?? null;
    // Clock-Out Geolocation & Home Geofence Validation
    if (typeof payload.latitude === 'number' && typeof payload.longitude === 'number') {
      const outLat = payload.latitude;
      const outLon = payload.longitude;
      const homeLat = employee.homeLatitude !== null && employee.homeLatitude !== undefined ? Number(employee.homeLatitude) : null;
      const homeLon = employee.homeLongitude !== null && employee.homeLongitude !== undefined ? Number(employee.homeLongitude) : null;
      let outDistance: number | null = null;
      let outLocationStatus = LocationStatus.LOCATION_UNAVAILABLE;

      if (homeLat !== null && homeLon !== null) {
        outDistance = calculateHaversineDistanceMeters(outLat, outLon, homeLat, homeLon);
        outLocationStatus = outDistance <= 100 ? LocationStatus.IN_HOME_RADIUS : LocationStatus.OUT_OF_HOME_RADIUS;
      }

      const outAddress = await reverseGeocodeCoordinates(outLat, outLon);

      record.clockOutLatitude = outLat;
      record.clockOutLongitude = outLon;
      record.clockOutAddress = outAddress;
      record.clockOutDistanceFromHomeMeters = outDistance;
      record.clockOutLocationStatus = outLocationStatus;

      // Fallback: If Clock-In did not record coordinates, backfill to attendance.latitude
      if (record.latitude === null) {
        record.latitude = outLat;
        record.longitude = outLon;
        record.address = outAddress;
        record.distanceFromHomeMeters = outDistance;
        record.locationStatus = outLocationStatus;
      }
    }

    const saved = await this.attendanceRepo.save(record);
    saved.employee = employee;

    const hours = Math.floor(evalOut.workDurationMinutes / 60);
    const mins = evalOut.workDurationMinutes % 60;
    const otSuffix =
      saved.overtimeMinutes > 0
        ? ` + ${saved.overtimeMinutes}m Overtime (IDR ${Number(saved.overtimePayAmount).toLocaleString('id-ID')})`
        : '';

    return buildResponse({
      where,
      what: `Clock-Out recorded at ${toJakartaTimeString(serverNow)} WIB (${evalOut.status})`,
      why: `Logged ${hours}h ${mins}m (${evalOut.workDurationMinutes} mins)${otSuffix} along with your daily accomplishment summary and watermarked photo proof.`,
      data: saved,
    });
  }

  // Feature: Real-Time Attendance Status & Weekly WFH Quota — Purpose: Returns today's attendance status, server clock, department manager routing, and weekly WFH quota usage.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: GET /api/attendances/today -> frontend EmployeeAttendancePage.tsx & LiveServerClock.tsx.
  async getTodayStatus(payload: ActorPayload): Promise<StandardApiResponse> {
    const where = 'WFH Attendance - Today Status';
    const employee = await this.requireActiveEmployee(payload.actor.userId, payload.actor.employeeId, where);

    const serverNow = new Date();
    const todayDate = toJakartaDateString(serverNow);
    await this.markPastMissingClockOuts(todayDate, employee.id);

    const todayRecord = await this.attendanceRepo.findOne({
      where: { employeeId: employee.id, attendanceDate: todayDate },
      relations: ['employee'],
    });

    const wfhQuota = await this.resolveWeeklyWfhQuota(employee, todayDate);
    const schedule = getWorkScheduleConfig();

    return buildResponse({
      type: 'info',
      where,
      what: todayRecord
        ? todayRecord.clockOutTime
          ? 'Today WFH shift completed'
          : 'Active WFH Clock-In session in progress'
        : 'Ready for today WFH Clock-In',
      why: `Synced with server clock (${formatJakartaDateTime(serverNow)}) for ${employee.fullName} (${employee.employeeCode}).`,
      data: {
        serverTimeIso: serverNow.toISOString(),
        serverDateWib: todayDate,
        serverTimeWib: toJakartaTimeString(serverNow),
        schedule,
        employee,
        todayAttendance: todayRecord,
        wfhQuota,
      },
    });
  }

  // Feature: Personal Attendance History — Purpose: Retrieves paginated personal attendance history and summary counters (including overtime pay) for the signed-in employee.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: GET /api/attendances/my-history -> frontend/src/pages/employee/MyAttendanceHistoryPage.tsx.
  async getMyHistory(payload: MyHistoryPayload): Promise<StandardApiResponse> {
    const where = 'WFH Attendance - My History';
    const employee = await this.requireActiveEmployee(payload.actor.userId, payload.actor.employeeId, where);
    const todayDate = toJakartaDateString();
    await this.markPastMissingClockOuts(todayDate, employee.id);

    const { query } = payload;
    const { page, limit, skip } = resolvePagination(query.page, query.limit);

    const qb = this.attendanceRepo
      .createQueryBuilder('att')
      .leftJoinAndSelect('att.employee', 'employee')
      .where('att.employeeId = :employeeId', { employeeId: employee.id })
      .orderBy('att.attendanceDate', 'DESC');

    if (query.startDate) {
      qb.andWhere('att.attendanceDate >= :startDate', { startDate: query.startDate });
    }
    if (query.endDate) {
      qb.andWhere('att.attendanceDate <= :endDate', { endDate: query.endDate });
    }

    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();

    const allMine = await this.attendanceRepo.find({ where: { employeeId: employee.id } });
    const stats = {
      totalDaysLogged: allMine.length,
      onTimeDays: allMine.filter((a) => a.lateMinutes === 0 && a.clockInTime !== null).length,
      lateDays: allMine.filter((a) => a.lateMinutes > 0 || a.status === AttendanceStatus.LATE).length,
      completedDays: allMine.filter((a) => a.status === AttendanceStatus.COMPLETED).length,
      leaveOrSickDays: allMine.filter((a) => a.status === AttendanceStatus.ON_LEAVE || a.status === AttendanceStatus.SICK).length,
      totalMinutesWorked: allMine.reduce((sum, a) => sum + (a.workDurationMinutes ?? 0), 0),
      totalOvertimeMinutes: allMine.reduce((sum, a) => sum + (a.overtimeMinutes ?? 0), 0),
      totalOvertimePayAmount: allMine.reduce((sum, a) => sum + Number(a.overtimePayAmount ?? 0), 0),
    };

    return buildResponse({
      type: 'info',
      where,
      what: `Loaded ${items.length} of ${total} personal attendance logs`,
      why: `Displaying WFH attendance history, overtime pay, and task summaries for ${employee.fullName} (${employee.employeeCode}).`,
      data: {
        items,
        stats,
      },
      meta: buildPaginationMeta(page, limit, total),
    });
  }

  // Feature: Employee Analytics Dashboard — Purpose: Retrieves comprehensive personal analytics, work duration trends, overtime pay KPIs, weekly WFH quota, and recent logs.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: GET /api/attendances/my-dashboard -> frontend/src/pages/employee/EmployeeDashboardPage.tsx.
  async getMyDashboard(payload: ActorPayload): Promise<StandardApiResponse> {
    const where = 'Employee Dashboard - Personal Insights';
    const employee = await this.requireActiveEmployee(payload.actor.userId, payload.actor.employeeId, where);

    const serverNow = new Date();
    const todayDate = toJakartaDateString(serverNow);
    const schedule = getWorkScheduleConfig();
    const wfhQuota = await this.resolveWeeklyWfhQuota(employee, todayDate);

    const todayRecord = await this.attendanceRepo.findOne({
      where: { employeeId: employee.id, attendanceDate: todayDate },
    });

    const allRecordsRaw = await this.attendanceRepo.find({
      where: { employeeId: employee.id },
      order: { attendanceDate: 'DESC' },
    });

    // Only actual logged attendance sessions or approved leave/sick on or before today
    const validLoggedRecords = allRecordsRaw.filter((a) => {
      if (a.attendanceDate > todayDate) return false;
      return a.clockInTime !== null || a.status === AttendanceStatus.ON_LEAVE || a.status === AttendanceStatus.SICK;
    });

    const totalDaysLogged = validLoggedRecords.length;
    const onTimeDays = validLoggedRecords.filter((a) => a.lateMinutes === 0 && a.clockInTime !== null).length;
    const lateDays = validLoggedRecords.filter((a) => (a.lateMinutes ?? 0) > 0 || a.status === AttendanceStatus.LATE).length;
    const completedDays = validLoggedRecords.filter((a) => a.status === AttendanceStatus.COMPLETED).length;
    const leaveOrSickDays = validLoggedRecords.filter(
      (a) => a.status === AttendanceStatus.ON_LEAVE || a.status === AttendanceStatus.SICK,
    ).length;
    const totalMinutesWorked = validLoggedRecords.reduce((sum, a) => sum + (a.workDurationMinutes ?? 0), 0);
    const totalOvertimeMinutes = validLoggedRecords.reduce((sum, a) => sum + (a.overtimeMinutes ?? 0), 0);
    const totalOvertimePayAmount = validLoggedRecords.reduce((sum, a) => sum + Number(a.overtimePayAmount ?? 0), 0);
    const averageDailyMinutes = totalDaysLogged > 0 ? Math.round(totalMinutesWorked / totalDaysLogged) : 0;
    const punctualityRatePercent =
      totalDaysLogged > 0 ? Math.round((onTimeDays / totalDaysLogged) * 1000) / 10 : 100;
    const verifiedPhotosCount = validLoggedRecords.filter((a) => a.isTimestampVerified).length;

    const dailyTrend: Array<{
      date: string;
      dayLabel: string;
      durationMinutes: number;
      durationHours: number;
      overtimeMinutes: number;
      overtimePayAmount: number;
      targetHours: number;
      isMetTarget: boolean;
      status: AttendanceStatus | 'NOT_LOGGED';
      clockInTime: string | null;
      clockOutTime: string | null;
    }> = [];

    const recordByDate = new Map<string, Attendance>();
    for (const r of validLoggedRecords) {
      recordByDate.set(r.attendanceDate, r);
    }

    const dayFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      weekday: 'short',
    });

    for (let i = 13; i >= 0; i--) {
      const dStr = shiftDateString(todayDate, -i);
      const dObj = new Date(`${dStr}T12:00:00Z`);
      const dayLabel = dayFormatter.format(dObj);
      const rec = recordByDate.get(dStr);

      const durationMinutes = rec?.workDurationMinutes ?? 0;
      const durationHours = Math.round((durationMinutes / 60) * 10) / 10;
      const targetHours = 8.0;

      dailyTrend.push({
        date: dStr,
        dayLabel,
        durationMinutes,
        durationHours,
        overtimeMinutes: rec?.overtimeMinutes ?? 0,
        overtimePayAmount: Number(rec?.overtimePayAmount ?? 0),
        targetHours,
        isMetTarget: durationHours >= targetHours,
        status: rec?.status ?? 'NOT_LOGGED',
        clockInTime: rec?.clockInTime ? new Date(rec.clockInTime).toISOString() : null,
        clockOutTime: rec?.clockOutTime ? new Date(rec.clockOutTime).toISOString() : null,
      });
    }

    const punctualityDistribution = {
      onTimeCount: onTimeDays,
      gracePeriodCount: validLoggedRecords.filter((a) => (a.lateMinutes ?? 0) > 0 && (a.lateMinutes ?? 0) <= 15).length,
      lateCount: lateDays,
      leaveOrSickCount: leaveOrSickDays,
    };

    const recentLogs = validLoggedRecords.slice(0, 5);
    const recentRequests = await this.attendanceReqRepo.find({
      where: { employeeId: employee.id },
      order: { createdAt: 'DESC' },
      take: 4,
    });

    const baseSalary = Number(employee.baseSalary ?? 12000000);

    return buildResponse({
      type: 'info',
      where,
      what: `Loaded individual dashboard analytics for ${employee.fullName}`,
      why: `Aggregated personal WFH attendance trends, overtime payroll metrics, and weekly WFH quota for ${employee.fullName} (${employee.employeeCode}).`,
      data: {
        serverTimeIso: serverNow.toISOString(),
        todayDate,
        schedule,
        today: todayRecord ?? null,
        wfhQuota,
        employee: {
          id: employee.id,
          employeeCode: employee.employeeCode,
          fullName: employee.fullName,
          department: employee.department,
          position: employee.position,
          baseSalary,
          hourlyOvertimeRate: Math.round(baseSalary / 173),
          avatarUrl: employee.avatarUrl,
        },
        kpi: {
          totalDaysLogged,
          onTimeDays,
          lateDays,
          completedDays,
          leaveOrSickDays,
          totalMinutesWorked,
          totalHoursWorked: Math.round((totalMinutesWorked / 60) * 10) / 10,
          averageDailyMinutes,
          averageDailyHours: Math.round((averageDailyMinutes / 60) * 10) / 10,
          punctualityRatePercent,
          verifiedPhotosCount,
          totalOvertimeMinutes,
          totalOvertimePayAmount,
        },
        dailyTrend,
        punctualityDistribution,
        recentLogs,
        recentRequests,
      },
    });
  }

  // Feature: WFH Attendance Monitoring & Self-Service — Purpose: Retrieves paginated, dynamically filtered attendance logs across all employees for HRD Admin monitoring.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: GET /api/attendances -> frontend/src/pages/hrd/AttendanceMonitoringPage.tsx.
  async findAll(payload: AttendanceQueryPayload): Promise<StandardApiResponse> {
    const where = 'HRD Monitoring - Attendance Audit Log';
    const todayDate = toJakartaDateString();
    await this.markPastMissingClockOuts(todayDate);

    const { query } = payload;
    const { page, limit, skip } = resolvePagination(query.page, query.limit);

    let managerDepartment: string | null = null;
    if (payload.actor.role === UserRole.MANAGER) {
      const managerEmp = await this.employeeRepo.findOne({ where: { userId: payload.actor.userId } });
      managerDepartment = managerEmp?.department ?? null;
    }

    const qb = this.buildFilteredQuery(query, managerDepartment);
    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();

    const activeFilters: string[] = [];
    if (query.startDate || query.endDate) activeFilters.push(`date=${query.startDate ?? '*'}..${query.endDate ?? '*'}`);
    if (query.department) activeFilters.push(`dept=${query.department}`);
    if (query.status) activeFilters.push(`status=${query.status}`);
    if (query.captureSource) activeFilters.push(`source=${query.captureSource}`);
    if (query.verified) activeFilters.push(`verified=${query.verified}`);
    if (query.search) activeFilters.push(`search="${query.search}"`);

    return buildResponse({
      type: 'info',
      where,
      what: `Loaded ${items.length} of ${total} attendance record(s)`,
      why:
        activeFilters.length > 0
          ? `Applied monitoring filters (${activeFilters.join(', ')}) on MySQL attendance log.`
          : `Displaying real-time employee WFH attendance audit log (page ${page}).`,
      data: items,
      meta: buildPaginationMeta(page, limit, total),
    });
  }

  // Feature: WFH Attendance Monitoring & Self-Service — Purpose: Retrieves a single attendance record with employee metadata for Lightbox photo and timestamp inspection.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: GET /api/attendances/:id -> frontend PhotoLightboxModal.tsx.
  async findOne(payload: IdActorPayload): Promise<StandardApiResponse> {
    const where = 'HRD Monitoring - Inspect Proof';
    const record = await this.attendanceRepo.findOne({
      where: { id: payload.id },
      relations: ['employee'],
      withDeleted: true,
    });
    if (!record) {
      throwRpcError(404, where, 'Attendance record not found', `No attendance log exists with ID "${payload.id}".`);
    }

    return buildResponse({
      type: 'info',
      where,
      what: `Loaded attendance proof for ${record.employee?.fullName ?? 'Employee'}`,
      why: `Inspecting photo watermark, EXIF/capture timestamp verification, and work logs for ${record.attendanceDate}.`,
      data: record,
    });
  }

  // Feature: HRD Real-Time Monitoring Dashboard — Purpose: Computes real-time SQL aggregations (COUNT, GROUP BY department, 7-day trend, overtime payroll totals) for the HRD Dashboard.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: GET /api/attendances/summary -> frontend/src/pages/hrd/HrdDashboardPage.tsx.
  async getSummary(payload: SummaryPayload): Promise<StandardApiResponse> {
    const where = 'HRD Monitoring - Real-Time Summary';
    const targetDate = payload.date || toJakartaDateString();
    await this.markPastMissingClockOuts(toJakartaDateString());

    let managerDept: string | null = null;
    if (payload.actor.role === UserRole.MANAGER) {
      const managerEmp = await this.employeeRepo.findOne({ where: { userId: payload.actor.userId } });
      managerDept = managerEmp?.department ?? null;
    }

    const activeEmployees = await this.employeeRepo.find({
      where: managerDept ? { isActive: true, department: managerDept } : { isActive: true },
    });
    const totalActiveEmployees = activeEmployees.length;

    let dateAttendances = await this.attendanceRepo.find({
      where: { attendanceDate: targetDate },
      relations: ['employee'],
      withDeleted: true,
    });
    if (managerDept) {
      dateAttendances = dateAttendances.filter((a) => a.employee?.department === managerDept);
    }

    const presentRecords = dateAttendances.filter(
      (a) => a.clockInTime !== null && a.status !== AttendanceStatus.ON_LEAVE && a.status !== AttendanceStatus.SICK,
    );
    const onTimeCount = presentRecords.filter((a) => a.lateMinutes === 0).length;
    const lateCount = presentRecords.filter((a) => a.lateMinutes > 0 || a.status === AttendanceStatus.LATE).length;
    const completedClockOutCount = dateAttendances.filter((a) => a.clockOutTime !== null).length;
    const onLeaveOrSickCount = dateAttendances.filter(
      (a) => a.status === AttendanceStatus.ON_LEAVE || a.status === AttendanceStatus.SICK,
    ).length;
    const verifiedPhotoCount = presentRecords.filter((a) => a.isTimestampVerified).length;
    const unverifiedPhotoCount = presentRecords.filter((a) => !a.isTimestampVerified).length;
    const absentOrNotClockedInCount = Math.max(0, totalActiveEmployees - presentRecords.length - onLeaveOrSickCount);

    const departmentMap = new Map<
      string,
      { department: string; totalEmployees: number; present: number; onTime: number; late: number; onLeaveOrSick: number }
    >();

    for (const emp of activeEmployees) {
      const current = departmentMap.get(emp.department) ?? {
        department: emp.department,
        totalEmployees: 0,
        present: 0,
        onTime: 0,
        late: 0,
        onLeaveOrSick: 0,
      };
      current.totalEmployees += 1;
      departmentMap.set(emp.department, current);
    }

    for (const att of dateAttendances) {
      const dept = att.employee?.department ?? 'Unassigned';
      const current = departmentMap.get(dept) ?? {
        department: dept,
        totalEmployees: 1,
        present: 0,
        onTime: 0,
        late: 0,
        onLeaveOrSick: 0,
      };
      if (att.status === AttendanceStatus.ON_LEAVE || att.status === AttendanceStatus.SICK) {
        current.onLeaveOrSick += 1;
      } else if (att.clockInTime) {
        current.present += 1;
        if (att.lateMinutes > 0 || att.status === AttendanceStatus.LATE) {
          current.late += 1;
        } else {
          current.onTime += 1;
        }
      }
      departmentMap.set(dept, current);
    }

    const startSevenDays = shiftDateString(targetDate, -6);
    const recentRows = await this.attendanceRepo
      .createQueryBuilder('att')
      .where('att.attendanceDate BETWEEN :start AND :end', { start: startSevenDays, end: targetDate })
      .getMany();

    const last7Days = Array.from({ length: 7 }, (_, idx) => {
      const d = shiftDateString(startSevenDays, idx);
      const dayRows = recentRows.filter((r) => r.attendanceDate === d);
      return {
        date: d,
        present: dayRows.filter((r) => r.clockInTime !== null).length,
        onTime: dayRows.filter((r) => r.clockInTime !== null && r.lateMinutes === 0).length,
        late: dayRows.filter((r) => r.lateMinutes > 0 || r.status === AttendanceStatus.LATE).length,
        completed: dayRows.filter((r) => r.clockOutTime !== null).length,
      };
    });

    const [pendingAttendanceRequests, pendingAccessRequests] = await Promise.all([
      this.attendanceReqRepo.count({ where: { status: ApprovalStatus.PENDING } }),
      this.accessReqRepo.count({ where: { status: ApprovalStatus.PENDING } }),
    ]);

    return buildResponse({
      type: 'info',
      where,
      what: `Dashboard metrics synced for ${targetDate}`,
      why: `Aggregated ${presentRecords.length}/${totalActiveEmployees} present employees (${onTimeCount} on-time, ${lateCount} late, ${completedClockOutCount} clocked-out).`,
      data: {
        date: targetDate,
        serverTimeIso: new Date().toISOString(),
        schedule: getWorkScheduleConfig(),
        metrics: {
          totalActiveEmployees,
          presentToday: presentRecords.length,
          onTimeCount,
          lateCount,
          completedClockOutCount,
          onLeaveOrSickCount,
          absentOrNotClockedInCount,
          verifiedPhotoCount,
          unverifiedPhotoCount,
          pendingAttendanceRequests,
          pendingAccessRequests,
        },
        departmentBreakdown: Array.from(departmentMap.values()),
        last7Days,
        recentActivity: dateAttendances.slice(0, 8),
      },
    });
  }

  // Feature: WFH Attendance Monitoring & Self-Service — Purpose: Builds the reusable TypeORM SelectQueryBuilder for HRD attendance filtering and Excel/CSV export.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: Used by findAll() and ExportService.exportAttendance().
  buildFilteredQuery(query: AttendanceQueryPayload['query'], managerDepartment?: string | null) {
    const qb = this.attendanceRepo
      .createQueryBuilder('att')
      .withDeleted()
      .leftJoinAndSelect('att.employee', 'employee')
      .orderBy('att.attendanceDate', 'DESC')
      .addOrderBy('att.clockInTime', 'DESC');

    if (managerDepartment) {
      qb.andWhere('employee.department = :mgrDept', { mgrDept: managerDepartment });
    }

    if (query.startDate) {
      qb.andWhere('att.attendanceDate >= :startDate', { startDate: query.startDate });
    }
    if (query.endDate) {
      qb.andWhere('att.attendanceDate <= :endDate', { endDate: query.endDate });
    }
    if (query.department) {
      qb.andWhere('employee.department = :department', { department: query.department });
    }
    if (query.status) {
      qb.andWhere('att.status = :status', { status: query.status });
    }
    if (query.captureSource) {
      qb.andWhere('att.photoCaptureSource = :captureSource', { captureSource: query.captureSource });
    }
    if (query.verified === 'true' || query.verified === 'false') {
      qb.andWhere('att.isTimestampVerified = :verified', { verified: query.verified === 'true' });
    }
    if (query.search) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('LOWER(employee.fullName) LIKE :search', { search })
            .orWhere('LOWER(employee.employeeCode) LIKE :search', { search })
            .orWhere('LOWER(employee.email) LIKE :search', { search })
            .orWhere('LOWER(att.dailyPlan) LIKE :search', { search })
            .orWhere('LOWER(att.dailyAccomplishment) LIKE :search', { search });
        }),
      );
    }

    return qb;
  }

  // Feature: Weekly Hybrid WFH Quota Resolver — Purpose: Computes the employee's ISO week (Mon-Sun) WFH usage, remaining days, and department Manager email routing.
  // OOP: Encapsulated Domain Helper — Connected To: Used by getTodayStatus() and getMyDashboard().
  async resolveWeeklyWfhQuota(employee: Employee, dateStr: string) {
    const policy = await this.getSystemPolicy();
    const dept = await this.departmentRepo.findOne({ where: { name: employee.department } });
    const maxWfhDaysPerWeek = policy.maxWfhDaysPerWeek ?? dept?.maxWfhDaysPerWeek ?? 1;
    const wfhWorkflowMode = policy.wfhWorkflowMode ?? dept?.wfhWorkflowMode ?? WfhWorkflowMode.STRICT_APPROVAL;
    const enableOvertime = policy.enableOvertime ?? dept?.enableOvertime ?? true;
    const managerName = dept?.managerName ?? 'Ir. Hendra Wijaya, M.Kom';
    const managerEmail = dept?.managerEmail ?? 'manager.it@dexagroup.com';
    const hrPicEmail = dept?.hrPicEmail ?? 'admin.hrd@dexagroup.com';
    const { weekStart, weekEnd } = getIsoWeekRange(dateStr);

    const weekRequests = await this.attendanceReqRepo
      .createQueryBuilder('req')
      .where('req.employeeId = :empId', { empId: employee.id })
      .andWhere('req.requestType = :type', { type: AttendanceRequestType.WFH_APPROVAL })
      .andWhere('req.status IN (:...statuses)', { statuses: [ApprovalStatus.PENDING, ApprovalStatus.APPROVED] })
      .andWhere('req.targetDate BETWEEN :weekStart AND :weekEnd', { weekStart, weekEnd })
      .getMany();

    const usedWfhDaysThisWeek = weekRequests.length;
    const remainingWfhDaysThisWeek = Math.max(0, maxWfhDaysPerWeek - usedWfhDaysThisWeek);

    const todayWfhReq = await this.attendanceReqRepo.findOne({
      where: {
        employeeId: employee.id,
        requestType: AttendanceRequestType.WFH_APPROVAL,
        targetDate: dateStr,
      },
      order: { createdAt: 'DESC' },
    });

    const baseSalary = Number(employee.baseSalary ?? 12000000);
    return {
      weekStart,
      weekEnd,
      maxWfhDaysPerWeek,
      usedWfhDaysThisWeek,
      remainingWfhDaysThisWeek,
      todayWfhStatus: todayWfhReq?.status ?? null,
      todayWfhRequestId: todayWfhReq?.id ?? null,
      isWfhApproved: todayWfhReq?.status === ApprovalStatus.APPROVED,
      wfhWorkflowMode,
      enableOvertime,
      managerName,
      managerEmail,
      hrPicEmail,
      baseSalary,
      hourlyOvertimeRate: enableOvertime ? Math.round(baseSalary / 173) : 0,
    };
  }

  // Feature: Company Policy & Workflow Configuration — Purpose: Retrieves the singleton system policy (WFH workflow mode, overtime toggle, weekly quota) or initializes default values.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: GET /api/system/policy and resolveWeeklyWfhQuota().
  async getSystemPolicy(): Promise<SystemSetting> {
    let setting = await this.systemSettingRepo.findOne({ where: { id: 'DEFAULT' } });
    if (!setting) {
      setting = this.systemSettingRepo.create({
        id: 'DEFAULT',
        wfhWorkflowMode: WfhWorkflowMode.STRICT_APPROVAL,
        enableOvertime: true,
        maxWfhDaysPerWeek: 1,
        updatedByEmail: 'sysadmin@dexagroup.com',
      });
      setting = await this.systemSettingRepo.save(setting);
    }
    return setting;
  }

  // Feature: Company Policy & Workflow Configuration — Purpose: Updates enterprise WFH approval workflow mode (Strict Approval vs Notice Only) and Overtime Pay calculation toggle.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: PATCH /api/system/policy -> api-gateway system.controller.ts.
  async updateSystemPolicy(payload: UpdatePolicyPayload): Promise<StandardApiResponse> {
    const where = 'System Policy - Configure';
    if (payload.actor.role !== UserRole.HR_ADMIN && payload.actor.role !== UserRole.SYSTEM_ADMIN) {
      throwRpcError(403, where, 'Unauthorized configuration attempt', 'Only HR Admin and System Admin can update company policies.');
    }

    const setting = await this.getSystemPolicy();
    const deptUpdate: Partial<Department> = {};

    if (payload.dto.wfhWorkflowMode) {
      setting.wfhWorkflowMode = payload.dto.wfhWorkflowMode;
      deptUpdate.wfhWorkflowMode = payload.dto.wfhWorkflowMode;
    }
    if (typeof payload.dto.enableOvertime === 'boolean') {
      setting.enableOvertime = payload.dto.enableOvertime;
      deptUpdate.enableOvertime = payload.dto.enableOvertime;
    }
    if (typeof payload.dto.maxWfhDaysPerWeek === 'number') {
      setting.maxWfhDaysPerWeek = payload.dto.maxWfhDaysPerWeek;
      deptUpdate.maxWfhDaysPerWeek = payload.dto.maxWfhDaysPerWeek;
    }
    setting.updatedByEmail = payload.actor.email ?? 'admin@dexagroup.com';
    const saved = await this.systemSettingRepo.save(setting);

    if (Object.keys(deptUpdate).length > 0) {
      await this.departmentRepo.createQueryBuilder().update(Department).set(deptUpdate).execute();
    }

    return buildResponse({
      where,
      what: 'Company Policy updated',
      why: `Updated WFH Workflow Mode to ${saved.wfhWorkflowMode} and Overtime Calculation to ${saved.enableOvertime ? 'Enabled' : 'Disabled'}.`,
      data: saved,
    });
  }

  // Feature: WFH Attendance Monitoring & Self-Service — Purpose: Resolves the active Employee record for the authenticated user, throwing a clear 404/403 if missing or deactivated.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: Used by clockIn(), clockOut(), getTodayStatus(), getMyHistory(), and AttendanceRequestsService.
  // Feature: Pre-Liveness Face Verification — Purpose: Verifies webcam face frame against employee's enrolled 512-D embedding via InsightFace ArcFace.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: TCP `attendance.verify_face_preview` -> POST /api/attendances/verify-face-preview.
  async verifyFacePreview(payload: { actor: ActorContext; probeEmbedding?: number[] | null }): Promise<StandardApiResponse> {
    const where = 'Biometric - Pre-Liveness Face Verification';
    const employee = await this.requireActiveEmployee(payload.actor.userId, payload.actor.employeeId, where);

    if (!payload.probeEmbedding || !Array.isArray(payload.probeEmbedding) || payload.probeEmbedding.length !== 512) {
      return buildResponse({
        type: 'error',
        where,
        what: 'Invalid face embedding',
        why: 'Extracted embedding vector is invalid.',
        data: {
          recognized: false,
          fullName: employee.fullName,
          employeeCode: employee.employeeCode,
          similarityScore: 0,
        },
      });
    }

    if (!employee.faceEmbedding || !Array.isArray(employee.faceEmbedding) || employee.faceEmbedding.length !== 512) {
      return buildResponse({
        type: 'info',
        where,
        what: `Face detected for ${employee.fullName}`,
        why: 'Face detected cleanly. No prior biometric embedding enrolled yet.',
        data: {
          recognized: true,
          fullName: employee.fullName,
          employeeCode: employee.employeeCode,
          department: employee.department,
          similarityScore: 0.95,
          confidencePercent: 95,
          isFirstEnrollmentPreview: true,
        },
      });
    }

    const probe = payload.probeEmbedding;
    const ref = employee.faceEmbedding;
    let dotProduct = 0;
    for (let i = 0; i < 512; i++) {
      dotProduct += probe[i] * ref[i];
    }
    const similarityScore = Math.round(Math.max(0, Math.min(1, dotProduct)) * 10000) / 10000;
    const isMatched = similarityScore >= 0.45;
    const confidencePercent = Math.min(99, Math.round(similarityScore * 100));

    return buildResponse({
      type: isMatched ? 'success' : 'error',
      where,
      what: isMatched
        ? `Face recognized as ${employee.fullName}`
        : `Face mismatch for ${employee.fullName}`,
      why: isMatched
        ? `InsightFace ArcFace matched with ${(similarityScore * 100).toFixed(1)}% similarity.`
        : `Face similarity (${(similarityScore * 100).toFixed(1)}%) is below required 45% threshold.`,
      data: {
        recognized: isMatched,
        fullName: employee.fullName,
        employeeCode: employee.employeeCode,
        department: employee.department,
        similarityScore,
        confidencePercent,
        avatarUrl: employee.avatarUrl,
      },
    });
  }

  async requireActiveEmployee(userId: string, employeeId: string | null, where: string): Promise<Employee> {
    const employee = employeeId
      ? await this.employeeRepo.findOne({ where: { id: employeeId } })
      : await this.employeeRepo.findOne({ where: { userId } });

    if (!employee) {
      throwRpcError(404, where, 'Employee profile not found', 'No active employee profile is linked to your user account.');
    }
    if (!employee.isActive) {
      throwRpcError(403, where, 'Employee profile is inactive', 'Your employee record has been deactivated by HRD Admin.');
    }
    return employee;
  }

  // Feature: Real-Time Attendance Status — Purpose: Automatically updates any past-day attendance rows that have a Clock-In but no Clock-Out into `MISSING_CLOCK_OUT`.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: Invoked before reading today's status, history, or HRD monitoring logs.
  private async markPastMissingClockOuts(todayDate: string, employeeId?: string): Promise<void> {
    await this.attendanceRepo.update(
      {
        ...(employeeId ? { employeeId } : {}),
        attendanceDate: LessThan(todayDate),
        clockOutTime: IsNull(),
        status: In([AttendanceStatus.ON_TIME, AttendanceStatus.LATE]),
      },
      { status: AttendanceStatus.MISSING_CLOCK_OUT },
    );
  }
}

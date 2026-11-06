// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, LessThan, In, IsNull, Repository } from 'typeorm';
import {
  AccessRequest,
  ActorPayload,
  ApprovalStatus,
  Attendance,
  AttendanceQueryPayload,
  AttendanceRequest,
  AttendanceStatus,
  ClockInPayload,
  ClockOutPayload,
  Employee,
  IdActorPayload,
  MyHistoryPayload,
  StandardApiResponse,
  SummaryPayload,
  buildPaginationMeta,
  buildResponse,
  evaluateClockIn,
  evaluateClockOut,
  formatJakartaDateTime,
  getWorkScheduleConfig,
  resolvePagination,
  shiftDateString,
  throwRpcError,
  toJakartaDateString,
  toJakartaTimeString,
  verifyPhotoTimestamp,
} from '@app/common';

// Feature: WFH Attendance Monitoring & Self-Service — Purpose: Core WFH Attendance engine handling server-timed Clock-In/Out, photo timestamp verification, automated status/duration.
// OOP: Injectable Domain Service (Business Logic Encapsulation) — Connected To: AttendanceServiceController (@MessagePattern ATTENDANCE_PATTERNS) -> api-gateway AttendanceController.
@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(AttendanceRequest)
    private readonly attendanceReqRepo: Repository<AttendanceRequest>,
    @InjectRepository(AccessRequest)
    private readonly accessReqRepo: Repository<AccessRequest>,
  ) {}

  // Feature: WFH Attendance Clock-In — Purpose: Records an employee's WFH Clock-In using the authoritative backend server timestamp (`new Date()`), verifies the photo.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: POST /api/attendances/clock-in -> frontend/src/pages/employee/EmployeeAttendancePage.tsx.
  async clockIn(payload: ClockInPayload): Promise<StandardApiResponse> {
    const where = 'WFH Attendance - Clock In';
    const employee = await this.requireActiveEmployee(payload.actor.userId, payload.actor.employeeId, where);

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
    attendance.ipAddress = payload.ipAddress;
    attendance.deviceInfo = payload.deviceInfo;

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

  // Feature: WFH Attendance Clock-Out — Purpose: Records an employee's WFH Clock-Out using the authoritative backend server timestamp, requires the mandatory daily.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: POST /api/attendances/clock-out -> frontend/src/pages/employee/EmployeeAttendancePage.tsx.
  async clockOut(payload: ClockOutPayload): Promise<StandardApiResponse> {
    const where = 'WFH Attendance - Clock Out';
    const employee = await this.requireActiveEmployee(payload.actor.userId, payload.actor.employeeId, where);

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

    const evalOut = evaluateClockOut(record.clockInTime, serverNow, schedule);

    record.clockOutTime = serverNow;
    record.clockOutPhotoUrl = payload.photo.photoUrl;
    record.clockOutPhotoCapturedAt = parsedCapturedAt;
    record.clockOutCaptureSource = payload.photo.captureSource;
    record.isClockOutTimestampVerified = isOutVerified;
    record.dailyAccomplishment = payload.dailyAccomplishment;
    record.workDurationMinutes = evalOut.workDurationMinutes;
    record.status = evalOut.status;

    const saved = await this.attendanceRepo.save(record);
    saved.employee = employee;

    const hours = Math.floor(evalOut.workDurationMinutes / 60);
    const mins = evalOut.workDurationMinutes % 60;

    return buildResponse({
      where,
      what: `Clock-Out recorded at ${toJakartaTimeString(serverNow)} WIB (${evalOut.status})`,
      why: `Logged ${hours}h ${mins}m (${evalOut.workDurationMinutes} mins) of WFH work along with your daily accomplishment summary and watermarked photo proof.`,
      data: saved,
    });
  }

  // Feature: Real-Time Attendance Status — Purpose: Returns the authenticated employee's attendance status for today along with authoritative server time and schedule config.
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
      },
    });
  }

  // Feature: Personal Attendance History — Purpose: Retrieves paginated personal attendance history and summary counters for the signed-in employee.
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
    };

    return buildResponse({
      type: 'info',
      where,
      what: `Loaded ${items.length} of ${total} personal attendance logs`,
      why: `Displaying WFH attendance history and task summaries for ${employee.fullName} (${employee.employeeCode}).`,
      data: {
        items,
        stats,
      },
      meta: buildPaginationMeta(page, limit, total),
    });
  }

  // Feature: Employee Analytics Dashboard — Purpose: Retrieves comprehensive personal analytics, work duration trends, punctuality scores, today's status, recent attendance.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: GET /api/attendances/my-dashboard -> frontend/src/pages/employee/EmployeeDashboardPage.tsx.
  async getMyDashboard(payload: ActorPayload): Promise<StandardApiResponse> {
    const where = 'Employee Dashboard - Personal Insights';
    const employee = await this.requireActiveEmployee(payload.actor.userId, payload.actor.employeeId, where);

    const serverNow = new Date();
    const todayDate = toJakartaDateString(serverNow);
    const schedule = getWorkScheduleConfig();

    // 1. Today's attendance state
    const todayRecord = await this.attendanceRepo.findOne({
      where: { employeeId: employee.id, attendanceDate: todayDate },
    });

    // 2. All personal attendance history (ordered newest first)
    const allRecords = await this.attendanceRepo.find({
      where: { employeeId: employee.id },
      order: { attendanceDate: 'DESC' },
    });

    const totalDaysLogged = allRecords.length;
    const onTimeDays = allRecords.filter((a) => a.lateMinutes === 0 && a.clockInTime !== null).length;
    const lateDays = allRecords.filter((a) => (a.lateMinutes ?? 0) > 0 || a.status === AttendanceStatus.LATE).length;
    const completedDays = allRecords.filter((a) => a.status === AttendanceStatus.COMPLETED).length;
    const leaveOrSickDays = allRecords.filter(
      (a) => a.status === AttendanceStatus.ON_LEAVE || a.status === AttendanceStatus.SICK,
    ).length;
    const totalMinutesWorked = allRecords.reduce((sum, a) => sum + (a.workDurationMinutes ?? 0), 0);
    const averageDailyMinutes = totalDaysLogged > 0 ? Math.round(totalMinutesWorked / totalDaysLogged) : 0;
    const punctualityRatePercent =
      totalDaysLogged > 0 ? Math.round((onTimeDays / totalDaysLogged) * 1000) / 10 : 100;
    const verifiedPhotosCount = allRecords.filter((a) => a.isTimestampVerified).length;

    // 3. 14-day daily duration trend (for interactive bar/area chart)
    const dailyTrend: Array<{
      date: string;
      dayLabel: string;
      durationMinutes: number;
      durationHours: number;
      targetHours: number;
      isMetTarget: boolean;
      status: AttendanceStatus | 'NOT_LOGGED';
      clockInTime: string | null;
      clockOutTime: string | null;
    }> = [];

    const recordByDate = new Map<string, Attendance>();
    for (const r of allRecords) {
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
        targetHours,
        isMetTarget: durationHours >= targetHours,
        status: rec?.status ?? 'NOT_LOGGED',
        clockInTime: rec?.clockInTime ? new Date(rec.clockInTime).toISOString() : null,
        clockOutTime: rec?.clockOutTime ? new Date(rec.clockOutTime).toISOString() : null,
      });
    }

    // 4. Punctuality and arrival distribution
    const punctualityDistribution = {
      onTimeCount: allRecords.filter((a) => a.lateMinutes === 0 && a.clockInTime !== null).length,
      gracePeriodCount: allRecords.filter((a) => (a.lateMinutes ?? 0) > 0 && (a.lateMinutes ?? 0) <= 15).length,
      lateCount: allRecords.filter((a) => (a.lateMinutes ?? 0) > 15).length,
      leaveOrSickCount: leaveOrSickDays,
    };

    // 5. Recent 5 attendance logs
    const recentLogs = allRecords.slice(0, 5);

    // 6. Recent 3 personal requests (Leave, Sick, Correction)
    const recentRequests = await this.attendanceReqRepo.find({
      where: { employeeId: employee.id },
      order: { createdAt: 'DESC' },
      take: 3,
    });

    return buildResponse({
      type: 'info',
      where,
      what: `Loaded individual dashboard analytics for ${employee.fullName}`,
      why: `Aggregated personal WFH attendance trends, work duration metrics, and shift status for ${employee.fullName} (${employee.employeeCode}).`,
      data: {
        serverTimeIso: serverNow.toISOString(),
        todayDate,
        schedule,
        today: todayRecord ?? null,
        employee: {
          id: employee.id,
          employeeCode: employee.employeeCode,
          fullName: employee.fullName,
          department: employee.department,
          position: employee.position,
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
        },
        dailyTrend,
        punctualityDistribution,
        recentLogs,
        recentRequests,
      },
    });
  }

  // Feature: WFH Attendance Monitoring & Self-Service — Purpose: Retrieves paginated, dynamically filtered attendance logs across all employees for HRD Admin monitoring (view-only control).
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: GET /api/attendances -> frontend/src/pages/hrd/AttendanceMonitoringPage.tsx.
  async findAll(payload: AttendanceQueryPayload): Promise<StandardApiResponse> {
    const where = 'HRD Monitoring - Attendance Audit Log';
    const todayDate = toJakartaDateString();
    await this.markPastMissingClockOuts(todayDate);

    const { query } = payload;
    const { page, limit, skip } = resolvePagination(query.page, query.limit);

    const qb = this.buildFilteredQuery(query);
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

  // Feature: HRD Real-Time Monitoring Dashboard — Purpose: Computes real-time SQL aggregations (COUNT, GROUP BY department, 7-day trend, verification audit counters) for the HRD Dashboard.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: GET /api/attendances/summary -> frontend/src/pages/hrd/HrdDashboardPage.tsx.
  async getSummary(payload: SummaryPayload): Promise<StandardApiResponse> {
    const where = 'HRD Monitoring - Real-Time Summary';
    const targetDate = payload.date || toJakartaDateString();
    await this.markPastMissingClockOuts(toJakartaDateString());

    const activeEmployees = await this.employeeRepo.find({
      where: { isActive: true },
    });
    const totalActiveEmployees = activeEmployees.length;

    const dateAttendances = await this.attendanceRepo.find({
      where: { attendanceDate: targetDate },
      relations: ['employee'],
      withDeleted: true,
    });

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

    // Department aggregation (JOIN + GROUP BY semantics)
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

    // 7-day trend
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
  buildFilteredQuery(query: AttendanceQueryPayload['query']) {
    const qb = this.attendanceRepo
      .createQueryBuilder('att')
      .withDeleted()
      .leftJoinAndSelect('att.employee', 'employee')
      .orderBy('att.attendanceDate', 'DESC')
      .addOrderBy('att.clockInTime', 'DESC');

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

  // Feature: WFH Attendance Monitoring & Self-Service — Purpose: Resolves the active Employee record for the authenticated user, throwing a clear 404/403 if missing or deactivated.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: Used by clockIn(), clockOut(), getTodayStatus(), getMyHistory(), and AttendanceRequestsService.
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

// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  ATTENDANCE_PATTERNS,
  ATTENDANCE_REQUEST_PATTERNS,
  ActorPayload,
  AttendanceQueryPayload,
  AttendanceRequestQueryPayload,
  ClockInPayload,
  ClockOutPayload,
  CreateAttendanceRequestPayload,
  ExportPayload,
  IdActorPayload,
  MyHistoryPayload,
  ReviewAttendanceRequestPayload,
  SummaryPayload,
  UpdatePolicyPayload,
} from '@app/common';
import { AttendanceService } from './attendance/attendance.service';
import { ExportService } from './export/export.service';
import { AttendanceRequestsService } from './requests/attendance-requests.service';

// Feature: covering s #2, #3, #5, #6, #7, #8, #9 — Purpose: TCP microservice controller exposing all WFH Attendance, Leave/Correction Request, Dashboard Summary, and Export handlers on.
// OOP: API Gateway Controller (HTTP Ingress Adapter) — Connected To: Receives TCP messages from backend/apps/api-gateway/src/attendance/*.controller.ts.
@Controller()
export class AttendanceServiceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly requestsService: AttendanceRequestsService,
    private readonly exportService: ExportService,
  ) {}

  // Feature: #6, #7 — Purpose: Handles TCP `attendance.clock_in` message.
  // OOP: Message Handler (TCP Request Handler) — Connected To: AttendanceService.clockIn() -> POST /api/attendances/clock-in.
  // Feature: Pre-Liveness Face Verification — Purpose: Handles TCP `attendance.verify_face_preview` for instant InsightFace identity matching.
  // OOP: Message Handler (TCP Request Handler) — Connected To: AttendanceService.verifyFacePreview() -> POST /api/attendances/verify-face-preview.
  @MessagePattern(ATTENDANCE_PATTERNS.VERIFY_FACE_PREVIEW)
  verifyFacePreview(@Payload() payload: { actor: any; probeEmbedding?: number[] | null }) {
    return this.attendanceService.verifyFacePreview(payload);
  }

  @MessagePattern(ATTENDANCE_PATTERNS.CLOCK_IN)
  clockIn(@Payload() payload: ClockInPayload) {
    return this.attendanceService.clockIn(payload);
  }

  // Feature: #6, #7 — Purpose: Handles TCP `attendance.clock_out` message.
  // OOP: Message Handler (TCP Request Handler) — Connected To: AttendanceService.clockOut() -> POST /api/attendances/clock-out.
  @MessagePattern(ATTENDANCE_PATTERNS.CLOCK_OUT)
  clockOut(@Payload() payload: ClockOutPayload) {
    return this.attendanceService.clockOut(payload);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `attendance.today` message.
  // OOP: Message Handler (TCP Request Handler) — Connected To: AttendanceService.getTodayStatus() -> GET /api/attendances/today.
  @MessagePattern(ATTENDANCE_PATTERNS.TODAY)
  today(@Payload() payload: ActorPayload) {
    return this.attendanceService.getTodayStatus(payload);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `attendance.my_history` message.
  // OOP: Message Handler (TCP Request Handler) — Connected To: AttendanceService.getMyHistory() -> GET /api/attendances/my-history.
  @MessagePattern(ATTENDANCE_PATTERNS.MY_HISTORY)
  myHistory(@Payload() payload: MyHistoryPayload) {
    return this.attendanceService.getMyHistory(payload);
  }

  // Feature: #3, #5, #7 — Purpose: Handles TCP `attendance.my_dashboard` message for individual employee analytics.
  // OOP: Message Handler (TCP Request Handler) — Connected To: AttendanceService.getMyDashboard() -> GET /api/attendances/my-dashboard.
  @MessagePattern(ATTENDANCE_PATTERNS.MY_DASHBOARD)
  myDashboard(@Payload() payload: ActorPayload) {
    return this.attendanceService.getMyDashboard(payload);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `attendance.find_all` message for HRD Monitoring table.
  // OOP: Message Handler (TCP Request Handler) — Connected To: AttendanceService.findAll() -> GET /api/attendances.
  @MessagePattern(ATTENDANCE_PATTERNS.FIND_ALL)
  findAll(@Payload() payload: AttendanceQueryPayload) {
    return this.attendanceService.findAll(payload);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `attendance.find_one` message.
  // OOP: Message Handler (TCP Request Handler) — Connected To: AttendanceService.findOne() -> GET /api/attendances/:id.
  @MessagePattern(ATTENDANCE_PATTERNS.FIND_ONE)
  findOne(@Payload() payload: IdActorPayload) {
    return this.attendanceService.findOne(payload);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `attendance.summary` message for HRD Dashboard aggregations.
  // OOP: Message Handler (TCP Request Handler) — Connected To: AttendanceService.getSummary() -> GET /api/attendances/summary.
  @MessagePattern(ATTENDANCE_PATTERNS.SUMMARY)
  summary(@Payload() payload: SummaryPayload) {
    return this.attendanceService.getSummary(payload);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `attendance.export` message for Excel/CSV generation.
  // OOP: Message Handler (TCP Request Handler) — Connected To: ExportService.exportAttendance() -> GET /api/attendances/export.
  @MessagePattern(ATTENDANCE_PATTERNS.EXPORT)
  exportAttendance(@Payload() payload: ExportPayload) {
    return this.exportService.exportAttendance(payload);
  }

  // Feature: Company Policy & Workflow Configuration — Purpose: Handles TCP `attendance.get_policy` message to retrieve WFH workflow mode and Overtime calculation status.
  // OOP: Message Handler (TCP Request Handler) — Connected To: AttendanceService.getSystemPolicy() -> GET /api/system/policy.
  @MessagePattern(ATTENDANCE_PATTERNS.GET_POLICY)
  getPolicy() {
    return this.attendanceService.getSystemPolicy();
  }

  // Feature: Company Policy & Workflow Configuration — Purpose: Handles TCP `attendance.update_policy` message for HR Admin & System Admin configuration changes.
  // OOP: Message Handler (TCP Request Handler) — Connected To: AttendanceService.updateSystemPolicy() -> PATCH /api/system/policy.
  @MessagePattern(ATTENDANCE_PATTERNS.UPDATE_POLICY)
  updatePolicy(@Payload() payload: UpdatePolicyPayload) {
    return this.attendanceService.updateSystemPolicy(payload);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `attendance_request.create` message.
  // OOP: Message Handler (TCP Request Handler) — Connected To: AttendanceRequestsService.create() -> POST /api/attendance-requests.
  @MessagePattern(ATTENDANCE_REQUEST_PATTERNS.CREATE)
  createRequest(@Payload() payload: CreateAttendanceRequestPayload) {
    return this.requestsService.create(payload);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `attendance_request.my` message.
  // OOP: Message Handler (TCP Request Handler) — Connected To: AttendanceRequestsService.findMyRequests() -> GET /api/attendance-requests/my.
  @MessagePattern(ATTENDANCE_REQUEST_PATTERNS.MY)
  findMyRequests(@Payload() payload: ActorPayload) {
    return this.requestsService.findMyRequests(payload);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `attendance_request.find_all` message for HRD Admin review queue.
  // OOP: Message Handler (TCP Request Handler) — Connected To: AttendanceRequestsService.findAll() -> GET /api/attendance-requests.
  @MessagePattern(ATTENDANCE_REQUEST_PATTERNS.FIND_ALL)
  findAllRequests(@Payload() payload: AttendanceRequestQueryPayload) {
    return this.requestsService.findAll(payload);
  }

  // Feature: Core System Architecture — Purpose: Handles TCP `attendance_request.review` message (Approve / Reject + Attendance Sync).
  // OOP: Message Handler (TCP Request Handler) — Connected To: AttendanceRequestsService.review() -> PATCH /api/attendance-requests/:id/review.
  @MessagePattern(ATTENDANCE_REQUEST_PATTERNS.REVIEW)
  reviewRequest(@Payload() payload: ReviewAttendanceRequestPayload) {
    return this.requestsService.review(payload);
  }
}

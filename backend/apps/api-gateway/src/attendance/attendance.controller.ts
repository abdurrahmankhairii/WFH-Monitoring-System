// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import {
  ATTENDANCE_PATTERNS,
  ATTENDANCE_REQUEST_PATTERNS,
  ATTENDANCE_SERVICE,
  ActorContext,
  AttendanceQueryDto,
  AttendanceRequestQueryDto,
  ClockInDto,
  ClockOutDto,
  CreateAttendanceRequestDto,
  ExportFileResult,
  ExportQueryDto,
  MyHistoryQueryDto,
  ReviewAttendanceRequestDto,
  StandardApiResponse,
  SummaryQueryDto,
  UserRole,
} from '@app/common';
import { CurrentUser, Roles } from '../auth/decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { sendRpc } from '../common/rpc.util';
import { persistAttachmentFile, persistPhotoProof } from '../storage/photo-metadata.util';
import { BiometricClientService } from '../biometric/biometric-client.service';

// Feature: WFH Attendance Monitoring & Self-Service — Purpose: HTTP Gateway controller for WFH Attendance (Clock-In/Out with photo proof & EXIF inspection), personal history,.
// OOP: API Gateway Controller (HTTP Ingress Adapter) — Connected To: Forwards TCP commands to `attendance-service` (:3002) -> Consumed by Employee and HRD Admin portals.
@ApiTags('WFH Attendance, Requests & HRD Monitoring')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class AttendanceController {
  constructor(
    @Inject(ATTENDANCE_SERVICE)
    private readonly attendanceClient: ClientProxy,
    private readonly biometricClient: BiometricClientService,
  ) {}

  // Feature: Pre-Liveness Face Verification — Purpose: Verifies webcam face frame against employee's enrolled 512-D embedding via InsightFace ArcFace.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: POST /api/attendances/verify-face-preview -> frontend CameraPhotoUpload.tsx.
  @Post('attendances/verify-face-preview')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo', { storage: memoryStorage() }))
  @ApiOperation({ summary: 'Verify employee facial identity with InsightFace before active liveness challenges' })
  async verifyFacePreview(
    @CurrentUser() actor: ActorContext,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    const where = 'Biometric - Pre-Liveness Face Verification';
    if (!file || !file.buffer) {
      throw new HttpException(
        {
          statusCode: 400,
          where,
          what: 'Face photo frame is required',
          why: 'Please position your face inside the camera oval.',
        },
        400,
      );
    }

    const extractResult = await this.biometricClient.extractEmbedding(file.buffer, file.originalname);
    if (extractResult.status === 'NO_FACE') {
      return {
        statusCode: 200,
        type: 'info',
        where,
        what: 'Searching for face',
        why: 'No face detected in video frame. Please position your face inside the oval.',
        data: {
          recognized: false,
          faceDetected: false,
          message: 'Align your face inside the biometric oval.',
        },
      };
    }

    if (extractResult.status === 'MULTIPLE_FACES') {
      return {
        statusCode: 200,
        type: 'error',
        where,
        what: 'Multiple faces detected',
        why: `Found ${extractResult.face_count} faces in frame. Verification must be performed individually.`,
        data: {
          recognized: false,
          faceDetected: true,
          message: `Multiple faces detected (${extractResult.face_count}).`,
        },
      };
    }

    return sendRpc(this.attendanceClient, ATTENDANCE_PATTERNS.VERIFY_FACE_PREVIEW, {
      actor,
      probeEmbedding: extractResult.embedding,
    });
  }

  // Feature: WFH Attendance Clock-In — Purpose: Accepts multipart Clock-In submission (watermarked webcam/upload photo + daily plan), extracts EXIF metadata, and forwards.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: POST /api/attendances/clock-in -> frontend/src/pages/employee/EmployeeAttendancePage.tsx.
  @Post('attendances/clock-in')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo', { storage: memoryStorage() }))
  @ApiOperation({ summary: 'Submit WFH Clock-In with watermarked photo proof and daily work plan' })
  async clockIn(
    @CurrentUser() actor: ActorContext,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: ClockInDto,
    @Req() req: Request,
  ) {
    const where = 'WFH Attendance - Clock In Verification';
    if (actor.role === UserRole.SYSTEM_ADMIN) {
      throw new HttpException(
        {
          statusCode: 403,
          where,
          what: 'Clock-In disabled for System Administrator',
          why: 'System Administrator accounts are reserved for platform administration and data management. Please sign in with an Employee or Manager account to record operational attendance.',
        },
        403,
      );
    }
    if (!file || !file.buffer) {
      throw new HttpException(
        {
          statusCode: 400,
          where,
          what: 'WFH photo proof is required',
          why: 'Please capture a live webcam photo or upload a timestamped photo before clocking in.',
        },
        400,
      );
    }

    const extractResult = await this.biometricClient.extractEmbedding(file.buffer, file.originalname);
    if (extractResult.status === 'NO_FACE') {
      throw new HttpException(
        {
          statusCode: 422,
          where,
          what: 'No face detected in attendance photo',
          why: 'The submitted photo does not contain a recognizable human face. Please ensure good lighting and face the camera directly.',
        },
        422,
      );
    }
    if (extractResult.status === 'MULTIPLE_FACES') {
      throw new HttpException(
        {
          statusCode: 422,
          where,
          what: 'Multiple faces detected in attendance photo',
          why: `Found ${extractResult.face_count} faces. WFH attendance verification must be performed individually without bystanders.`,
        },
        422,
      );
    }

    const photo = persistPhotoProof({
      file,
      captureSource: dto.captureSource,
      clientCapturedAt: dto.photoCapturedAt,
      prefix: 'clock-in',
      actor,
      employeeCodeOrId: actor.employeeId ?? actor.userId,
    });

    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;
    const deviceInfo = (req.headers['user-agent'] as string)?.slice(0, 250) || null;

    return sendRpc(this.attendanceClient, ATTENDANCE_PATTERNS.CLOCK_IN, {
      actor,
      photo,
      dailyPlan: dto.dailyPlan ?? null,
      ipAddress,
      deviceInfo,
      verificationMethod: dto.verificationMethod,
      livenessScore: dto.livenessScore,
      latitude: dto.latitude,
      longitude: dto.longitude,
      address: dto.address,
      deviceIssueReason: dto.deviceIssueReason,
      probeEmbedding: extractResult.embedding,
      imageHash: extractResult.image_hash,
      imagePhash: extractResult.image_phash,
    });
  }

  // Feature: WFH Attendance Clock-Out — Purpose: Accepts multipart Clock-Out submission (watermarked photo + mandatory daily accomplishment) and records server Clock-Out.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: POST /api/attendances/clock-out -> frontend/src/pages/employee/EmployeeAttendancePage.tsx.
  @Post('attendances/clock-out')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo', { storage: memoryStorage() }))
  @ApiOperation({ summary: 'Submit WFH Clock-Out with photo proof and mandatory daily accomplishment summary' })
  async clockOut(
    @CurrentUser() actor: ActorContext,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: ClockOutDto,
  ) {
    const where = 'WFH Attendance - Clock Out Verification';
    if (actor.role === UserRole.SYSTEM_ADMIN) {
      throw new HttpException(
        {
          statusCode: 403,
          where,
          what: 'Clock-Out disabled for System Administrator',
          why: 'System Administrator accounts are reserved for platform administration and data management. Please sign in with an Employee or Manager account to record operational attendance.',
        },
        403,
      );
    }
    if (!file || !file.buffer) {
      throw new HttpException(
        {
          statusCode: 400,
          where,
          what: 'WFH photo proof is required',
          why: 'Please capture a live webcam photo or upload a timestamped photo before clocking out.',
        },
        400,
      );
    }

    const extractResult = await this.biometricClient.extractEmbedding(file.buffer, file.originalname);
    if (extractResult.status === 'NO_FACE') {
      throw new HttpException(
        {
          statusCode: 422,
          where,
          what: 'No face detected in attendance photo',
          why: 'The submitted photo does not contain a recognizable human face. Please ensure good lighting and face the camera directly.',
        },
        422,
      );
    }
    if (extractResult.status === 'MULTIPLE_FACES') {
      throw new HttpException(
        {
          statusCode: 422,
          where,
          what: 'Multiple faces detected in attendance photo',
          why: `Found ${extractResult.face_count} faces. WFH attendance verification must be performed individually without bystanders.`,
        },
        422,
      );
    }

    const photo = persistPhotoProof({
      file,
      captureSource: dto.captureSource,
      clientCapturedAt: dto.photoCapturedAt,
      prefix: 'clock-out',
      actor,
      employeeCodeOrId: actor.employeeId ?? actor.userId,
    });

    return sendRpc(this.attendanceClient, ATTENDANCE_PATTERNS.CLOCK_OUT, {
      actor,
      photo,
      dailyAccomplishment: dto.dailyAccomplishment,
      verificationMethod: dto.verificationMethod,
      livenessScore: dto.livenessScore,
      latitude: dto.latitude,
      longitude: dto.longitude,
      address: dto.address,
      deviceIssueReason: dto.deviceIssueReason,
      probeEmbedding: extractResult.embedding,
      imageHash: extractResult.image_hash,
      imagePhash: extractResult.image_phash,
    });
  }

  // Feature: Real-Time Attendance Status — Purpose: Returns today's attendance state, synced server clock, and shift schedule for the signed-in employee.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: GET /api/attendances/today -> frontend EmployeeAttendancePage.tsx.
  @Get('attendances/today')
  @ApiOperation({ summary: 'Get today WFH attendance status and server clock sync' })
  getToday(@CurrentUser() actor: ActorContext) {
    return sendRpc(this.attendanceClient, ATTENDANCE_PATTERNS.TODAY, { actor });
  }

  // Feature: Personal Attendance History — Purpose: Returns the signed-in employee's personal attendance history and summary statistics.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: GET /api/attendances/my-history -> frontend MyAttendanceHistoryPage.tsx.
  @Get('attendances/my-history')
  @ApiOperation({ summary: 'Get personal WFH attendance history and statistics' })
  getMyHistory(@CurrentUser() actor: ActorContext, @Query() query: MyHistoryQueryDto) {
    return sendRpc(this.attendanceClient, ATTENDANCE_PATTERNS.MY_HISTORY, { actor, query });
  }

  // Feature: Employee Analytics Dashboard — Purpose: Returns comprehensive personal WFH analytics, daily work duration trends, arrival scores, and shift status for an individual.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: GET /api/attendances/my-dashboard -> frontend/src/pages/employee/EmployeeDashboardPage.tsx.
  @Get('attendances/my-dashboard')
  @ApiOperation({ summary: 'Get individual employee WFH analytics, work duration trend, and today shift status' })
  getMyDashboard(@CurrentUser() actor: ActorContext) {
    return sendRpc(this.attendanceClient, ATTENDANCE_PATTERNS.MY_DASHBOARD, { actor });
  }

  // Feature: HRD Real-Time Monitoring Dashboard — Purpose: Returns real-time HRD dashboard aggregations (present, on-time, late, department breakdown, 7-day trend).
  // OOP: Controller Action (HTTP Request Handler) — Connected To: GET /api/attendances/summary -> frontend/src/pages/hrd/HrdDashboardPage.tsx.
  @Get('attendances/summary')
  @Roles(UserRole.HR_ADMIN, UserRole.MANAGER, UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Get HRD real-time attendance dashboard summary and department aggregations (HR_ADMIN)' })
  getSummary(@CurrentUser() actor: ActorContext, @Query() query: SummaryQueryDto) {
    return sendRpc(this.attendanceClient, ATTENDANCE_PATTERNS.SUMMARY, { actor, date: query.date });
  }

  // Feature: Data Export & Payroll Reporting — Purpose: Streams a payroll-ready `.xlsx` (Excel) or `.csv` report directly to the browser for HRD Admin.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: GET /api/attendances/export -> ExportService in attendance-service -> frontend AttendanceMonitoringPage.tsx.
  @Get('attendances/export')
  @Roles(UserRole.HR_ADMIN, UserRole.MANAGER, UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Export filtered WFH attendance records to .xlsx (Excel) or .csv (HR_ADMIN)' })
  async exportAttendance(
    @CurrentUser() actor: ActorContext,
    @Query() query: ExportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const result = await sendRpc<StandardApiResponse<ExportFileResult>>(
      this.attendanceClient,
      ATTENDANCE_PATTERNS.EXPORT,
      { actor, query },
    );

    const fileData = result.data!;
    const buffer = Buffer.from(fileData.base64, 'base64');

    res.setHeader('Content-Type', fileData.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileData.fileName}"`);
    res.setHeader('X-Export-Row-Count', String(fileData.rowCount));
    res.send(buffer);
  }

  // Feature: WFH Attendance Monitoring & Self-Service — Purpose: Lists all employee WFH attendance records with dynamic filters for HRD Admin monitoring (view-only control).
  // OOP: Controller Action (HTTP Request Handler) — Connected To: GET /api/attendances -> frontend/src/pages/hrd/AttendanceMonitoringPage.tsx.
  @Get('attendances')
  @Roles(UserRole.HR_ADMIN, UserRole.MANAGER, UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'List all employee WFH attendance logs with dynamic filters (HR_ADMIN view-only control)' })
  findAll(@CurrentUser() actor: ActorContext, @Query() query: AttendanceQueryDto) {
    return sendRpc(this.attendanceClient, ATTENDANCE_PATTERNS.FIND_ALL, { actor, query });
  }

  // Feature: WFH Attendance Monitoring & Self-Service — Purpose: Retrieves a single attendance record for full-screen Lightbox photo & timestamp verification.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: GET /api/attendances/:id -> frontend PhotoLightboxModal.tsx.
  @Get('attendances/:id')
  @ApiOperation({ summary: 'Get attendance record detail for photo & timestamp inspection' })
  findOne(@CurrentUser() actor: ActorContext, @Param('id') id: string) {
    return sendRpc(this.attendanceClient, ATTENDANCE_PATTERNS.FIND_ONE, { actor, id });
  }

  // Feature: WFH Attendance Monitoring & Self-Service — Purpose: Submits a self-service Leave, Sick, or Attendance Correction request with optional supporting attachment.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: POST /api/attendance-requests -> frontend LeaveAndCorrectionModal.tsx.
  @Post('attendance-requests')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('attachment', { storage: memoryStorage() }))
  @ApiOperation({ summary: 'Submit a Leave, Sick, or Attendance Correction request with optional attachment' })
  createRequest(
    @CurrentUser() actor: ActorContext,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: CreateAttendanceRequestDto,
  ) {
    const attachmentUrl = persistAttachmentFile(file, actor);
    return sendRpc(this.attendanceClient, ATTENDANCE_REQUEST_PATTERNS.CREATE, {
      actor,
      dto,
      attachmentUrl,
    });
  }

  // Feature: WFH Attendance Monitoring & Self-Service — Purpose: Lists the signed-in employee's own Leave / Sick / Correction requests.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: GET /api/attendance-requests/my -> frontend MyAttendanceHistoryPage.tsx.
  @Get('attendance-requests/my')
  @ApiOperation({ summary: 'List personal Leave, Sick, and Attendance Correction requests' })
  findMyRequests(@CurrentUser() actor: ActorContext) {
    return sendRpc(this.attendanceClient, ATTENDANCE_REQUEST_PATTERNS.MY, { actor });
  }

  // Feature: WFH Attendance Monitoring & Self-Service — Purpose: Lists all employee Leave / Sick / Correction requests for HRD Admin review.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: GET /api/attendance-requests -> frontend AttendanceMonitoringPage.tsx.
  @Get('attendance-requests')
  @Roles(UserRole.HR_ADMIN, UserRole.MANAGER, UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'List employee Leave, Sick, and Attendance Correction requests (HR_ADMIN, MANAGER, SYSTEM_ADMIN)' })
  findAllRequests(@CurrentUser() actor: ActorContext, @Query() query: AttendanceRequestQueryDto) {
    return sendRpc(this.attendanceClient, ATTENDANCE_REQUEST_PATTERNS.FIND_ALL, { actor, query });
  }

  // Feature: WFH Attendance Monitoring & Self-Service — Purpose: Approves or rejects a pending Leave / Sick / Correction request and automatically updates `attendances`.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: PATCH /api/attendance-requests/:id/review -> frontend AttendanceMonitoringPage.tsx.
  @Patch('attendance-requests/:id/review')
  @Roles(UserRole.HR_ADMIN, UserRole.MANAGER, UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Approve or reject an attendance request and sync attendance record (HR_ADMIN, MANAGER, SYSTEM_ADMIN)' })
  reviewRequest(
    @CurrentUser() actor: ActorContext,
    @Param('id') id: string,
    @Body() dto: ReviewAttendanceRequestDto,
  ) {
    return sendRpc(this.attendanceClient, ATTENDANCE_REQUEST_PATTERNS.REVIEW, { actor, id, dto });
  }
}

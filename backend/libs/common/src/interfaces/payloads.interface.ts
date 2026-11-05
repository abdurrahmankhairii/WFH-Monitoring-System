// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { PhotoCaptureSource } from '../constants/enums';
import {
  AccessRequestQueryDto,
  ApproveAccessRequestDto,
  AttendanceQueryDto,
  AttendanceRequestQueryDto,
  ChangePasswordDto,
  ContactDeveloperDto,
  CreateAttendanceRequestDto,
  CreateEmployeeDto,
  EmployeeQueryDto,
  ExportQueryDto,
  MyHistoryQueryDto,
  RejectAccessRequestDto,
  ReviewAttendanceRequestDto,
  UpdateEmployeeDto,
} from '../dto';
import { ActorContext } from './auth.interface';

// Feature: for Core Architecture — Purpose: Typed TCP message contracts exchanged between the API gateway (sender) and microservices (@Payload receivers).
// OOP: Structural Contract (Interface Definition) — Connected To: api-gateway controllers (client.send) <-> employee-service / attendance-service controllers.

export interface ActorPayload {
  actor: ActorContext;
}

export interface IdActorPayload extends ActorPayload {
  id: string;
}

export interface ChangePasswordPayload extends ActorPayload {
  dto: ChangePasswordDto;
}

export interface EmployeeQueryPayload extends ActorPayload {
  query: EmployeeQueryDto;
}

export interface CreateEmployeePayload extends ActorPayload {
  dto: CreateEmployeeDto;
}

export interface UpdateEmployeePayload extends IdActorPayload {
  dto: UpdateEmployeeDto;
}

export interface AccessRequestQueryPayload extends ActorPayload {
  query: AccessRequestQueryDto;
}

export interface ApproveAccessRequestPayload extends IdActorPayload {
  dto: ApproveAccessRequestDto;
}

export interface RejectAccessRequestPayload extends IdActorPayload {
  dto: RejectAccessRequestDto;
}

export interface ContactDeveloperPayload extends ActorPayload {
  dto: ContactDeveloperDto;
}

// Feature: Core System Architecture — Purpose: Photo proof metadata resolved by the gateway (file stored + EXIF parsed server-side) for clock-in/out.
// OOP: Structural Contract (Interface Definition) — Connected To: api-gateway storage/photo-metadata.util.ts -> attendance.service.ts verifyPhotoTimestamp().
export interface PhotoProofPayload {
  photoUrl: string;
  captureSource: PhotoCaptureSource;
  photoCapturedAt: string | null;
  hasExifTimestamp: boolean;
}

export interface ClockInPayload extends ActorPayload {
  photo: PhotoProofPayload;
  dailyPlan: string | null;
  ipAddress: string | null;
  deviceInfo: string | null;
}

export interface ClockOutPayload extends ActorPayload {
  photo: PhotoProofPayload;
  dailyAccomplishment: string;
}

export interface MyHistoryPayload extends ActorPayload {
  query: MyHistoryQueryDto;
}

export interface AttendanceQueryPayload extends ActorPayload {
  query: AttendanceQueryDto;
}

export interface ExportPayload extends ActorPayload {
  query: ExportQueryDto;
}

export interface SummaryPayload extends ActorPayload {
  date?: string;
}

export interface CreateAttendanceRequestPayload extends ActorPayload {
  dto: CreateAttendanceRequestDto;
  attachmentUrl: string | null;
}

export interface AttendanceRequestQueryPayload extends ActorPayload {
  query: AttendanceRequestQueryDto;
}

export interface ReviewAttendanceRequestPayload extends IdActorPayload {
  dto: ReviewAttendanceRequestDto;
}

// Feature: Core System Architecture — Purpose: Export file transported over TCP as base64 and streamed by the gateway to the browser.
// OOP: Structural Contract (Interface Definition) — Connected To: attendance-service export.service.ts -> api-gateway attendance.controller.ts (res.send(buffer)).
export interface ExportFileResult {
  fileName: string;
  mimeType: string;
  base64: string;
  rowCount: number;
}

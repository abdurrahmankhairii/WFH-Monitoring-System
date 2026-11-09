// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================

// Feature: Domain Enumerations & Status Types — Purpose: Single source of truth for every enumerated domain value shared by all microservices and the API gateway.
// OOP: Functional Helper Module — Connected To: libs/common/src/entities/*.entity.ts (DB enum columns), libs/common/src/dto/*.dto.ts (validation).

export enum UserRole {
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
  HR_ADMIN = 'HR_ADMIN',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
}

export enum EmployeeStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ON_LEAVE = 'ON_LEAVE',
}

export enum AttendanceStatus {
  ON_TIME = 'ON_TIME',
  LATE = 'LATE',
  HALF_DAY = 'HALF_DAY',
  MISSING_CLOCK_OUT = 'MISSING_CLOCK_OUT',
  COMPLETED = 'COMPLETED',
  ON_LEAVE = 'ON_LEAVE',
  SICK = 'SICK',
}

export enum PhotoCaptureSource {
  LIVE_WEBCAM = 'LIVE_WEBCAM',
  FILE_UPLOAD = 'FILE_UPLOAD',
}

export enum AttendanceRequestType {
  WFH_APPROVAL = 'WFH_APPROVAL',
  OVERTIME = 'OVERTIME',
  LEAVE = 'LEAVE',
  SICK = 'SICK',
  CORRECTION = 'CORRECTION',
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum WfhWorkflowMode {
  STRICT_APPROVAL = 'STRICT_APPROVAL',
  NOTICE_ONLY = 'NOTICE_ONLY',
}

export enum OtpType {
  ACCOUNT_VERIFICATION = 'ACCOUNT_VERIFICATION',
  FORGOT_PASSWORD = 'FORGOT_PASSWORD',
}

export enum SupportCategory {
  BUG = 'BUG',
  ACCOUNT_ACCESS = 'ACCOUNT_ACCESS',
  ATTENDANCE_ISSUE = 'ATTENDANCE_ISSUE',
  OTHER = 'OTHER',
}

export enum SupportTicketStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
}

export enum ExportFormat {
  XLSX = 'xlsx',
  CSV = 'csv',
}

export enum VerificationMethod {
  LIVE_CAMERA_LIVENESS = 'LIVE_CAMERA_LIVENESS',
  MANUAL_FILE_UPLOAD = 'MANUAL_FILE_UPLOAD',
}

export enum VerificationStatus {
  VERIFIED_LIVE_BIOMETRIC = 'VERIFIED_LIVE_BIOMETRIC',
  MANUAL_FACE_MATCHED_PENDING_REVIEW = 'MANUAL_FACE_MATCHED_PENDING_REVIEW',
  BIOMETRIC_FAILED = 'BIOMETRIC_FAILED',
  REJECTED_DUPLICATE_PHOTO = 'REJECTED_DUPLICATE_PHOTO',
  REJECTED_LIVENESS_FAILED = 'REJECTED_LIVENESS_FAILED',
}

export enum LocationStatus {
  IN_HOME_RADIUS = 'IN_HOME_RADIUS',
  OUT_OF_HOME_RADIUS = 'OUT_OF_HOME_RADIUS',
  LOCATION_UNAVAILABLE = 'LOCATION_UNAVAILABLE',
}

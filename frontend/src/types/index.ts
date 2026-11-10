// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================

// Feature: Core Architecture — Purpose: Shared TypeScript interfaces and enum types mirroring the NestJS microservices contracts (`@app/common`).
// OOP: Functional Helper Module — Connected To: Used across all files in `frontend/src/` (API client, contexts, custom components, and pages).

export type UserRole = 'SYSTEM_ADMIN' | 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE';
export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
export type AttendanceStatus =
  | 'ON_TIME'
  | 'LATE'
  | 'HALF_DAY'
  | 'MISSING_CLOCK_OUT'
  | 'COMPLETED'
  | 'ON_LEAVE'
  | 'SICK';
export type PhotoCaptureSource = 'LIVE_WEBCAM' | 'FILE_UPLOAD';
export type AttendanceRequestType = 'WFH_APPROVAL' | 'OVERTIME' | 'LEAVE' | 'SICK' | 'CORRECTION';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type WfhWorkflowMode = 'STRICT_APPROVAL' | 'NOTICE_ONLY';
export type SupportCategory = 'BUG' | 'ACCOUNT_ACCESS' | 'ATTENDANCE_ISSUE' | 'OTHER';
export type SupportTicketStatus = 'OPEN' | 'RESOLVED';
export type ToastType = 'success' | 'error' | 'info';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface StandardApiResponse<T = unknown> {
  success: boolean;
  type: ToastType;
  where: string;
  what: string;
  why: string;
  data?: T;
  meta?: PaginationMeta;
  timestamp: string;
}

export interface CompanyPolicyRecord {
  id: string;
  wfhWorkflowMode: WfhWorkflowMode;
  enableOvertime: boolean;
  maxWfhDaysPerWeek: number;
  updatedByEmail: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DepartmentRecord {
  id: string;
  code: string;
  name: string;
  managerName: string;
  managerEmail: string;
  hrPicEmail: string;
  maxWfhDaysPerWeek: number;
  wfhWorkflowMode?: WfhWorkflowMode;
  enableOvertime?: boolean;
  isActive: boolean;
}

export interface WeeklyWfhQuotaInfo {
  weekStart: string;
  weekEnd: string;
  maxWfhDaysPerWeek: number;
  usedWfhDaysThisWeek: number;
  remainingWfhDaysThisWeek: number;
  todayWfhStatus: ApprovalStatus | null;
  todayWfhRequestId?: string | null;
  isWfhApproved?: boolean;
  wfhWorkflowMode: WfhWorkflowMode;
  enableOvertime: boolean;
  managerName: string;
  managerEmail: string;
  hrPicEmail: string;
  baseSalary: number;
  hourlyOvertimeRate: number;
}

export interface UserProfile {
  userId: string;
  email: string;
  role: UserRole;
  isVerified: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  employeeId: string | null;
  employeeCode: string | null;
  fullName: string;
  department: string;
  departmentId?: string | null;
  managerName?: string | null;
  managerEmail?: string | null;
  hrPicEmail?: string | null;
  maxWfhDaysPerWeek?: number;
  position: string;
  phoneNumber: string | null;
  joinDate: string | null;
  baseSalary?: number;
  hourlyOvertimeRate?: number;
  homeLatitude?: number | null;
  homeLongitude?: number | null;
  homeAddress?: string | null;
  status: EmployeeStatus;
  avatarUrl: string | null;
  isFaceEnrolled?: boolean;
  faceEnrolledAt?: string | null;
}

export interface EmployeeRecord {
  id: string;
  userId: string;
  employeeCode: string;
  fullName: string;
  email: string;
  department: string;
  departmentId?: string | null;
  managerName?: string | null;
  managerEmail?: string | null;
  maxWfhDaysPerWeek?: number;
  position: string;
  phoneNumber: string | null;
  joinDate: string;
  baseSalary?: number;
  hourlyOvertimeRate?: number;
  homeLatitude?: number | null;
  homeLongitude?: number | null;
  status: EmployeeStatus;
  isActive: boolean;
  avatarUrl: string | null;
  role: UserRole;
  isVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  verificationOtpPreview?: string;
  isSiblingExempt?: boolean;
  siblingExemptReason?: string | null;
  siblingExemptApprovedBy?: string | null;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employee?: EmployeeRecord;
  attendanceDate: string;
  clockInTime: string | null;
  clockOutTime: string | null;
  workDurationMinutes: number | null;
  lateMinutes: number;
  overtimeMinutes?: number;
  overtimeMultiplierHours?: number;
  overtimePayAmount?: number;
  wfhApproved?: boolean;
  clockInPhotoUrl: string | null;
  clockOutPhotoUrl: string | null;
  clockInPhotoCapturedAt: string | null;
  clockOutPhotoCapturedAt: string | null;
  photoCaptureSource: PhotoCaptureSource | null;
  clockOutCaptureSource: PhotoCaptureSource | null;
  isTimestampVerified: boolean;
  isClockOutTimestampVerified: boolean | null;
  dailyPlan: string | null;
  dailyAccomplishment: string | null;
  status: AttendanceStatus;
  hrNote: string | null;
  ipAddress: string | null;
  deviceInfo: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  distanceFromHomeMeters?: number | null;
  locationStatus?: 'IN_HOME_RADIUS' | 'OUT_OF_HOME_RADIUS' | 'LOCATION_UNAVAILABLE';
  clockOutLatitude?: number | null;
  clockOutLongitude?: number | null;
  clockOutAddress?: string | null;
  clockOutDistanceFromHomeMeters?: number | null;
  clockOutLocationStatus?: 'IN_HOME_RADIUS' | 'OUT_OF_HOME_RADIUS' | 'LOCATION_UNAVAILABLE';
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRequestRecord {
  id: string;
  employeeId: string;
  employee?: EmployeeRecord;
  requestType: AttendanceRequestType;
  targetDate: string;
  requestedClockIn: string | null;
  requestedClockOut: string | null;
  overtimeMinutes?: number;
  estimatedOvertimePay?: number;
  managerEmail?: string | null;
  ccEmails?: string | null;
  emailDispatched?: boolean;
  reason: string;
  attachmentUrl: string | null;
  status: ApprovalStatus;
  reviewedById: string | null;
  reviewNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface AccessRequestRecord {
  id: string;
  fullName: string;
  email: string;
  employeeCode: string | null;
  department: string;
  position: string;
  phoneNumber: string | null;
  reason: string | null;
  status: ApprovalStatus;
  reviewedById: string | null;
  reviewNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface SupportTicketRecord {
  id: string;
  userId: string | null;
  senderEmail: string;
  senderName: string;
  category: SupportCategory;
  moduleLocation: string;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  emailDelivered: boolean;
  createdAt: string;
}

export interface DashboardSummaryData {
  date: string;
  serverTimeIso: string;
  schedule: {
    workStartTime: string;
    graceMinutes: number;
    halfDayThresholdMinutes: number;
  };
  metrics: {
    totalActiveEmployees: number;
    presentToday: number;
    onTimeCount: number;
    lateCount: number;
    completedClockOutCount: number;
    onLeaveOrSickCount: number;
    absentOrNotClockedInCount: number;
    verifiedPhotoCount: number;
    unverifiedPhotoCount: number;
    pendingAttendanceRequests: number;
    pendingAccessRequests: number;
  };
  departmentBreakdown: Array<{
    department: string;
    totalEmployees: number;
    present: number;
    onTime: number;
    late: number;
    onLeaveOrSick: number;
  }>;
  last7Days: Array<{
    date: string;
    present: number;
    onTime: number;
    late: number;
    completed: number;
  }>;
  recentActivity: AttendanceRecord[];
}

export interface EmployeeDashboardData {
  serverTimeIso: string;
  todayDate: string;
  schedule: {
    workStartTime: string;
    graceMinutes: number;
    halfDayThresholdMinutes: number;
  };
  today: AttendanceRecord | null;
  wfhQuota?: WeeklyWfhQuotaInfo;
  employee: {
    id: string;
    employeeCode: string;
    fullName: string;
    department: string;
    position: string;
    baseSalary?: number;
    hourlyOvertimeRate?: number;
    avatarUrl: string | null;
  };
  kpi: {
    totalDaysLogged: number;
    onTimeDays: number;
    lateDays: number;
    completedDays: number;
    leaveOrSickDays: number;
    totalMinutesWorked: number;
    totalHoursWorked: number;
    averageDailyMinutes: number;
    averageDailyHours: number;
    punctualityRatePercent: number;
    verifiedPhotosCount: number;
    totalOvertimeMinutes?: number;
    totalOvertimePayAmount?: number;
  };
  dailyTrend: Array<{
    date: string;
    dayLabel: string;
    durationMinutes: number;
    durationHours: number;
    overtimeMinutes?: number;
    overtimePayAmount?: number;
    targetHours: number;
    isMetTarget: boolean;
    status: AttendanceStatus | 'NOT_LOGGED';
    clockInTime: string | null;
    clockOutTime: string | null;
  }>;
  punctualityDistribution: {
    onTimeCount: number;
    gracePeriodCount: number;
    lateCount: number;
    leaveOrSickCount: number;
  };
  recentLogs: AttendanceRecord[];
  recentRequests: AttendanceRequestRecord[];
}

export interface DatabaseColumnMeta {
  propertyName: string;
  databaseName: string;
  type: string;
  isPrimary: boolean;
  isNullable: boolean;
  isGenerated: boolean;
  default?: any;
  enum?: any[];
}

export interface DatabaseTableMeta {
  tableName: string;
  entityName: string;
  displayName: string;
  description: string;
  primaryKey: string;
  rowCount: number;
  columns: DatabaseColumnMeta[];
}

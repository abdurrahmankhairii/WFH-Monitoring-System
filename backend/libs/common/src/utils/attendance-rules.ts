// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { AttendanceStatus, PhotoCaptureSource } from '../constants/enums';
import { getJakartaMinutesOfDay, parseTimeToMinutes, toJakartaDateString } from './time.util';

export interface WorkScheduleConfig {
  workStartTime: string; // "HH:mm" in WIB
  graceMinutes: number;
  halfDayThresholdMinutes: number;
}

export interface ClockInEvaluation {
  status: AttendanceStatus.ON_TIME | AttendanceStatus.LATE;
  lateMinutes: number;
}

export interface ClockOutEvaluation {
  status: AttendanceStatus.COMPLETED | AttendanceStatus.HALF_DAY;
  workDurationMinutes: number;
}

// Feature: Automated Working Hours & Status Rules — Purpose: Reads company work schedule from environment variables with safe defaults (08:30 WIB, 15 min grace).
// OOP: Stateless Utility Function (Functional Helper) — Connected To: attendance.service.ts, attendance-requests.service.ts, and system.controller.ts.
export function getWorkScheduleConfig(env: NodeJS.ProcessEnv = process.env): WorkScheduleConfig {
  return {
    workStartTime: env.WORK_START_TIME || '08:30',
    graceMinutes: Number(env.WORK_GRACE_MINUTES ?? 15),
    halfDayThresholdMinutes: Number(env.HALF_DAY_THRESHOLD_MINUTES ?? 240),
  };
}

// Feature: Automated Working Hours & Status Rules — Purpose: Classifies a server-generated clock-in instant as ON_TIME or LATE and computes late minutes after shift start.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: attendance.service.ts clockIn() and attendance-requests.service.ts (approved corrections).
export function evaluateClockIn(clockInTime: Date, config: WorkScheduleConfig): ClockInEvaluation {
  const startMinutes = parseTimeToMinutes(config.workStartTime);
  const clockInMinutes = getJakartaMinutesOfDay(clockInTime);
  const isLate = clockInMinutes > startMinutes + config.graceMinutes;
  return {
    status: isLate ? AttendanceStatus.LATE : AttendanceStatus.ON_TIME,
    lateMinutes: isLate ? clockInMinutes - startMinutes : 0,
  };
}

// Feature: Automated Working Hours & Status Rules — Purpose: Computes net work duration (minutes) and the final COMPLETED / HALF_DAY status at clock-out.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: attendance.service.ts clockOut() and attendance-requests.service.ts (approved corrections).
export function evaluateClockOut(clockInTime: Date, clockOutTime: Date, config: WorkScheduleConfig): ClockOutEvaluation {
  const workDurationMinutes = Math.max(0, Math.floor((clockOutTime.getTime() - clockInTime.getTime()) / 60000));
  return {
    status: workDurationMinutes < config.halfDayThresholdMinutes ? AttendanceStatus.HALF_DAY : AttendanceStatus.COMPLETED,
    workDurationMinutes,
  };
}

export interface PhotoTimestampInput {
  source: PhotoCaptureSource;
  capturedAt: Date | null;
  hasExifTimestamp: boolean;
  serverNow: Date;
  liveToleranceMinutes?: number;
  uploadMaxAgeHours?: number;
}

// Feature: Automated Working Hours & Status Rules — Purpose: Anti-spoofing verification deciding if photo capture timestamp matches server shift window.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: attendance.service.ts clock-in and clock-out verification workflows.
export function verifyPhotoTimestamp(input: PhotoTimestampInput): boolean {
  const { source, capturedAt, hasExifTimestamp, serverNow } = input;
  if (!capturedAt || Number.isNaN(capturedAt.getTime())) return false;
  const diffMinutes = (serverNow.getTime() - capturedAt.getTime()) / 60000;

  if (source === PhotoCaptureSource.LIVE_WEBCAM) {
    const tolerance = input.liveToleranceMinutes ?? 5;
    return Math.abs(diffMinutes) <= tolerance;
  }

  if (!hasExifTimestamp) return false;
  const maxAgeMinutes = (input.uploadMaxAgeHours ?? 12) * 60;
  const sameDay = toJakartaDateString(capturedAt) === toJakartaDateString(serverNow);
  return sameDay && diffMinutes >= -5 && diffMinutes <= maxAgeMinutes;
}

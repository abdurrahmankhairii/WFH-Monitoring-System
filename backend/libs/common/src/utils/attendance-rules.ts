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
  overtimeMinutes: number;
}

export interface OvertimePayCalculation {
  overtimeMinutes: number;
  overtimeHoursRaw: number;
  overtimeMultiplierHours: number;
  hourlyBaseRate: number;
  overtimePayAmount: number;
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

// Feature: Automated Working Hours & Status Rules — Purpose: Computes net work duration (minutes), overtime past standard 9h shift span (540m), and COMPLETED / HALF_DAY status.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: attendance.service.ts clockOut() and attendance-requests.service.ts (approved corrections).
export function evaluateClockOut(clockInTime: Date, clockOutTime: Date, config: WorkScheduleConfig): ClockOutEvaluation {
  const workDurationMinutes = Math.max(0, Math.floor((clockOutTime.getTime() - clockInTime.getTime()) / 60000));
  const rawExtraMinutes = Math.max(0, workDurationMinutes - 540);
  const overtimeMinutes = rawExtraMinutes >= 30 ? rawExtraMinutes : 0;
  return {
    status: workDurationMinutes < config.halfDayThresholdMinutes ? AttendanceStatus.HALF_DAY : AttendanceStatus.COMPLETED,
    workDurationMinutes,
    overtimeMinutes,
  };
}

// Feature: Overtime Payroll Calculation Engine (PP No. 35/2021) — Purpose: Computes hourly base rate (1/173 * baseSalary), weighted multiplier hours (1.5x first hour, 2.0x subsequent), and IDR overtime pay.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: attendance.service.ts, attendance-requests.service.ts, and export.service.ts.
export function calculateOvertimeAndPay(overtimeMinutesInput: number, baseSalaryInput = 12000000): OvertimePayCalculation {
  const overtimeMinutes = Math.max(0, Math.round(overtimeMinutesInput || 0));
  const baseSalary = Math.max(1000000, Number(baseSalaryInput || 12000000));
  const hourlyBaseRate = Math.round(baseSalary / 173);

  if (overtimeMinutes < 30) {
    return {
      overtimeMinutes: 0,
      overtimeHoursRaw: 0,
      overtimeMultiplierHours: 0,
      hourlyBaseRate,
      overtimePayAmount: 0,
    };
  }

  const overtimeHoursRaw = Number((overtimeMinutes / 60).toFixed(2));
  const firstHourPart = Math.min(1, overtimeMinutes / 60);
  const subsequentHoursPart = Math.max(0, overtimeMinutes / 60 - 1);
  const overtimeMultiplierHours = Number((firstHourPart * 1.5 + subsequentHoursPart * 2.0).toFixed(2));
  const overtimePayAmount = Math.round(overtimeMultiplierHours * hourlyBaseRate);

  return {
    overtimeMinutes,
    overtimeHoursRaw,
    overtimeMultiplierHours,
    hourlyBaseRate,
    overtimePayAmount,
  };
}

// Feature: Weekly WFH Quota Window Calculator — Purpose: Computes the Monday-to-Sunday ISO calendar week range (YYYY-MM-DD) for any target date to enforce 1-day/week WFH quota.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: attendance-requests.service.ts and attendance.service.ts.
export function getIsoWeekRange(dateStr: string): { weekStart: string; weekEnd: string } {
  const [y, m, d] = dateStr.split('-').map((n) => Number(n));
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  const dayOfWeek = dt.getUTCDay(); // 0 = Sun, 1 = Mon, ... 6 = Sat
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(dt);
  monday.setUTCDate(dt.getUTCDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const fmt = (val: Date) => val.toISOString().slice(0, 10);
  return {
    weekStart: fmt(monday),
    weekEnd: fmt(sunday),
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

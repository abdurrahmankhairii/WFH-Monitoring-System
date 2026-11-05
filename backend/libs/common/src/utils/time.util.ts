// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================

export const APP_TIMEZONE = 'Asia/Jakarta';
const JAKARTA_OFFSET = '+07:00';

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

// Feature: Server Time & Working Duration Calculation — Purpose: Returns the calendar date (YYYY-MM-DD) of a UTC instant as seen in Asia/Jakarta (WIB).
// OOP: Stateless Utility Function (Functional Helper) — Connected To: attendance.service.ts (attendance_date), attendance-rules.ts, attendance-requests.service.ts.
export function toJakartaDateString(date: Date = new Date()): string {
  return dateFormatter.format(date);
}

// Feature: Server Time & Working Duration Calculation — Purpose: Returns the wall-clock time (HH:mm:ss) of an instant in WIB.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: Toast WHY messages in attendance.service.ts and export.service.ts.
export function toJakartaTimeString(date: Date): string {
  return timeFormatter.format(date).replace(/^24/, '00');
}

// Feature: Server Time & Working Duration Calculation — Purpose: Human-readable "YYYY-MM-DD HH:mm:ss WIB" representation used in messages and exports.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: attendance.service.ts, export.service.ts, mail templates.
export function formatJakartaDateTime(date: Date | null | undefined): string {
  if (!date) return '-';
  return `${toJakartaDateString(date)} ${toJakartaTimeString(date)} WIB`;
}

// Feature: Server Time & Working Duration Calculation — Purpose: Minutes elapsed since 00:00 WIB for a given instant (used for shift cut-off comparison).
// OOP: Stateless Utility Function (Functional Helper) — Connected To: evaluateClockIn() in attendance-rules.ts.
export function getJakartaMinutesOfDay(date: Date): number {
  const [hours, minutes] = toJakartaTimeString(date).split(':').map(Number);
  return hours * 60 + minutes;
}

// Feature: Server Time & Working Duration Calculation — Purpose: Parses "HH:mm" into minutes since midnight.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: attendance-rules.ts (WORK_START_TIME) and attendance-requests.service.ts (correction times).
export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Feature: Server Time & Working Duration Calculation — Purpose: Converts a WIB calendar date + "HH:mm" wall time into the exact UTC Date instant.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: attendance-requests.service.ts (approved attendance correction sync).
export function jakartaDateTimeToUtc(dateString: string, time: string): Date {
  return new Date(`${dateString}T${time.length === 5 ? `${time}:00` : time}${JAKARTA_OFFSET}`);
}

// Feature: Server Time & Working Duration Calculation — Purpose: Returns the YYYY-MM-DD date shifted by N days (calendar arithmetic, timezone-safe).
// OOP: Stateless Utility Function (Functional Helper) — Connected To: attendance.service.ts (7-day trend on the HRD dashboard).
export function shiftDateString(dateString: string, days: number): string {
  const base = new Date(`${dateString}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

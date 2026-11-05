// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================

const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

// Feature: Server Time & Working Duration Calculation — Purpose: Converts a compact duration string ("15m", "1h", "7d", "3600") into seconds for JWT expiry configuration.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: employee-service auth.service.ts (JWT_ACCESS_EXPIRES_IN / JWT_REFRESH_EXPIRES_IN).
export function durationToSeconds(value: string | undefined, fallbackSeconds: number): number {
  if (!value) return fallbackSeconds;
  const match = /^(\d+)\s*([smhd])?$/i.exec(value.trim());
  if (!match) return fallbackSeconds;
  const amount = Number(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();
  return amount * (UNIT_SECONDS[unit] ?? 1);
}

// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React, { useEffect, useState } from 'react';
import { Clock, ShieldCheck } from 'lucide-react';
import { apiClient } from '../../api/client';
import { StandardApiResponse } from '../../types';

interface ServerTimePayload {
  serverTimeIso: string;
  serverTimestampMs: number;
  timezone: string;
}

let cachedOffsetMs = 0;

// Feature: Authoritative Server-Synced WIB Clock — Purpose: Returns a Date instance synchronized with the backend API Gateway server clock.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: Used by CameraPhotoUpload.tsx when burning the visual timestamp watermark onto canvas frames.
export function getServerSyncedNow(): Date {
  return new Date(Date.now() + cachedOffsetMs);
}

// Feature: Authoritative Server-Synced WIB Clock — Purpose: Formats a Date instance into Asia/Jakarta (WIB) date and time strings.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: Used by LiveServerClock and CameraPhotoUpload.tsx.
export function formatWibTimestamp(date: Date): { dateText: string; timeText: string; fullWib: string } {
  const dateText = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);

  const timeText = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);

  const isoDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

  return {
    dateText,
    timeText,
    fullWib: `${isoDate} ${timeText} WIB`,
  };
}

// Feature: Authoritative Server-Synced WIB Clock — Purpose: Live ticking server-synchronized clock component that fetches authoritative time from GET /api/system/time.
// OOP: Reusable UI Component (Encapsulated View & State) — Connected To: Rendered in AppLayout.tsx headbar, LoginPage.tsx hero, and EmployeeAttendancePage.tsx.
export const LiveServerClock: React.FC<{
  compact?: boolean;
  variant?: 'default' | 'compact' | 'hero' | 'auth-banner';
}> = ({ compact = false, variant }) => {
  const resolvedVariant = variant ?? (compact ? 'compact' : 'default');
  const [now, setNow] = useState<Date>(() => getServerSyncedNow());
  const [synced, setSynced] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    const syncWithServer = async () => {
      try {
        const clientBefore = Date.now();
        const res = await apiClient.get<StandardApiResponse<ServerTimePayload>>('/system/time', {
          // @ts-expect-error silent background sync
          silentToast: true,
        });
        const clientAfter = Date.now();
        const roundTripHalf = Math.round((clientAfter - clientBefore) / 2);
        const serverMs = res.data.data?.serverTimestampMs;
        if (serverMs && mounted) {
          cachedOffsetMs = serverMs + roundTripHalf - clientAfter;
          setNow(getServerSyncedNow());
          setSynced(true);
        }
      } catch {
        // Keep existing offset if offline
      }
    };

    void syncWithServer();

    const tickTimer = window.setInterval(() => {
      setNow(getServerSyncedNow());
    }, 1000);

    const resyncTimer = window.setInterval(() => {
      void syncWithServer();
    }, 60000);

    return () => {
      mounted = false;
      window.clearInterval(tickTimer);
      window.clearInterval(resyncTimer);
    };
  }, []);

  const { dateText, timeText } = formatWibTimestamp(now);

  if (resolvedVariant === 'compact') {
    return (
      <div
        title="Authoritative backend server clock (Asia/Jakarta WIB)"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
        <span className="font-sans tabular-nums font-medium tracking-tight text-slate-900 dark:text-white">
          {timeText} WIB
        </span>
        <span className="text-slate-400 dark:text-slate-500 hidden sm:inline">•</span>
        <span className="text-slate-600 dark:text-slate-300 hidden sm:inline font-medium">{dateText}</span>
      </div>
    );
  }

  if (resolvedVariant === 'auth-banner') {
    return (
      <div className="px-4 py-3 rounded-xl bg-[#0A2D62] dark:bg-[#131B26] border border-[#0A2D62] dark:border-white/10 text-white font-sans tabular-nums tracking-tight space-y-1 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-base font-semibold tabular-nums text-white">
            {timeText} WIB
          </span>
        </div>
        <div className="text-xs text-blue-200/85 dark:text-slate-400 tabular-nums font-normal">
          {dateText} • Shift 08:30–17:30 (Cutoff 08:45)
        </div>
      </div>
    );
  }

  if (resolvedVariant === 'hero') {
    return (
      <div className="space-y-3.5">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-blue-200/90">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{synced ? 'Server Time Synchronized' : 'Server Time (Asia/Jakarta)'}</span>
        </div>
        <div className="flex items-baseline gap-2.5">
          <span className="text-4xl sm:text-5xl font-semibold font-sans tabular-nums tracking-tight text-white">
            {timeText}
          </span>
          <span className="text-base sm:text-lg font-medium font-sans text-blue-200">WIB</span>
        </div>
        <div className="text-xs sm:text-sm text-blue-100/85 font-normal tabular-nums tracking-tight">
          {dateText} • UTC+07:00
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-r from-[#0A2D62] via-[#123978] to-slate-900 text-white border border-blue-800/50 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-200">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Authoritative Server Clock (Anti-Tamper Synced)</span>
        </div>
        <div className="text-2xl sm:text-3xl font-semibold font-sans tabular-nums tracking-tight">
          {timeText} <span className="text-sm font-medium text-blue-200">WIB</span>
        </div>
        <div className="text-xs text-blue-100/80 font-sans tabular-nums">{dateText} • Asia/Jakarta (UTC+07:00)</div>
      </div>

      <div className="flex flex-col items-start sm:items-end gap-1 text-xs">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          {synced ? 'Server Clock Synchronized (WIB)' : 'Synchronizing Server Clock...'}
        </span>
        <span className="text-[11px] text-blue-200/75">
          Clock-in &amp; clock-out times are recorded on the server
        </span>
      </div>
    </div>
  );
};

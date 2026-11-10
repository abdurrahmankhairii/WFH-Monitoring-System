// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React, { useEffect } from 'react';
import { Camera, CheckCircle2, Clock, FileText, Globe, ShieldAlert, X } from 'lucide-react';
import { resolveMediaUrl } from '../../api/client';
import { AttendanceRecord } from '../../types';
import { StatusBadge } from './InteractiveDataTable';

interface PhotoLightboxModalProps {
  record: AttendanceRecord | null;
  onClose: () => void;
}

// Feature: Photo Proof Lightbox & Metadata Inspection — Purpose: Full-screen inspection modal allowing HRD Admin and employees to inspect Clock-In and Clock-Out photo proofs and timestamps.
// OOP: Reusable UI Component (Encapsulated View & State) — Connected To: Used in AttendanceMonitoringPage.tsx, HrdDashboardPage.tsx, and MyAttendanceHistoryPage.tsx.
export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({ record, onClose }) => {
  useEffect(() => {
    if (!record) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [record, onClose]);

  if (!record) return null;

  // Feature: Photo Proof Lightbox & Metadata Inspection — Purpose: Formats ISO date strings into readable Asia/Jakarta (WIB) timestamps.
  // OOP: Reusable UI Component (Encapsulated View & State) — Connected To: Used inside PhotoLightboxModal metadata cards.
  const formatDateTime = (iso: string | null) => {
    if (!iso) return 'Not recorded';
    return (
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date(iso)) + ' WIB'
    );
  };

  const durationText = record.workDurationMinutes
    ? `${Math.floor(record.workDurationMinutes / 60)}h ${record.workDurationMinutes % 60}m (${record.workDurationMinutes} mins)`
    : 'In Progress / Not Clocked Out';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Attendance photo proof inspection"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-700/80">
        {/* Top Brand Accent Bar */}
        <div className="h-1 bg-gradient-to-r from-[#D32F2F] via-[#0A2D62] to-blue-600" />

        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-sans tabular-nums text-xs font-medium">
                {record.employee?.employeeCode || 'EMP'}
              </span>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {record.employee?.fullName || 'Employee Attendance Proof'}
              </h3>
              <StatusBadge status={record.status} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {record.employee?.department} • {record.employee?.position} • Attendance Date:{' '}
              <strong className="text-slate-700 dark:text-slate-200 font-sans tabular-nums">{record.attendanceDate}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspection modal"
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Timestamp Verification Banner */}
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              record.isTimestampVerified
                ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-200'
                : 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-950 dark:text-rose-200'
            }`}
          >
            {record.isTimestampVerified ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-[#D32F2F] dark:text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="text-xs space-y-1">
              <div className="font-semibold text-sm">
                {record.isTimestampVerified
                  ? `Photo Timestamp Verified (${record.photoCaptureSource || 'LIVE_WEBCAM'})`
                  : `Unverified / Old File Timestamp Warning (${record.photoCaptureSource || 'FILE_UPLOAD'})`}
              </div>
              <p className="leading-relaxed opacity-90">
                {record.isTimestampVerified
                  ? 'The photo capture timestamp matches the authoritative backend server clock window on the attendance date.'
                  : 'This photo was uploaded from a file whose capture timestamp predates the attendance session. Flagged automatically for HRD review.'}
              </p>
            </div>
          </div>

          {/* Side-by-Side Clock-In & Clock-Out Photos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Clock-In Photo Card */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-950 flex flex-col">
              <div className="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-blue-300">
                  <Camera className="w-3.5 h-3.5" />
                  Clock-In Photo Proof
                </span>
                <span className="font-sans text-[11px] text-slate-300">{record.photoCaptureSource || '-'}</span>
              </div>
              <div className="aspect-video bg-slate-950 flex items-center justify-center">
                {record.clockInPhotoUrl ? (
                  <img
                    src={resolveMediaUrl(record.clockInPhotoUrl)}
                    alt="Clock-In Proof"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-xs text-slate-500 p-6">No Clock-In photo attached</div>
                )}
              </div>
              <div className="p-3.5 bg-slate-900/95 text-slate-200 text-xs space-y-1 border-t border-slate-800 mt-auto">
                <div>
                  <span className="text-slate-400">Server Clock-In:</span>{' '}
                  <strong className="font-sans tabular-nums text-white">{formatDateTime(record.clockInTime)}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Photo Captured:</span>{' '}
                  <strong className="font-sans tabular-nums text-blue-300">{formatDateTime(record.clockInPhotoCapturedAt)}</strong>
                </div>
              </div>
            </div>

            {/* Clock-Out Photo Card */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-950 flex flex-col">
              <div className="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-300">
                  <Camera className="w-3.5 h-3.5" />
                  Clock-Out Photo Proof
                </span>
                <span className="font-sans text-[11px] text-slate-300">{record.clockOutCaptureSource || '-'}</span>
              </div>
              <div className="aspect-video bg-slate-950 flex items-center justify-center">
                {record.clockOutPhotoUrl ? (
                  <img
                    src={resolveMediaUrl(record.clockOutPhotoUrl)}
                    alt="Clock-Out Proof"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-xs text-slate-500 p-6">Awaiting Clock-Out photo submission</div>
                )}
              </div>
              <div className="p-3.5 bg-slate-900/95 text-slate-200 text-xs space-y-1 border-t border-slate-800 mt-auto">
                <div>
                  <span className="text-slate-400">Server Clock-Out:</span>{' '}
                  <strong className="font-sans tabular-nums text-white">{formatDateTime(record.clockOutTime)}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Photo Captured:</span>{' '}
                  <strong className="font-sans tabular-nums text-emerald-300">{formatDateTime(record.clockOutPhotoCapturedAt)}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Daily Plan & Daily Accomplishment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/90 dark:border-slate-700/80 space-y-1.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
                <FileText className="w-3.5 h-3.5" />
                <span>Daily Work Plan (Clock-In Notes)</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {record.dailyPlan || 'No daily plan notes submitted.'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/90 dark:border-slate-700/80 space-y-1.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <FileText className="w-3.5 h-3.5" />
                <span>Daily Accomplishment (Clock-Out Summary)</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {record.dailyAccomplishment || 'Session not yet closed / no accomplishment summary recorded.'}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4 flex-wrap text-xs text-slate-600 dark:text-slate-300">
            <div className="inline-flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>
                Net Working Duration: <strong className="text-slate-900 dark:text-white font-sans tabular-nums">{durationText}</strong>
                {record.lateMinutes > 0 ? ` • Late by ${record.lateMinutes} mins` : ''}
              </span>
            </div>
            <div className="inline-flex items-center gap-2 font-sans tabular-nums text-[11px]">
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <span>IP: {record.ipAddress || 'Local'} • {record.deviceInfo || 'Web Client'}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap text-[11px] text-slate-500 dark:text-slate-400">
          <span>
            &copy; 2026 Abdurrahman Khairi - Created strictly for Technical Assessment evaluation. Unauthorized commercial use is prohibited
          </span>
          <button
            type="button"
            onClick={onClose}
            className="taste-btn px-4 py-1.5 rounded-xl bg-[#0A2D62] hover:bg-blue-900 text-white text-xs font-semibold"
          >
            Close Inspection
          </button>
        </div>
      </div>
    </div>
  );
};

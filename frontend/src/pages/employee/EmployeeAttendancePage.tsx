// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Building2,
  Camera,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Hourglass,
  LogIn,
  LogOut,
  RefreshCw,
  Send,
  ShieldAlert,
  X,
} from 'lucide-react';
import { apiClient, resolveMediaUrl } from '../../api/client';
import { CameraPhotoUpload, CapturedPhotoResult } from '../../components/custom/CameraPhotoUpload';
import { StatusBadge } from '../../components/custom/InteractiveDataTable';
import { LeaveAndCorrectionModal } from '../../components/custom/LeaveAndCorrectionModal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { AttendanceRecord, AttendanceRequestType, StandardApiResponse, WeeklyWfhQuotaInfo } from '../../types';

// Feature: Self-Service WFH Clock-In & Clock-Out — Purpose: Primary Employee WFH workspace with live camera watermark proof, weekly WFH quota, and daily work log.
// OOP: Presentation Page Component (View Layer Composition) — Connected To: Calls GET /api/attendances/today, POST /api/attendances/clock-in, and POST /api/attendances/clock-out.
export const EmployeeAttendancePage: React.FC = () => {
  const { user } = useAuth();
  const { notifyApiResponse, showToast } = useToast();
  const navigate = useNavigate();

  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [wfhQuota, setWfhQuota] = useState<WeeklyWfhQuotaInfo | null>(null);
  const [loadingToday, setLoadingToday] = useState<boolean>(true);

  const [clockInPhoto, setClockInPhoto] = useState<CapturedPhotoResult | null>(null);
  const [dailyPlan, setDailyPlan] = useState<string>('');
  const [submittingClockIn, setSubmittingClockIn] = useState<boolean>(false);

  const [clockOutPhoto, setClockOutPhoto] = useState<CapturedPhotoResult | null>(null);
  const [dailyAccomplishment, setDailyAccomplishment] = useState<string>('');
  const [submittingClockOut, setSubmittingClockOut] = useState<boolean>(false);

  const [leaveModalOpen, setLeaveModalOpen] = useState<boolean>(false);
  const [modalInitialType, setModalInitialType] = useState<AttendanceRequestType>('WFH_APPROVAL');
  const [showClockOutVerification, setShowClockOutVerification] = useState<boolean>(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lon: number; accuracy?: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'IDLE' | 'ACQUIRING' | 'LOCKED' | 'DENIED' | 'UNAVAILABLE'>('IDLE');

  // Feature: Geolocation Tagging & Geofencing — Purpose: Proactively acquires high-accuracy GPS coordinates on page mount for WFH geofence verification.
  // OOP: Presentation Lifecycle Hook — Connected To: Sends latitude & longitude to POST /api/attendances/clock-in and clock-out.
  const acquireDeviceGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('UNAVAILABLE');
      return;
    }
    setGpsStatus('ACQUIRING');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setGpsStatus('LOCKED');
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus('DENIED');
        } else {
          setGpsStatus('UNAVAILABLE');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      },
    );
  }, []);

  useEffect(() => {
    acquireDeviceGps();
  }, [acquireDeviceGps]);

  // Feature: Self-Service WFH Clock-In & Clock-Out — Purpose: Enforces immediate biometric gate redirection if the employee has not enrolled their face embedding.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: Navigates to `/auth/enroll-face` via React Router.
  useEffect(() => {
    if (user && user.employeeId && !user.isFaceEnrolled) {
      navigate('/auth/enroll-face', { replace: true });
    }
  }, [user, navigate]);

  // Feature: Self-Service WFH Clock-In & Clock-Out — Purpose: Fetches the logged-in employee's attendance session and weekly WFH quota for today from GET /api/attendances/today.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: AttendanceController.getToday() on api-gateway.
  const loadTodaySession = useCallback(async () => {
    setLoadingToday(true);
    try {
      const res = await apiClient.get<
        StandardApiResponse<
          { todayAttendance?: AttendanceRecord | null; wfhQuota?: WeeklyWfhQuotaInfo } | AttendanceRecord | null
        >
      >('/attendances/today', {
        // @ts-expect-error silent background load
        silentToast: true,
      });
      const raw = res.data.data;
      if (raw && typeof raw === 'object' && 'todayAttendance' in raw) {
        setTodayRecord(raw.todayAttendance ?? null);
        if ('wfhQuota' in raw && raw.wfhQuota) {
          setWfhQuota(raw.wfhQuota);
        }
      } else {
        setTodayRecord((raw as AttendanceRecord | null) || null);
      }
    } finally {
      setLoadingToday(false);
    }
  }, []);

  useEffect(() => {
    void loadTodaySession();
  }, [loadTodaySession]);

  if (!user) return null;

  const hasClockedIn = Boolean(todayRecord?.clockInTime);
  const hasClockedOut = Boolean(todayRecord?.clockOutTime);
  const isLeaveOrSick = todayRecord?.status === 'ON_LEAVE' || todayRecord?.status === 'SICK';
  const isWfhApproved =
    wfhQuota?.todayWfhStatus === 'APPROVED' ||
    Boolean(wfhQuota?.isWfhApproved) ||
    (hasClockedIn && Boolean(todayRecord?.wfhApproved));

  // Feature: Self-Service WFH Clock-In & Clock-Out — Purpose: Submits the Clock-In photo proof, capture timestamp, and daily work plan to POST /api/attendances/clock-in.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: AttendanceController.clockIn() on api-gateway.
  const handleClockInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clockInPhoto) {
      showToast({
        type: 'error',
        where: 'WFH Attendance • Clock-In',
        what: 'WFH photo proof is required',
        why: 'Please capture a live webcam photo or upload a timestamped photo before clocking in.',
      });
      return;
    }

    setSubmittingClockIn(true);
    try {
      let lat = gpsCoords?.lat;
      let lon = gpsCoords?.lon;
      if (lat === undefined || lon === undefined) {
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) => {
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 6000, enableHighAccuracy: true });
          });
          lat = pos.coords.latitude;
          lon = pos.coords.longitude;
        } catch {
          // Geolocation unavailable or denied
        }
      }

      const formData = new FormData();
      formData.append('photo', clockInPhoto.file);
      formData.append('dailyPlan', dailyPlan);
      formData.append('captureSource', clockInPhoto.captureSource);
      formData.append('photoCapturedAt', clockInPhoto.photoCapturedAtIso);
      formData.append('deviceInfo', navigator.userAgent.slice(0, 140));
      formData.append('verificationMethod', clockInPhoto.captureSource === 'LIVE_WEBCAM' ? 'LIVE_CAMERA_LIVENESS' : 'MANUAL_FILE_UPLOAD');
      formData.append('livenessScore', String(clockInPhoto.livenessScore ?? (clockInPhoto.captureSource === 'LIVE_WEBCAM' ? 0.98 : 0.0)));
      if (clockInPhoto.deviceIssueReason) {
        formData.append('deviceIssueReason', clockInPhoto.deviceIssueReason);
      }
      if (lat !== undefined && lon !== undefined) {
        formData.append('latitude', String(lat));
        formData.append('longitude', String(lon));
      }

      const res = await apiClient.post<StandardApiResponse<AttendanceRecord>>('/attendances/clock-in', formData);
      notifyApiResponse(res.data);
      setTodayRecord(res.data.data || null);
      setClockInPhoto(null);
    } finally {
      setSubmittingClockIn(false);
    }
  };

  // Feature: Self-Service WFH Clock-In & Clock-Out — Purpose: Submits the Clock-Out photo proof and mandatory daily accomplishment summary to POST /api/attendances/clock-out.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: AttendanceController.clockOut() on api-gateway.
  const handleClockOutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clockOutPhoto) {
      showToast({
        type: 'error',
        where: 'WFH Attendance • Clock-Out',
        what: 'Clock-Out photo proof is required',
        why: 'Please capture a live webcam photo or upload a timestamped photo before clocking out.',
      });
      return;
    }

    setSubmittingClockOut(true);
    try {
      let lat = gpsCoords?.lat;
      let lon = gpsCoords?.lon;
      if (lat === undefined || lon === undefined) {
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) => {
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 6000, enableHighAccuracy: true });
          });
          lat = pos.coords.latitude;
          lon = pos.coords.longitude;
        } catch {
          // Geolocation unavailable or denied
        }
      }

      const formData = new FormData();
      formData.append('photo', clockOutPhoto.file);
      formData.append('dailyAccomplishment', dailyAccomplishment);
      formData.append('captureSource', clockOutPhoto.captureSource);
      formData.append('photoCapturedAt', clockOutPhoto.photoCapturedAtIso);
      formData.append('deviceInfo', navigator.userAgent.slice(0, 140));
      formData.append('verificationMethod', clockOutPhoto.captureSource === 'LIVE_WEBCAM' ? 'LIVE_CAMERA_LIVENESS' : 'MANUAL_FILE_UPLOAD');
      formData.append('livenessScore', String(clockOutPhoto.livenessScore ?? (clockOutPhoto.captureSource === 'LIVE_WEBCAM' ? 0.98 : 0.0)));
      if (clockOutPhoto.deviceIssueReason) {
        formData.append('deviceIssueReason', clockOutPhoto.deviceIssueReason);
      }
      if (lat !== undefined && lon !== undefined) {
        formData.append('latitude', String(lat));
        formData.append('longitude', String(lon));
      }

      const res = await apiClient.post<StandardApiResponse<AttendanceRecord>>('/attendances/clock-out', formData);
      notifyApiResponse(res.data);
      setTodayRecord(res.data.data || null);
      setClockOutPhoto(null);
    } finally {
      setSubmittingClockOut(false);
    }
  };

  // Feature: Self-Service WFH Clock-In & Clock-Out — Purpose: Formats an ISO timestamp into short HH:mm WIB string for compact session badges.
  // OOP: Presentation Helper Function — Connected To: Used by Compact Status Strip.
  const formatWibShort = (iso: string | null | undefined) => {
    if (!iso) return '--:--';
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));
  };

  // Feature: Self-Service WFH Clock-In & Clock-Out — Purpose: Formats an ISO timestamp into HH:mm:ss WIB for verified completed cards.
  // OOP: Presentation Helper Function — Connected To: Used by Completed Summary Proof cards.
  const formatWibTimeOnly = (iso: string | null | undefined) => {
    if (!iso) return '--:--:--';
    return (
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date(iso)) + ' WIB'
    );
  };

  const approverName = wfhQuota?.managerName || user.managerName || 'Abdurrahman Khairi';
  const durationText = todayRecord?.workDurationMinutes
    ? `${Math.floor(todayRecord.workDurationMinutes / 60)}h ${todayRecord.workDurationMinutes % 60}m`
    : '0h 0m';

  return (
    <div className="space-y-5">
      {/* Page Header + Leave/Correction Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-sans text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
            Welcome, {user.fullName}
          </h1>
          <p className="font-sans text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {user.employeeCode} • {user.department} • {user.position}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setModalInitialType('WFH_APPROVAL');
              setLeaveModalOpen(true);
            }}
            className="taste-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0A2D62] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm"
          >
            {wfhQuota?.wfhWorkflowMode === 'NOTICE_ONLY' ? (
              <>
                <Send className="w-4 h-4" />
                <span>Send WFH Notice (1x/Week)</span>
              </>
            ) : (
              <>
                <CalendarPlus className="w-4 h-4" />
                <span>Request WFH Approval (1x/Week)</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setModalInitialType(wfhQuota?.enableOvertime === false ? 'CORRECTION' : 'OVERTIME');
              setLeaveModalOpen(true);
            }}
            className="taste-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700 text-xs font-semibold shadow-sm"
          >
            <Clock className="w-4 h-4 text-[#D32F2F]" />
            <span>{wfhQuota?.enableOvertime === false ? 'Leave / Time Correction' : 'Overtime / Leave / Correction'}</span>
          </button>
        </div>
      </div>

      {/* Compact Status Strip (4 Clean Summary Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Today's Status */}
        <div className="taste-card bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-3.5 shadow-sm">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-sans">Today&apos;s Status</div>
          <div className="mt-1">
            {todayRecord ? (
              <span className="inline-flex items-center gap-1.5 font-sans text-sm font-semibold text-slate-900 dark:text-white">
                <span
                  className={`w-2 h-2 rounded-full ${
                    hasClockedOut
                      ? 'bg-[#0A2D62] dark:bg-blue-400'
                      : hasClockedIn
                        ? 'bg-emerald-500 animate-pulse'
                        : 'bg-amber-500'
                  }`}
                />
                {hasClockedOut
                  ? 'Shift Completed'
                  : hasClockedIn
                    ? `Active Shift (${formatWibShort(todayRecord.clockInTime)})`
                    : todayRecord.status === 'ON_LEAVE' || todayRecord.status === 'SICK'
                      ? todayRecord.status
                      : 'Not Clocked In'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-sans text-sm font-semibold text-amber-700 dark:text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Not Clocked In
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 font-sans tabular-nums">
            {hasClockedOut
              ? 'Verified session stored'
              : hasClockedIn
                ? todayRecord?.lateMinutes && todayRecord.lateMinutes > 0
                  ? `Late by ${todayRecord.lateMinutes} mins`
                  : 'On-time start'
                : 'Awaiting biometric check-in'}
          </div>
        </div>

        {/* Card 2: Clock-In / Out */}
        <div className="taste-card bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-3.5 shadow-sm">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-sans">Clock-In / Out</div>
          <div className="mt-1 font-sans text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
            {formatWibShort(todayRecord?.clockInTime)} / {formatWibShort(todayRecord?.clockOutTime)} ({durationText})
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 font-sans">
            {hasClockedOut ? 'Shift completed' : hasClockedIn ? 'In progress' : 'Not started'}
          </div>
        </div>

        {/* Card 3: Shift Schedule */}
        <div className="taste-card bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-3.5 shadow-sm">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-sans">Shift Schedule</div>
          <div className="mt-1 font-sans text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
            08:30 – 17:30 WIB
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 font-sans tabular-nums">
            Cutoff 08:45
          </div>
        </div>

        {/* Card 4: WFH Quota & Approver */}
        <div className="taste-card bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-3.5 shadow-sm">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-sans">WFH Quota &amp; Approver</div>
          <div className="mt-1 font-sans text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
            {wfhQuota?.usedWfhDaysThisWeek ?? 0} / {wfhQuota?.maxWfhDaysPerWeek ?? 1} Day Used
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate font-sans">
            Approver: {approverName}
          </div>
        </div>
      </div>

      {/* Main Action Area: Clock-In Form OR Clock-Out Form OR Completed Summary */}
      {loadingToday ? (
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
          Loading today&apos;s attendance session...
        </div>
      ) : isLeaveOrSick ? (
        <div className="p-6 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 text-sky-950 dark:text-sky-200 space-y-2">
          <div className="text-base font-bold">Approved {todayRecord?.status} Recorded for Today</div>
          <p className="text-xs text-sky-800 dark:text-sky-300">
            Your attendance status for today is marked as <strong>{todayRecord?.status}</strong> ({todayRecord?.dailyPlan}). No Clock-In or Clock-Out is required today.
          </p>
        </div>
      ) : !hasClockedIn ? (
        user.employeeId && !user.isFaceEnrolled ? (
          <div className="taste-card bg-amber-50/90 dark:bg-amber-950/40 rounded-2xl border-2 border-amber-300 dark:border-amber-700/70 p-6 sm:p-7 shadow-sm space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#0A2D62] text-white flex items-center justify-center shadow-md shrink-0">
                <ShieldAlert className="w-6 h-6 text-amber-400" />
              </div>
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                  Biometric Face Enrollment Required
                </span>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Facial Biometric Not Registered in Database
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Your account requires a one-time facial biometric setup before Clock-In. Please complete your registration to proceed.
                </p>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => navigate('/auth/enroll-face')}
                className="taste-btn inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0A2D62] hover:bg-blue-900 text-white text-xs font-semibold shadow-md"
              >
                <Camera className="w-4 h-4" />
                <span>Register Biometric Face Now</span>
              </button>
            </div>
          </div>
        ) : !isWfhApproved ? (
          /* WFO Base Schedule & Approval Gating Cards */
          wfhQuota?.todayWfhStatus === 'PENDING' ? (
            <div className="taste-card bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-800/60 p-6 sm:p-7 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-amber-100 dark:border-amber-900/40">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-800/60 shadow-sm shrink-0">
                    <Hourglass className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      WFH Approval Request is Pending Review
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Your WFH request for today has been recorded and an approval email was dispatched to your Manager &amp; HRD
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 self-start sm:self-auto">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  Status: PENDING REVIEW
                </span>
              </div>

              <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 text-xs text-amber-950 dark:text-amber-200 space-y-2">
                <div className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span>Approval Workflow Notification Summary</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Your request was routed to your Department Manager{' '}
                  <strong className="text-slate-900 dark:text-slate-100">
                    {wfhQuota?.managerName || user.managerName || 'Department Manager'}
                  </strong>{' '}
                  (&lt;{wfhQuota?.managerEmail || user.managerEmail || 'manager.it@dexagroup.com'}&gt;) and HRD (&lt;{wfhQuota?.hrPicEmail || 'admin.hrd@dexagroup.com'}&gt;).
                  Once approved, the live watermarked Clock-In form and camera will unlock immediately.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  Weekly WFH Quota: {wfhQuota?.usedWfhDaysThisWeek ?? 1} / {wfhQuota?.maxWfhDaysPerWeek ?? 1} Day in Review
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void loadTodaySession()}
                    className="taste-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold shadow-sm"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Check / Refresh Approval Status</span>
                  </button>
                </div>
              </div>
            </div>
          ) : wfhQuota?.todayWfhStatus === 'REJECTED' ? (
            <div className="taste-card bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/60 p-6 sm:p-7 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-[#D32F2F] dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-900/60 shadow-sm shrink-0">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    WFH Approval Request Not Approved
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Your request to work from home today was reviewed and not approved by your Department Manager
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Dexa Group operates on a primary Work From Office (WFO) schedule. Please attend your scheduled shift at the office. If you believe this is an error, please reach out directly to your manager or submit an attendance correction.
              </p>
            </div>
          ) : wfhQuota?.wfhWorkflowMode === 'NOTICE_ONLY' ? (
            <div className="taste-card bg-white dark:bg-slate-900 rounded-2xl border border-blue-200 dark:border-blue-900/60 p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#0A2D62] text-white flex items-center justify-center shadow-sm shrink-0">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Today is Scheduled as Work From Office (WFO) • Notice Mode
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Dexa Group base operating schedule • Notice-Only mode active (no manual manager approval required)
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 self-start sm:self-auto">
                  Notice-Only Mode Active
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-1.5 text-xs">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">Notice-Only WFH Workflow</div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                    Under Dexa&apos;s Notice-Only WFH policy, manual manager pre-approval is not required. However, you must dispatch an email notice to your Department Manager with your daily focus plan before Clock-In unlocks.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/50 space-y-1.5 text-xs">
                  <div className="font-semibold text-blue-900 dark:text-blue-200">Email Routing &amp; Quota</div>
                  <p className="text-blue-800/90 dark:text-blue-300 leading-relaxed text-[11px]">
                    Dispatching the notice automatically emails{' '}
                    <strong>{wfhQuota?.managerName || user.managerName}</strong> with CC to HRD, and immediately unlocks Clock-In!
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                    Ready to work from home today?
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Click below to preview and dispatch your WFH Notice email to Manager &amp; HRD to immediately unlock Clock-In
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setModalInitialType('WFH_APPROVAL');
                    setLeaveModalOpen(true);
                  }}
                  className="taste-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0A2D62] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span>Send WFH Notice &amp; Unlock Clock-In</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="taste-card bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#0A2D62] text-white flex items-center justify-center shadow-sm shrink-0">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Today is Scheduled as Work From Office (WFO)
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Dexa Group base operating schedule • Flexible hybrid WFH requires prior manager approval
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
                  Dexa Base Policy • WFO
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-1.5 text-xs">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">1-Day/Week Hybrid WFH Policy</div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                    Dexa Group operates on a Work From Office (WFO) base schedule. Flexible WFH is permitted for up to 1 day per calendar week with prior Department Manager approval.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/50 space-y-1.5 text-xs">
                  <div className="font-semibold text-blue-900 dark:text-blue-200">Weekly Quota &amp; Approval Route</div>
                  <p className="text-blue-800/90 dark:text-blue-300 leading-relaxed text-[11px]">
                    Remaining Quota: <strong className="tabular-nums">{wfhQuota?.remainingWfhDaysThisWeek ?? 1} Day</strong> available this week. Requests route to{' '}
                    <strong>{wfhQuota?.managerName || user.managerName}</strong>.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                    Need to work remotely from home today?
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Submit a 2-step WFH Approval Request with interactive manager email overview preview
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setModalInitialType('WFH_APPROVAL');
                    setLeaveModalOpen(true);
                  }}
                  className="taste-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0A2D62] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm shrink-0"
                >
                  <CalendarPlus className="w-4 h-4" />
                  <span>Request WFH Approval for Today</span>
                </button>
              </div>
            </div>
          )
        ) : (
          /* Clock-In Card (Unlocked upon WFH Approval / Notice) */
          <form
            onSubmit={handleClockInSubmit}
            className="taste-card bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden"
          >
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="font-sans text-base font-semibold text-slate-900 dark:text-white">
                  Start WFH Shift (Clock-In)
                </h2>
                <p className="font-sans text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Capture your live watermarked WFH photo proof and outline your daily focus plan
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-medium border border-emerald-200 dark:border-emerald-800/60 font-sans tabular-nums">
                {wfhQuota?.wfhWorkflowMode === 'NOTICE_ONLY'
                  ? 'WFH Notice Dispatched • Ready for Clock-In'
                  : 'Approved WFH Session (1 Day/Week Quota)'}
              </span>
            </div>

            {/* Live GPS Geolocation Status Bar */}
            <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between flex-wrap gap-2 text-xs font-sans">
              <div className="flex items-center gap-2">
                {gpsStatus === 'LOCKED' && gpsCoords ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium tabular-nums">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    GPS Locked: {gpsCoords.lat.toFixed(4)}, {gpsCoords.lon.toFixed(4)}
                    {gpsCoords.accuracy ? ` (±${Math.round(gpsCoords.accuracy)}m)` : ''}
                  </span>
                ) : gpsStatus === 'ACQUIRING' ? (
                  <span className="inline-flex items-center gap-1.5 text-sky-600 dark:text-sky-400 font-medium">
                    <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
                    Acquiring high-accuracy GPS coordinates for WFH geofence...
                  </span>
                ) : gpsStatus === 'DENIED' ? (
                  <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Location Permission Blocked (Allow location in browser for WFH Geofence)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    GPS Signal Standby
                  </span>
                )}
              </div>

              {gpsStatus !== 'LOCKED' && (
                <button
                  type="button"
                  onClick={acquireDeviceGps}
                  className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry GPS</span>
                </button>
              )}
            </div>

            <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7">
                <CameraPhotoUpload
                  employeeCode={user.employeeCode || 'EMP'}
                  fullName={user.fullName}
                  department={user.department}
                  actionLabel="CLOCK-IN"
                  onPhotoReady={setClockInPhoto}
                />
              </div>

              <div className="lg:col-span-5 flex flex-col justify-between space-y-4 h-full">
                <div className="space-y-1.5 flex-1 flex flex-col">
                  <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 font-sans">
                    Daily Work Plan *
                  </label>
                  <textarea
                    required
                    minLength={5}
                    rows={8}
                    value={dailyPlan}
                    onChange={(e) => setDailyPlan(e.target.value)}
                    placeholder="Outline your tasks, deliverables, or meetings for today..."
                    className="w-full flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs font-sans leading-relaxed focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none min-h-[220px]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingClockIn || !clockInPhoto}
                  className="taste-btn w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#0A2D62] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-semibold shadow-sm disabled:opacity-50 font-sans"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{submittingClockIn ? 'Recording Server Clock-In...' : 'Submit Verified Clock-In'}</span>
                </button>
              </div>
            </div>
          </form>
        )
      ) : !hasClockedOut ? (
        /* Active Shift Card */
        !showClockOutVerification ? (
          <div className="taste-card bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-sans text-base font-semibold text-slate-900 dark:text-white">
                  Active WFH Shift in Progress
                </h2>
                <p className="font-sans text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                  Clocked In at {formatWibShort(todayRecord?.clockInTime)} WIB • Target shift completion: 17:30 WIB
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800/60 font-sans tabular-nums">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Active Shift
              </span>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 font-sans">Your Morning Focus Plan</div>
                  <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium font-sans">
                    {todayRecord?.dailyPlan || 'Daily plan recorded upon clock-in'}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 font-sans">Shift Schedule</div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans tabular-nums">
                    Standard shift hours: 08:30 – 17:30 WIB. Camera is paused during shift.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-sans">
                  Camera is turned off during shift to preserve device battery.
                </div>
                <button
                  type="button"
                  onClick={() => setShowClockOutVerification(true)}
                  className="taste-btn inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm shrink-0 font-sans"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Proceed to Clock-Out Verification</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Clock-Out Form */
          <form
            onSubmit={handleClockOutSubmit}
            className="taste-card bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden"
          >
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="font-sans text-base font-semibold text-slate-900 dark:text-white">
                  Complete WFH Shift (Clock-Out)
                </h2>
                <p className="font-sans text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Attach your closing photo proof and submit your mandatory Daily Accomplishment summary
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800/60 font-sans tabular-nums">
                  Clocked In at {formatWibShort(todayRecord?.clockInTime)} WIB
                </span>
                <button
                  type="button"
                  onClick={() => setShowClockOutVerification(false)}
                  className="taste-btn inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 font-sans"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Back to Shift</span>
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7">
                <CameraPhotoUpload
                  employeeCode={user.employeeCode || 'EMP'}
                  fullName={user.fullName}
                  department={user.department}
                  actionLabel="CLOCK-OUT"
                  onPhotoReady={setClockOutPhoto}
                />
              </div>

              <div className="lg:col-span-5 flex flex-col justify-between space-y-4 h-full">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 text-xs space-y-1">
                  <div className="font-semibold text-slate-700 dark:text-slate-200 font-sans">
                    Your Logged Morning Work Plan:
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 font-sans">{todayRecord?.dailyPlan}</p>
                </div>

                <div className="space-y-1.5 flex-1 flex flex-col">
                  <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5 font-sans">
                    Daily Accomplishment *
                  </label>
                  <textarea
                    required
                    minLength={5}
                    rows={6}
                    value={dailyAccomplishment}
                    onChange={(e) => setDailyAccomplishment(e.target.value)}
                    placeholder="Summarize completed tasks, deliverables, or progress today..."
                    className="w-full flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs font-sans leading-relaxed focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none min-h-[160px]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingClockOut || !clockOutPhoto}
                  className="taste-btn w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm disabled:opacity-50 font-sans"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  <span>{submittingClockOut ? 'Recording Server Clock-Out...' : 'Submit Verified Clock-Out'}</span>
                </button>
              </div>
            </div>
          </form>
        )
      ) : (
        /* Step 3: Shift Completed Card */
        <div className="taste-card bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800/60">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Today&apos;s WFH Attendance Session is Complete
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Both Clock-In and Clock-Out photo proofs and daily task logs have been verified and stored.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-950">
              <div className="px-3.5 py-2 bg-slate-900 text-xs font-semibold text-blue-300 flex justify-between">
                <span>Clock-In Proof</span>
                <span className="font-sans tabular-nums">{formatWibTimeOnly(todayRecord?.clockInTime)}</span>
              </div>
              {todayRecord?.clockInPhotoUrl && (
                <img
                  src={resolveMediaUrl(todayRecord.clockInPhotoUrl)}
                  alt="Clock-In Proof"
                  className="w-full h-48 object-contain bg-slate-950"
                />
              )}
              <div className="p-3 bg-slate-900 text-xs text-slate-300 border-t border-slate-800">
                <strong>Plan:</strong> {todayRecord?.dailyPlan}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-950">
              <div className="px-3.5 py-2 bg-slate-900 text-xs font-semibold text-emerald-300 flex justify-between">
                <span>Clock-Out Proof</span>
                <span className="font-sans tabular-nums">{formatWibTimeOnly(todayRecord?.clockOutTime)}</span>
              </div>
              {todayRecord?.clockOutPhotoUrl && (
                <img
                  src={resolveMediaUrl(todayRecord.clockOutPhotoUrl)}
                  alt="Clock-Out Proof"
                  className="w-full h-48 object-contain bg-slate-950"
                />
              )}
              <div className="p-3 bg-slate-900 text-xs text-slate-300 border-t border-slate-800">
                <strong>Accomplishment:</strong> {todayRecord?.dailyAccomplishment}
              </div>
            </div>
          </div>
        </div>
      )}

      {leaveModalOpen && (
        <LeaveAndCorrectionModal
          isOpen={leaveModalOpen}
          onClose={() => setLeaveModalOpen(false)}
          onSubmitted={() => void loadTodaySession()}
          initialRequestType={modalInitialType}
          wfhWorkflowMode={wfhQuota?.wfhWorkflowMode}
          enableOvertime={wfhQuota?.enableOvertime}
        />
      )}
    </div>
  );
};

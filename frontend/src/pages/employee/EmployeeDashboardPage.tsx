// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  Camera,
  CheckCircle2,
  Clock,
  FileCheck2,
  Flame,
  History,
  RefreshCw,
  ShieldCheck,
  Timer,
  TrendingUp,
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { StatusBadge } from '../../components/custom/InteractiveDataTable';
import { LeaveAndCorrectionModal } from '../../components/custom/LeaveAndCorrectionModal';
import { PhotoLightboxModal } from '../../components/custom/PhotoLightboxModal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { AttendanceRecord, AttendanceRequestType, EmployeeDashboardData, StandardApiResponse } from '../../types';

// Feature: Individual Employee Analytics Dashboard — Purpose: Personal WFH analytics dashboard displaying 14-day working duration chart, overtime pay, weekly WFH quota, and personal KPIs.
// OOP: Presentation Page Component (View Layer Composition) — Connected To: Fetches GET /api/attendances/my-dashboard -> attendance-service getMyDashboard().
export const EmployeeDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [dashboard, setDashboard] = useState<EmployeeDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [requestModalOpen, setRequestModalOpen] = useState<boolean>(false);
  const [modalInitialType, setModalInitialType] = useState<AttendanceRequestType>('WFH_APPROVAL');

  // Feature: Individual Employee Analytics Dashboard — Purpose: Loads personal attendance analytics from GET /api/attendances/my-dashboard.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: AttendanceController.getMyDashboard() on api-gateway.
  const loadMyDashboard = useCallback(
    async (notify = false) => {
      setLoading(true);
      try {
        const res = await apiClient.get<StandardApiResponse<EmployeeDashboardData>>('/attendances/my-dashboard', {
          // @ts-expect-error silent background load unless manual refresh
          silentToast: !notify,
        });
        setDashboard(res.data.data || null);
        if (notify && res.data) {
          showToast({
            type: 'info',
            where: res.data.where || 'Employee Personal Dashboard',
            what: res.data.what || 'Personal analytics refreshed',
            why: res.data.why || 'Synchronized your latest WFH hours, punctuality score, and 14-day trend.',
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    void loadMyDashboard(false);
  }, [loadMyDashboard]);

  if (!user) return null;

  const kpi = dashboard?.kpi;
  const today = dashboard?.today;
  const trend = dashboard?.dailyTrend || [];
  const dist = dashboard?.punctualityDistribution || {
    onTimeCount: 0,
    gracePeriodCount: 0,
    lateCount: 0,
    leaveOrSickCount: 0,
  };

  const totalDist = Math.max(
    1,
    dist.onTimeCount + dist.gracePeriodCount + dist.lateCount + dist.leaveOrSickCount,
  );

  // Feature: Individual Employee Analytics Dashboard — Purpose: Formats ISO timestamps into concise Asia/Jakarta HH:mm WIB strings.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: Used in 14-day chart tooltips and recent session cards.
  const formatTimeShort = (iso: string | null | undefined) => {
    if (!iso) return '--:--';
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));
  };

  const approverName = dashboard?.wfhQuota?.managerName || user.managerName || 'Abdurrahman Khairi';

  return (
    <div className="space-y-6">
      {/* Clean Page Header (Consistent with HRD Dashboard & Master Employees) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-sans text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
            Personal WFH Analytics
          </h1>
          <p className="font-sans text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {user.fullName} • {user.employeeCode} • {user.position} • {user.department} • Standard Shift: {dashboard?.schedule.workStartTime || '08:30'} WIB (+{dashboard?.schedule.graceMinutes || 15}m grace)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void loadMyDashboard(true)}
            className="taste-btn inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-800 text-xs font-semibold shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Analytics</span>
          </button>

          <Link
            to="/employee/attendance"
            className="taste-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0A2D62] hover:bg-blue-900 text-white text-xs font-semibold shadow-sm"
          >
            <Camera className="w-4 h-4" />
            <span>{today?.clockInTime ? "View Today's Session" : 'Clock-In Now'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 4 Primary KPI Cards — Standardized font-sans text-2xl font-semibold & calm neutral subtext */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Punctuality Score */}
        <div className="taste-card p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Punctuality Score</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/70 dark:border-emerald-800/60">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="font-sans text-2xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">
              {kpi ? `${kpi.punctualityRatePercent}%` : '--%'}
            </div>
            <div className="font-sans text-xs font-normal tabular-nums text-slate-500 dark:text-slate-400 mt-1">
              {kpi?.onTimeDays ?? 0} on-time / {kpi?.totalDaysLogged ?? 0} logged days
            </div>
          </div>
        </div>

        {/* Card 2: Cumulative WFH Hours */}
        <div className="taste-card p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Cumulative WFH Hours</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/70 dark:border-blue-800/60">
              <Timer className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="font-sans text-2xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">
              {kpi ? `${kpi.totalHoursWorked}h` : '--h'}
            </div>
            <div className="font-sans text-xs font-normal tabular-nums text-slate-500 dark:text-slate-400 mt-1">
              Avg {kpi?.averageDailyHours ?? 0}h / day (Target: 8.0h)
            </div>
          </div>
        </div>

        {/* Card 3: Overtime & WFH Quota */}
        <div className="taste-card p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Overtime &amp; WFH Quota</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-200/70 dark:border-sky-800/60">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="font-sans text-2xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">
              Rp {(kpi?.totalOvertimePayAmount ?? 0).toLocaleString('id-ID')}
            </div>
            <div className="font-sans text-xs font-normal tabular-nums text-slate-500 dark:text-slate-400 mt-1">
              {kpi?.totalOvertimeMinutes ?? 0}m Overtime • WFH {dashboard?.wfhQuota?.usedWfhDaysThisWeek ?? 0}/{dashboard?.wfhQuota?.maxWfhDaysPerWeek ?? 1} day used
            </div>
          </div>
        </div>

        {/* Card 4: Today's Shift Status — Standardized scale & layout */}
        <div className="taste-card p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Today&apos;s Shift Status</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/70 dark:border-amber-800/60">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            {today?.clockInTime ? (
              <div>
                <div className="font-sans text-2xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white truncate">
                  {today.status === 'LATE'
                    ? `Late (${formatTimeShort(today.clockInTime)})`
                    : today.clockOutTime
                      ? 'Completed'
                      : 'Active Shift'}
                </div>
                <div className="font-sans text-xs font-normal tabular-nums text-slate-500 dark:text-slate-400 mt-1">
                  {today.clockOutTime
                    ? `In: ${formatTimeShort(today.clockInTime)} • Out: ${formatTimeShort(today.clockOutTime)}`
                    : `Clocked in at ${formatTimeShort(today.clockInTime)} WIB`}
                </div>
              </div>
            ) : today?.status === 'ON_LEAVE' || today?.status === 'SICK' ? (
              <div>
                <div className="font-sans text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  {today.status === 'ON_LEAVE' ? 'On Leave' : 'Sick Leave'}
                </div>
                <div className="font-sans text-xs font-normal text-slate-500 dark:text-slate-400 mt-1">
                  Approved absence recorded
                </div>
              </div>
            ) : (
              <div>
                <div className="font-sans text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  Not Clocked In
                </div>
                <div className="font-sans text-xs font-normal text-slate-500 dark:text-slate-400 mt-1">
                  Submit live webcam proof to start shift
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Charts Row: 14-Day Interactive Work Duration Bar Chart + Punctuality Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Cols: 14-Day Work Duration Bar Chart */}
        <div className="lg:col-span-8 taste-card bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Working Duration (Last 14 Days)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Daily net working hours vs 8.0h target threshold
              </p>
            </div>

            <div className="flex items-center gap-3 text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-600" />
                On-Time / Completed
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#D32F2F]" />
                Late Arrival
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                Active Session
              </span>
            </div>
          </div>

          {/* Interactive Bar Chart Canvas */}
          <div className="pt-6 pb-2">
            <div className="relative h-52 flex items-end justify-between gap-1.5 sm:gap-2.5 px-1 border-b border-slate-200 dark:border-slate-800">
              {/* 8.0h Target Dashed Line (at 80% height of 10h scale) */}
              <div
                className="absolute left-0 right-0 border-t border-dashed border-amber-500/70 pointer-events-none flex items-center justify-end pr-2"
                style={{ bottom: '80%' }}
              >
                <span className="-top-2.5 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-slate-800 text-[10px] font-sans tabular-nums font-semibold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/60">
                  8.0h Target
                </span>
              </div>

              {trend.map((day) => {
                const maxScaleHours = 10;
                const heightPercent = Math.min(
                  100,
                  Math.max(day.status === 'NOT_LOGGED' ? 4 : 12, Math.round((day.durationHours / maxScaleHours) * 100)),
                );

                const barColor =
                  day.status === 'NOT_LOGGED'
                    ? 'bg-slate-200 dark:bg-slate-800'
                    : day.status === 'LATE'
                      ? 'bg-gradient-to-t from-[#D32F2F] to-rose-400'
                      : day.clockInTime && !day.clockOutTime
                        ? 'bg-gradient-to-t from-emerald-600 to-emerald-400'
                        : 'bg-gradient-to-t from-[#0A2D62] to-blue-500';

                return (
                  <div
                    key={day.date}
                    className="group relative flex-1 flex flex-col items-center justify-end h-full"
                  >
                    {/* Hover Tooltip */}
                    <div className="opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity absolute -top-12 z-20 whitespace-nowrap px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[10px] shadow-lg border border-slate-700 font-sans tabular-nums">
                      <div className="font-semibold">{day.dayLabel}</div>
                      <div>
                        {day.durationHours}h ({day.status.replace('_', ' ')})
                      </div>
                    </div>

                    <div
                      className={`w-full max-w-[30px] rounded-t-lg transition-all duration-300 group-hover:brightness-110 ${barColor}`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                );
              })}
            </div>

            {/* X-Axis Labels */}
            <div className="flex items-center justify-between gap-1.5 sm:gap-2.5 pt-2 px-1">
              {trend.map((day) => (
                <div key={day.date} className="flex-1 text-center">
                  <div className="text-[10px] font-sans tabular-nums text-slate-500 dark:text-slate-400 truncate">
                    {day.date.slice(8, 10)}/{day.date.slice(5, 7)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span>Hover any bar to view daily hours and attendance status</span>
            </span>
            <Link
              to="/employee/history"
              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              <span>Full History &amp; Export</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Right 4 Cols: Punctuality Distribution & Quick Summary */}
        <div className="lg:col-span-4 taste-card bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-sm flex flex-col justify-between space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Punctuality Breakdown
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Arrival window distribution against standard 08:30 WIB shift
            </p>
          </div>

          <div className="space-y-3.5">
            {[
              {
                label: 'Early / On-Time (≤ 08:30 WIB)',
                count: dist.onTimeCount,
                barClass: 'bg-emerald-500',
                textClass: 'text-emerald-600 dark:text-emerald-400',
              },
              {
                label: 'Grace Window (08:31 – 08:45 WIB)',
                count: dist.gracePeriodCount,
                barClass: 'bg-blue-500',
                textClass: 'text-blue-600 dark:text-blue-400',
              },
              {
                label: 'Late Arrival (> 08:45 WIB)',
                count: dist.lateCount,
                barClass: 'bg-[#D32F2F]',
                textClass: 'text-[#D32F2F] dark:text-rose-400',
              },
              {
                label: 'Approved Leave / Sick',
                count: dist.leaveOrSickCount,
                barClass: 'bg-amber-500',
                textClass: 'text-amber-600 dark:text-amber-400',
              },
            ].map((item) => {
              const pct = Math.round((item.count / totalDist) * 100);
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
                    <span className={`font-sans tabular-nums font-medium ${item.textClass}`}>
                      {item.count}d ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${item.barClass}`}
                      style={{ width: `${Math.max(item.count > 0 ? 8 : 0, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs space-y-1">
            <div className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Attendance Compliance Status</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans tabular-nums">
              All photo proofs and daily task logs are verified and linked to your employee profile ({user.employeeCode}).
            </p>
          </div>
        </div>
      </div>

      {/* Recent WFH Sessions & Recent Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent WFH Attendance Sessions */}
        <div className="lg:col-span-7 taste-card bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Recent WFH Attendance Sessions
              </h2>
            </div>
            <Link
              to="/employee/history"
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              View All
            </Link>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {(dashboard?.recentLogs || []).slice(0, 5).map((rec) => {
              const isActive = Boolean(rec.clockInTime && !rec.clockOutTime);
              const isFuture = rec.attendanceDate > (dashboard?.todayDate || '');
              return (
                <div
                  key={rec.id}
                  className="py-3 flex items-center justify-between gap-3 flex-wrap hover:bg-slate-50/60 dark:hover:bg-slate-800/40 px-2 rounded-xl transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-sans tabular-nums text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {rec.attendanceDate}
                      </span>
                      <StatusBadge status={rec.status} />
                    </div>
                    <div className="text-xs font-normal text-slate-500 dark:text-slate-400 line-clamp-1 max-w-md">
                      {rec.dailyPlan || 'Standard WFH session'}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right font-sans tabular-nums text-xs font-medium">
                      <div className="text-slate-700 dark:text-slate-200">
                        {formatTimeShort(rec.clockInTime)} – {formatTimeShort(rec.clockOutTime)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans">
                        {rec.workDurationMinutes
                          ? `${Math.floor(rec.workDurationMinutes / 60)}h ${rec.workDurationMinutes % 60}m`
                          : isActive
                            ? 'In Progress'
                            : isFuture
                              ? 'Scheduled'
                              : 'Pending Clock-In'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedRecord(rec)}
                      className="taste-btn px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-xs font-semibold text-blue-600 dark:text-blue-400"
                    >
                      View
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent WFH / Overtime / Leave Requests */}
        <div className="lg:col-span-5 taste-card bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-[#D32F2F]" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                WFH, Overtime &amp; Leave Requests
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setModalInitialType('WFH_APPROVAL');
                setRequestModalOpen(true);
              }}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              + New WFH / Overtime
            </button>
          </div>

          {(dashboard?.recentRequests || []).length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              <Clock className="w-6 h-6 mx-auto mb-2 opacity-50" />
              No WFH, overtime, leave, or correction requests submitted yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {(dashboard?.recentRequests || []).slice(0, 4).map((req) => (
                <div
                  key={req.id}
                  className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 font-sans tabular-nums">
                      {req.requestType.replace('_', ' ')} • {req.targetDate}
                    </span>
                    <StatusBadge status={req.status} />
                  </div>
                  {req.requestType === 'OVERTIME' && req.estimatedOvertimePay ? (
                    <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 tabular-nums font-sans">
                      {req.overtimeMinutes}m Overtime • Rp {Number(req.estimatedOvertimePay).toLocaleString('id-ID')}
                    </div>
                  ) : null}
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-sans">
                    Approver: {approverName}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{req.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <PhotoLightboxModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
      {requestModalOpen && (
        <LeaveAndCorrectionModal
          isOpen={requestModalOpen}
          onClose={() => setRequestModalOpen(false)}
          onSubmitted={() => void loadMyDashboard(false)}
          initialRequestType={modalInitialType}
        />
      )}
    </div>
  );
};

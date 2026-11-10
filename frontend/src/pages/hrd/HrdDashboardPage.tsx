// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { apiClient, resolveMediaUrl } from '../../api/client';
import { CompanyPolicyModal } from '../../components/custom/CompanyPolicyModal';
import { StatusBadge } from '../../components/custom/InteractiveDataTable';
import { PhotoLightboxModal } from '../../components/custom/PhotoLightboxModal';
import { useToast } from '../../context/ToastContext';
import { AttendanceRecord, DashboardSummaryData, StandardApiResponse } from '../../types';

// Feature: HRD Real-Time Monitoring Dashboard — Purpose: Executive HRD overview displaying real-time workforce attendance metrics, composition bar, department breakdown, and photo proof feed.
// OOP: Presentation Page Component (View Layer Composition) — Connected To: Fetches GET /api/attendances/dashboard-summary -> attendance-service AttendanceService.getDashboardSummary().
export const HrdDashboardPage: React.FC = () => {
  const { showToast } = useToast();
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState<DashboardSummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [policyModalOpen, setPolicyModalOpen] = useState<boolean>(false);

  // Feature: HRD Real-Time Monitoring Dashboard — Purpose: Fetches aggregated attendance analytics for the selected date from GET /api/attendances/summary.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: AttendanceController.getSummary() on api-gateway.
  const loadSummary = useCallback(
    async (dateStr: string, notifyFilter = false) => {
      setLoading(true);
      try {
        const res = await apiClient.get<StandardApiResponse<DashboardSummaryData>>(
          `/attendances/summary?date=${encodeURIComponent(dateStr)}`,
          {
            // @ts-expect-error silent background load
            silentToast: true,
          },
        );
        const data = res.data.data || null;
        if (
          !notifyFilter &&
          data &&
          data.metrics.presentToday === 0 &&
          Array.isArray(data.last7Days)
        ) {
          const latestActiveDay = [...data.last7Days].reverse().find((d) => d.present > 0);
          if (latestActiveDay && latestActiveDay.date !== dateStr) {
            setSelectedDate(latestActiveDay.date);
            const fallbackRes = await apiClient.get<StandardApiResponse<DashboardSummaryData>>(
              `/attendances/summary?date=${encodeURIComponent(latestActiveDay.date)}`,
              {
                // @ts-expect-error silent background load
                silentToast: true,
              },
            );
            setSummary(fallbackRes.data.data || data);
            return;
          }
        }
        setSummary(data);
        if (notifyFilter) {
          showToast({
            type: 'info',
            where: 'HRD Dashboard • Date Filter',
            what: `Loaded attendance analytics for ${dateStr}`,
            why: `Refreshed workforce attendance KPIs, department breakdown, and 7-day trend for ${dateStr}.`,
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    void loadSummary(selectedDate, false);
  }, [loadSummary, selectedDate]);

  const m = summary?.metrics;

  const kpiCards = [
    {
      label: 'Total Active Employees',
      value: m?.totalActiveEmployees ?? 0,
      sub: 'Active master employee records',
      icon: Users,
      tone: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
    },
    {
      label: 'Present WFH Today',
      value: m?.presentToday ?? 0,
      sub: `${m?.completedClockOutCount ?? 0} completed clock-out`,
      icon: CheckCircle2,
      tone: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
    },
    {
      label: 'On-Time Arrivals',
      value: m?.onTimeCount ?? 0,
      sub: `Before ${summary?.schedule.workStartTime || '08:30'} +${summary?.schedule.graceMinutes || 15}m WIB`,
      icon: Clock,
      tone: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
    },
    {
      label: 'Late Clock-Ins',
      value: m?.lateCount ?? 0,
      sub: 'Exceeded 15-min grace window',
      icon: AlertTriangle,
      tone: 'bg-rose-50 dark:bg-rose-950/50 text-[#D32F2F] dark:text-rose-300 border-rose-200 dark:border-rose-800/60',
    },
    {
      label: 'On Leave / Sick',
      value: m?.onLeaveOrSickCount ?? 0,
      sub: `${m?.absentOrNotClockedInCount ?? 0} not clocked in yet`,
      icon: Calendar,
      tone: 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/60',
    },
    {
      label: 'Photo Timestamp Audit',
      value: `${m?.verifiedPhotoCount ?? 0} / ${(m?.verifiedPhotoCount ?? 0) + (m?.unverifiedPhotoCount ?? 0)}`,
      sub: `${m?.unverifiedPhotoCount ?? 0} flagged unverified photo(s)`,
      icon: ShieldAlert,
      tone:
        (m?.unverifiedPhotoCount ?? 0) > 0
          ? 'bg-rose-50 dark:bg-rose-950/50 text-[#D32F2F] dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
          : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-rose-800/60',
    },
  ];

  const totalHeadcount = Math.max(1, m?.totalActiveEmployees ?? 1);
  const onTimePct = Math.round(((m?.onTimeCount ?? 0) / totalHeadcount) * 100);
  const latePct = Math.round(((m?.lateCount ?? 0) / totalHeadcount) * 100);
  const leavePct = Math.round(((m?.onLeaveOrSickCount ?? 0) / totalHeadcount) * 100);
  const pendingPct = Math.max(0, 100 - onTimePct - latePct - leavePct);

  return (
    <div className="space-y-6">
      {/* Page Header & Date Picker */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="font-sans text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
            Real-Time WFH Attendance Dashboard
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Live workforce attendance, photo timestamp compliance, and department participation for{' '}
            <strong className="text-slate-800 dark:text-slate-200 font-sans font-medium tabular-nums">{selectedDate}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                void loadSummary(e.target.value, true);
              }}
              aria-label="Filter dashboard date"
              className="text-xs font-medium font-sans tabular-nums text-slate-800 dark:text-slate-100 bg-transparent focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => void loadSummary(selectedDate, true)}
            className="taste-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setPolicyModalOpen(true)}
            className="taste-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 shadow-sm"
          >
            <Settings2 className="w-3.5 h-3.5 text-[#0A2D62] dark:text-blue-400" />
            <span>Company Policy</span>
          </button>

          <Link
            to="/hrd/monitoring"
            className="taste-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0A2D62] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-medium shadow-sm"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Full Audit &amp; Export</span>
          </Link>
        </div>
      </div>

      {/* Pending Approvals Alert Bar */}
      {((m?.pendingAttendanceRequests ?? 0) > 0 || (m?.pendingAccessRequests ?? 0) > 0) && (
        <div className="p-4 rounded-2xl bg-amber-50/90 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-amber-950 dark:text-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <span className="font-semibold">Pending HRD Action Required:</span>{' '}
              <strong>{m?.pendingAttendanceRequests ?? 0}</strong> Leave/Time Correction Request(s) and{' '}
              <strong>{m?.pendingAccessRequests ?? 0}</strong> New Employee Onboarding Access Request(s) awaiting review.
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/hrd/monitoring"
              className="taste-btn px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
            >
              Review Leave / Corrections
            </Link>
            <Link
              to="/hrd/employees"
              className="taste-btn px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold"
            >
              Review Access Requests
            </Link>
          </div>
        </div>
      )}

      {/* 6 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="taste-card bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-sm flex items-start justify-between gap-3"
            >
              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{card.label}</div>
                <div className="font-sans text-2xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white mt-1">
                  {card.value}
                </div>
                <div className="font-sans text-xs font-normal tabular-nums text-slate-500 dark:text-slate-400 mt-1">{card.sub}</div>
              </div>
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${card.tone}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Signature Workforce Attendance Composition Bar */}
      <div className="taste-card bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Workforce Attendance Composition ({selectedDate})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              Proportional distribution across all {m?.totalActiveEmployees ?? 0} active employees
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 font-sans text-xs font-medium tabular-nums">
            <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              On-Time: {m?.onTimeCount ?? 0} ({onTimePct}%)
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#D32F2F] dark:text-rose-400">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D32F2F]" />
              Late: {m?.lateCount ?? 0} ({latePct}%)
            </span>
            <span className="inline-flex items-center gap-1.5 text-sky-700 dark:text-sky-400">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
              Leave / Sick: {m?.onLeaveOrSickCount ?? 0} ({leavePct}%)
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
              Awaiting: {m?.absentOrNotClockedInCount ?? 0} ({pendingPct}%)
            </span>
          </div>
        </div>

        <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
          {onTimePct > 0 && (
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${onTimePct}%` }}
              title={`On-Time: ${onTimePct}%`}
            />
          )}
          {latePct > 0 && (
            <div
              className="h-full bg-[#D32F2F] transition-all duration-500"
              style={{ width: `${latePct}%` }}
              title={`Late: ${latePct}%`}
            />
          )}
          {leavePct > 0 && (
            <div
              className="h-full bg-sky-500 transition-all duration-500"
              style={{ width: `${leavePct}%` }}
              title={`Leave / Sick: ${leavePct}%`}
            />
          )}
          {pendingPct > 0 && (
            <div
              className="h-full bg-slate-200 dark:bg-slate-700 transition-all duration-500"
              style={{ width: `${pendingPct}%` }}
              title={`Awaiting Clock-In: ${pendingPct}%`}
            />
          )}
        </div>
      </div>

      {/* Middle Row: Department Breakdown + 7-Day Attendance Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Department Attendance Breakdown */}
        <div className="lg:col-span-7 taste-card bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Department Attendance Breakdown
              </h2>
            </div>
            <span className="text-xs font-sans text-slate-400">Live Department Rollup</span>
          </div>

          <div className="space-y-3.5">
            {(summary?.departmentBreakdown || []).map((dept) => {
              const rate = dept.totalEmployees > 0 ? Math.round((dept.present / dept.totalEmployees) * 100) : 0;
              return (
                <div
                  key={dept.department}
                  className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900 dark:text-white">{dept.department}</span>
                    <span className="font-sans text-xs font-medium tabular-nums text-blue-700 dark:text-blue-400">
                      {dept.present} / {dept.totalEmployees} Present ({rate}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#0A2D62] to-emerald-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, rate)}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-4 font-sans text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
                    <span className="text-emerald-700 dark:text-emerald-400">
                      On-Time: {dept.onTime}
                    </span>
                    <span className="text-[#D32F2F] dark:text-rose-400">Late: {dept.late}</span>
                    <span>Leave / Sick: {dept.onLeaveOrSick}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 7-Day Attendance Trend */}
        <div className="lg:col-span-5 taste-card bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              7-Day WFH Attendance Trend
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Daily On-Time vs Late breakdown across the past 7 days
            </p>
          </div>

          <div className="space-y-2.5">
            {(summary?.last7Days || []).map((day) => {
              const total = Math.max(1, m?.totalActiveEmployees || 6);
              const pct = Math.min(100, Math.round((day.present / total) * 100));
              return (
                <div key={day.date} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-sans font-medium tabular-nums">
                    <span className="text-slate-700 dark:text-slate-200">{day.date}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-700 dark:text-emerald-400">
                        {day.onTime} On-Time
                      </span>
                      <span className="text-[#D32F2F] dark:text-rose-400">{day.late} Late</span>
                      <span className="text-slate-500">({day.present} total)</span>
                    </div>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-[#0A2D62] dark:bg-blue-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Live Photo Proof Feed for Selected Date */}
      <div className="taste-card bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Recent WFH Photo Proofs &amp; Timestamp Verification ({selectedDate})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Click any employee card to inspect full-resolution Clock-In and Clock-Out photos and server timestamps
            </p>
          </div>
          <Link
            to="/hrd/monitoring"
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700"
          >
            <span>Open Full Audit Table</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {(summary?.recentActivity || []).length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            No attendance records logged for {selectedDate} yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(summary?.recentActivity || []).map((rec) => (
              <div
                key={rec.id}
                onClick={() => setSelectedRecord(rec)}
                className="taste-card taste-card-interactive group cursor-pointer rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-400 overflow-hidden bg-slate-50/60 dark:bg-slate-800/40 flex flex-col"
              >
                <div className="aspect-video bg-slate-950 relative overflow-hidden">
                  {rec.clockInPhotoUrl ? (
                    <img
                      src={resolveMediaUrl(rec.clockInPhotoUrl)}
                      alt={rec.employee?.fullName || 'Proof'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                      Leave / No Photo Required
                    </div>
                  )}
                  <div className="absolute top-2.5 left-2.5">
                    <StatusBadge status={rec.status} />
                  </div>
                  <div className="absolute top-2.5 right-2.5">
                    {rec.isTimestampVerified ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-600/95 text-white shadow">
                        Timestamp Verified
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#D32F2F] text-white shadow">
                        Unverified Timestamp
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {rec.employee?.fullName}
                      </span>
                      <span className="font-mono text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {rec.employee?.employeeCode}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {rec.employee?.department} • {rec.employee?.position}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mt-1.5">
                      {rec.dailyPlan || 'No plan notes'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                    <span>Inspect Timestamp &amp; Proof</span>
                    <Eye className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PhotoLightboxModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
      <CompanyPolicyModal
        isOpen={policyModalOpen}
        onClose={() => setPolicyModalOpen(false)}
        onSaved={() => void loadSummary(selectedDate, true)}
      />
    </div>
  );
};

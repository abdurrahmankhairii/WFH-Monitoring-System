// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React, { useCallback, useEffect, useState } from 'react';
import { CalendarPlus, Camera, CheckCircle2, Eye, ShieldAlert } from 'lucide-react';
import { apiClient, resolveMediaUrl } from '../../api/client';
import {
  DataTableColumn,
  InteractiveDataTable,
  StatusBadge,
} from '../../components/custom/InteractiveDataTable';
import { LeaveAndCorrectionModal } from '../../components/custom/LeaveAndCorrectionModal';
import { PhotoLightboxModal } from '../../components/custom/PhotoLightboxModal';
import { useToast } from '../../context/ToastContext';
import { AttendanceRecord, AttendanceRequestRecord, StandardApiResponse } from '../../types';

// Feature: Personal Attendance History & Leave Log — Purpose: Displays the employee's personal WFH attendance history, photo proof inspection, and submitted leave/correction requests.
// OOP: Presentation Page Component (View Layer Composition) — Connected To: Fetches GET /api/attendances/my-history and GET /api/attendance-requests/my.
export const MyAttendanceHistoryPage: React.FC = () => {
  const { showToast } = useToast();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [requests, setRequests] = useState<AttendanceRequestRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [leaveModalOpen, setLeaveModalOpen] = useState<boolean>(false);

  // Feature: Personal Attendance History & Leave Log — Purpose: Loads both attendance history and leave/correction request history in parallel.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: AttendanceController.getMyHistory() and AttendanceController.getMyRequests().
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [attRes, reqRes] = await Promise.all([
        apiClient.get<StandardApiResponse<{ items?: AttendanceRecord[] } | AttendanceRecord[]>>(
          '/attendances/my-history',
          {
            // @ts-expect-error silent background load
            silentToast: true,
          },
        ),
        apiClient.get<StandardApiResponse<AttendanceRequestRecord[]>>('/attendance-requests/my', {
          // @ts-expect-error silent background load
          silentToast: true,
        }),
      ]);
      const rawAtt = attRes.data.data;
      setRecords(Array.isArray(rawAtt) ? rawAtt : rawAtt?.items || []);
      setRequests(Array.isArray(reqRes.data.data) ? reqRes.data.data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Feature: Personal Attendance History & Leave Log — Purpose: Formats ISO timestamps into HH:mm:ss WIB for table columns.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: Used in InteractiveDataTable column renderers.
  const formatWibTime = (iso: string | null) => {
    if (!iso) return '--:--';
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

  // Feature: Personal Attendance History & Leave Log — Purpose: Exports the employee's personal attendance records as a CSV file and triggers a green toast.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: Export .CSV button on InteractiveDataTable.
  const handleExportMyCsv = () => {
    const headers = ['Date', 'Status', 'Clock-In (WIB)', 'Clock-Out (WIB)', 'Duration (Mins)', 'Timestamp Verified', 'Daily Plan', 'Daily Accomplishment'];
    const rows = records.map((r) => [
      r.attendanceDate,
      r.status,
      formatWibTime(r.clockInTime),
      formatWibTime(r.clockOutTime),
      r.workDurationMinutes ?? 0,
      r.isTimestampVerified ? 'VERIFIED' : 'UNVERIFIED',
      `"${(r.dailyPlan || '').replace(/"/g, '""')}"`,
      `"${(r.dailyAccomplishment || '').replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((line) => line.join(','))].join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my_wfh_attendance_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast({
      type: 'success',
      where: 'Personal Attendance • CSV Export',
      what: `Exported ${records.length} personal attendance records`,
      why: 'Your personal WFH attendance log has been downloaded as a CSV spreadsheet.',
    });
  };

  const columns: DataTableColumn<AttendanceRecord>[] = [
    {
      key: 'attendanceDate',
      header: 'Date',
      sortable: true,
      sortValue: (r) => r.attendanceDate,
      render: (r) => <span className="font-sans text-xs font-medium tabular-nums text-slate-900 dark:text-slate-100">{r.attendanceDate}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (r) => r.status,
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'clockInTime',
      header: 'Clock-In / Out (WIB)',
      render: (r) => (
        <div className="font-sans text-xs font-medium tabular-nums space-y-0.5">
          <div>
            <span className="text-slate-400">IN:</span>{' '}
            <strong className="text-slate-800 dark:text-slate-200">{formatWibTime(r.clockInTime)}</strong>
          </div>
          <div>
            <span className="text-slate-400">OUT:</span>{' '}
            <strong className="text-slate-800 dark:text-slate-200">{formatWibTime(r.clockOutTime)}</strong>
          </div>
        </div>
      ),
    },
    {
      key: 'duration',
      header: 'Duration & Overtime',
      sortable: true,
      sortValue: (r) => r.workDurationMinutes ?? 0,
      render: (r) => (
        <div className="font-sans text-xs font-medium tabular-nums space-y-0.5">
          <div className="text-slate-800 dark:text-slate-200">
            {r.workDurationMinutes
              ? `${Math.floor(r.workDurationMinutes / 60)}h ${r.workDurationMinutes % 60}m`
              : '-'}
            {r.wfhApproved && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-semibold">
                WFH 1x/Wk
              </span>
            )}
          </div>
          {Number(r.overtimePayAmount ?? 0) > 0 && (
            <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              +{r.overtimeMinutes}m OT • Rp {Number(r.overtimePayAmount).toLocaleString('id-ID')}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'photo',
      header: 'Photo & Timestamp Proof',
      render: (r) => (
        <div className="flex items-center gap-2">
          {r.clockInPhotoUrl ? (
            <img
              src={resolveMediaUrl(r.clockInPhotoUrl)}
              alt="Proof"
              onClick={() => setSelectedRecord(r)}
              className="w-12 h-8 object-cover rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-80"
            />
          ) : (
            <div className="w-12 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
              <Camera className="w-3.5 h-3.5" />
            </div>
          )}
          {r.isTimestampVerified ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#D32F2F] dark:text-rose-400">
              <ShieldAlert className="w-3.5 h-3.5" />
              Unverified
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'workLog',
      header: 'Daily Plan & Accomplishment',
      render: (r) => (
        <div className="max-w-xs space-y-1 text-[11px]">
          <div className="truncate text-slate-700 dark:text-slate-300">
            <strong>Plan:</strong> {r.dailyPlan || '-'}
          </div>
          <div className="truncate text-slate-500 dark:text-slate-400">
            <strong>Done:</strong> {r.dailyAccomplishment || '-'}
          </div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'View',
      render: (r) => (
        <button
          type="button"
          onClick={() => setSelectedRecord(r)}
          className="taste-btn inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-semibold"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Proof</span>
        </button>
      ),
    },
  ];

  const onTimeCount = records.filter((r) => r.status === 'ON_TIME' || (r.status === 'COMPLETED' && r.lateMinutes === 0)).length;
  const lateCount = records.filter((r) => r.lateMinutes > 0).length;
  const leaveCount = records.filter((r) => r.status === 'ON_LEAVE' || r.status === 'SICK').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-sans text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
            My Attendance History &amp; Leave Requests
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            View your historical WFH photo proofs, working hours, and leave or time correction approvals
          </p>
        </div>

        <button
          type="button"
          onClick={() => setLeaveModalOpen(true)}
          className="taste-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0A2D62] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm"
        >
          <CalendarPlus className="w-4 h-4" />
          <span>New Leave / Correction Request</span>
        </button>
      </div>

      {/* Personal KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="taste-card p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Logged Days</div>
          <div className="font-sans text-2xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white mt-1">{records.length}</div>
        </div>
        <div className="taste-card p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 shadow-sm">
          <div className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">On-Time Sessions</div>
          <div className="font-sans text-2xl font-semibold tabular-nums tracking-tight text-emerald-800 dark:text-emerald-200 mt-1">{onTimeCount}</div>
        </div>
        <div className="taste-card p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 shadow-sm">
          <div className="text-xs text-[#D32F2F] dark:text-rose-300 font-medium">Late Arrivals</div>
          <div className="font-sans text-2xl font-semibold tabular-nums tracking-tight text-[#D32F2F] dark:text-rose-200 mt-1">{lateCount}</div>
        </div>
        <div className="taste-card p-4 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 shadow-sm">
          <div className="text-xs text-sky-700 dark:text-sky-300 font-medium">Leave / Sick Days</div>
          <div className="font-sans text-2xl font-semibold tabular-nums tracking-tight text-sky-800 dark:text-sky-200 mt-1">{leaveCount}</div>
        </div>
      </div>

      {/* Personal Attendance Table */}
      <InteractiveDataTable
        title="My WFH Attendance Log"
        subtitle="Click any photo thumbnail or Proof button to open the full timestamp verification modal"
        data={records}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="Search date, status, or daily notes..."
        searchKeys={[
          (r) => r.attendanceDate,
          (r) => r.status,
          (r) => r.dailyPlan || '',
          (r) => r.dailyAccomplishment || '',
        ]}
        onExportCsv={handleExportMyCsv}
        isLoading={loading}
      />

      {/* Submitted Leave / Sick / Correction Requests */}
      <div className="taste-card bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            My Leave, Sick &amp; Attendance Correction Requests ({requests.length})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Track HRD Admin approval status and review notes for your submitted requests
          </p>
        </div>

        {requests.length === 0 ? (
          <div className="text-xs text-slate-400 py-6 text-center">
            You have not submitted any leave or time correction requests yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {requests.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-900 dark:text-white font-sans tabular-nums">
                    {req.requestType} • Target Date: {req.targetDate}
                  </span>
                  <StatusBadge status={req.status} />
                </div>
                {req.requestType === 'CORRECTION' && (
                  <div className="font-sans tabular-nums text-[11px] text-blue-700 dark:text-blue-400">
                    Requested Window: {req.requestedClockIn || '--:--'} to {req.requestedClockOut || '--:--'} WIB
                  </div>
                )}
                <p className="text-slate-600 dark:text-slate-300">{req.reason}</p>
                {req.reviewNotes && (
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-300">
                    <strong>HRD Review Note:</strong> {req.reviewNotes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <PhotoLightboxModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
      {leaveModalOpen && (
        <LeaveAndCorrectionModal
        isOpen={leaveModalOpen}
        onClose={() => setLeaveModalOpen(false)}
        onSubmitted={() => void loadData()}
      />
      )}
    </div>
  );
};

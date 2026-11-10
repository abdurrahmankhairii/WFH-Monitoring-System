// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  MapPin,
  Filter,
  RotateCcw,
  Settings2,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { apiClient, resolveMediaUrl } from '../../api/client';
import { CompanyPolicyModal } from '../../components/custom/CompanyPolicyModal';
import {
  DataTableColumn,
  InteractiveDataTable,
  StatusBadge,
} from '../../components/custom/InteractiveDataTable';
import { PhotoLightboxModal } from '../../components/custom/PhotoLightboxModal';
import { AttendanceLocationMapModal } from '../../components/custom/AttendanceLocationMapModal';
import { useToast } from '../../context/ToastContext';
import {
  AttendanceRecord,
  AttendanceRequestRecord,
  StandardApiResponse,
} from '../../types';

// Feature: HRD Attendance Audit & Payroll Export — Purpose: Comprehensive HRD attendance monitoring, multi-criteria filtering, photo proof inspection, leave approval, and Excel/CSV/PDF export.
// OOP: Presentation Page Component (View Layer Composition) — Connected To: Calls GET /api/attendances, GET /api/attendances/export, GET /api/attendance-requests, and PATCH /api/attendance-requests/:id/review.
export const AttendanceMonitoringPage: React.FC = () => {
  const { showToast, notifyApiResponse } = useToast();

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [requests, setRequests] = useState<AttendanceRequestRecord[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [department, setDepartment] = useState<string>('ALL');
  const [status, setStatus] = useState<string>('ALL');
  const [isTimestampVerified, setIsTimestampVerified] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [mapRecord, setMapRecord] = useState<AttendanceRecord | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [policyModalOpen, setPolicyModalOpen] = useState<boolean>(false);

  // Feature: HRD Attendance Audit & Payroll Export — Purpose: Builds query string parameters from the active filter controls.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: Used by fetchRecords() and handleDownloadExport().
  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set('limit', '100');
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (department && department !== 'ALL') params.set('department', department);
    if (status && status !== 'ALL') params.set('status', status);
    if (isTimestampVerified && isTimestampVerified !== 'ALL') {
      params.set('isTimestampVerified', isTimestampVerified);
    }
    if (search.trim()) params.set('search', search.trim());
    return params.toString();
  }, [startDate, endDate, department, status, isTimestampVerified, search]);

  // Feature: HRD Attendance Audit & Payroll Export — Purpose: Loads filtered attendance records, leave/correction requests, and distinct departments.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: GET /api/attendances, GET /api/attendance-requests, GET /api/employees/departments.
  const loadAll = useCallback(
    async (notifyFilter = false) => {
      setLoading(true);
      try {
        const query = buildQueryParams();
        const [attRes, reqRes, deptRes] = await Promise.all([
          apiClient.get<StandardApiResponse<AttendanceRecord[]>>(`/attendances?${query}`, {
            // @ts-expect-error silent background load
            silentToast: true,
          }),
          apiClient.get<StandardApiResponse<AttendanceRequestRecord[]>>('/attendance-requests', {
            // @ts-expect-error silent background load
            silentToast: true,
          }),
          apiClient.get<StandardApiResponse<string[]>>('/employees/departments', {
            // @ts-expect-error silent background load
            silentToast: true,
          }),
        ]);

        const list = attRes.data.data || [];
        setRecords(list);
        setRequests(reqRes.data.data || []);
        setDepartments(deptRes.data.data || []);

        if (notifyFilter) {
          showToast({
            type: 'info',
            where: 'Attendance Monitoring • Filter',
            what: `Matched ${list.length} attendance record(s)`,
            why: `Applied filters: Date=${startDate || 'Any'}..${endDate || 'Any'}, Dept=${department}, Status=${status}.`,
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [buildQueryParams, department, endDate, showToast, startDate, status],
  );

  useEffect(() => {
    void loadAll(false);
  }, [loadAll]);

  // Feature: HRD Attendance Audit & Payroll Export — Purpose: Downloads payroll-ready .xlsx or .csv export stream from GET /api/attendances/export and triggers a green toast.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: AttendanceController.exportAttendances() on api-gateway.
  const handleDownloadExport = async (format: 'xlsx' | 'csv') => {
    const query = buildQueryParams();
    const res = await apiClient.get(`/attendances/export?format=${format}&${query}`, {
      responseType: 'blob',
    });

    const blob = new Blob([res.data], {
      type:
        format === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dexa_wfh_attendance_report_${new Date().toISOString().slice(0, 10)}.${format}`;
    a.click();
    URL.revokeObjectURL(url);

    showToast({
      type: 'success',
      where: `Attendance Monitoring • ${format.toUpperCase()} Export`,
      what: `Downloaded ${records.length} records as .${format.toUpperCase()}`,
      why: `Payroll-ready ${format.toUpperCase()} report generated with server timestamps, work durations, and photo verification flags.`,
    });
  };

  // Feature: HRD Attendance Audit & Payroll Export — Purpose: Opens browser print/PDF dialog and triggers an informational toast.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: Print / PDF button on InteractiveDataTable.
  const handlePrintPdf = () => {
    showToast({
      type: 'info',
      where: 'Attendance Monitoring • Print / PDF',
      what: 'Opened printable PDF report view',
      why: 'Select Save as PDF in the print dialog to archive the official HRD attendance audit report.',
    });
    window.setTimeout(() => {
      window.print();
    }, 250);
  };

  // Feature: HRD Attendance Audit & Payroll Export — Purpose: Approves or rejects an employee's WFH, Overtime, Leave, Sick, or Time Correction request and syncs the attendance table.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: PATCH /api/attendance-requests/:id/review.
  const handleReviewRequest = async (reqId: string, decision: 'APPROVED' | 'REJECTED') => {
    setReviewingId(reqId);
    try {
      const res = await apiClient.patch<StandardApiResponse<AttendanceRequestRecord>>(
        `/attendance-requests/${reqId}/review`,
        {
          decision,
          reviewNotes:
            decision === 'APPROVED'
              ? 'Approved by HRD Admin and synchronized with attendance & payroll log.'
              : 'Declined by HRD Admin — insufficient supporting documentation.',
        },
      );
      notifyApiResponse(res.data);
      void loadAll(false);
    } finally {
      setReviewingId(null);
    }
  };

  // Feature: HRD Attendance Audit & Payroll Export — Purpose: Formats ISO timestamps into HH:mm:ss WIB for table columns.
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

  const columns: DataTableColumn<AttendanceRecord>[] = [
    {
      key: 'attendanceDate',
      header: 'Date',
      sortable: true,
      sortValue: (r) => r.attendanceDate,
      render: (r) => <span className="font-sans text-xs font-medium tabular-nums text-slate-900 dark:text-slate-100">{r.attendanceDate}</span>,
    },
    {
      key: 'employee',
      header: 'Employee (NIP & Dept)',
      sortable: true,
      sortValue: (r) => r.employee?.fullName || '',
      render: (r) => (
        <div>
          <div className="font-semibold text-slate-900 dark:text-slate-100">{r.employee?.fullName || 'Unknown'}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-mono text-[11px] font-medium text-slate-500 dark:text-slate-400">{r.employee?.employeeCode}</span> •{' '}
            {r.employee?.department}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (r) => r.status,
      render: (r) => (
        <div className="space-y-0.5">
          <StatusBadge status={r.status} />
          {r.lateMinutes > 0 && (
            <div className="text-[10px] font-semibold font-sans tabular-nums text-[#D32F2F] dark:text-rose-400">
              +{r.lateMinutes}m late
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'times',
      header: 'Server Clock-In / Out',
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
      header: 'Net Hours & Overtime Pay',
      sortable: true,
      sortValue: (r) => r.workDurationMinutes ?? 0,
      render: (r) => (
        <div className="space-y-0.5 font-sans tabular-nums">
          <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
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
      key: 'photoProof',
      header: 'Photo & Timestamp Audit',
      render: (r) => (
        <div className="flex items-center gap-2.5">
          {r.clockInPhotoUrl ? (
            <img
              src={resolveMediaUrl(r.clockInPhotoUrl)}
              alt="Proof"
              onClick={() => setSelectedRecord(r)}
              className="w-12 h-8 object-cover rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-80"
            />
          ) : (
            <span className="text-[11px] text-slate-400">No photo</span>
          )}
          <div>
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
            <div className="text-[10px] font-sans text-slate-400">{r.photoCaptureSource || '-'}</div>
            {r.locationStatus === 'IN_HOME_RADIUS' ? (
              <button
                type="button"
                onClick={() => setMapRecord(r)}
                className="text-[10px] font-sans font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums hover:underline flex items-center gap-1 cursor-pointer"
                title="Click to view interactive map"
              >
                <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>In Radius ({r.distanceFromHomeMeters ?? 0}m)</span>
              </button>
            ) : r.locationStatus === 'OUT_OF_HOME_RADIUS' ? (
              <button
                type="button"
                onClick={() => setMapRecord(r)}
                className="text-[10px] font-sans font-semibold text-rose-600 dark:text-rose-400 tabular-nums hover:underline flex items-center gap-1 cursor-pointer"
                title="Click to view interactive map"
              >
                <MapPin className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                <span>Out Radius ({r.distanceFromHomeMeters ?? 0}m)</span>
              </button>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: 'workNotes',
      header: 'Daily Plan & Accomplishment',
      render: (r) => (
        <div className="max-w-xs text-[11px] space-y-0.5">
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
      key: 'inspect',
      header: 'Audit & Map',
      className: 'no-print',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedRecord(r)}
            title="Inspect watermarked photo proof and timestamp metadata"
            className="taste-btn inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0A2D62] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Photo</span>
          </button>
          <button
            type="button"
            onClick={() => setMapRecord(r)}
            title="Inspect GPS location, geofence radius, and address on map"
            className={`taste-btn inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm border transition-colors ${
              r.locationStatus === 'OUT_OF_HOME_RADIUS'
                ? 'bg-rose-50 hover:bg-rose-100 text-[#D32F2F] dark:bg-rose-950/50 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                : r.locationStatus === 'IN_HOME_RADIUS'
                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Map</span>
          </button>
        </div>
      ),
    },
  ];

  const pendingRequests = requests.filter((r) => r.status === 'PENDING');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-sans text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
            Attendance Monitoring, Photo Audit &amp; Payroll Export
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Filter workforce attendance records, inspect watermarked photo proofs, approve leave or time corrections, and export payroll reports
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPolicyModalOpen(true)}
          className="taste-btn inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A2D62] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm shrink-0"
        >
          <Settings2 className="w-4 h-4" />
          <span>Configure Company Policy</span>
        </button>
      </div>

      {/* Multi-Criteria Filter Bar */}
      <div className="no-print taste-card bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <Filter className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Attendance Audit Filters</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setDepartment('ALL');
              setStatus('ALL');
              setIsTimestampVerified('ALL');
              setSearch('');
              showToast({
                type: 'info',
                where: 'Attendance Monitoring • Filter Reset',
                what: 'Cleared all attendance filter criteria',
                why: 'Restored full view of all employee WFH attendance records.',
              });
            }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-sans tabular-nums"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-sans tabular-nums"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Attendance Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900"
            >
              <option value="ALL">All Statuses</option>
              <option value="ON_TIME">ON_TIME</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="LATE">LATE</option>
              <option value="HALF_DAY">HALF_DAY</option>
              <option value="ON_LEAVE">ON_LEAVE</option>
              <option value="SICK">SICK</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Photo Timestamp Audit
            </label>
            <div className="flex items-center gap-2">
              <select
                value={isTimestampVerified}
                onChange={(e) => setIsTimestampVerified(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900"
              >
                <option value="ALL">All Photos</option>
                <option value="true">Verified Timestamp Only</option>
                <option value="false">Unverified / Flagged Only</option>
              </select>
              <button
                type="button"
                onClick={() => void loadAll(true)}
                className="taste-btn px-3.5 py-2 rounded-xl bg-[#0A2D62] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shrink-0"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Attendance DataTable with Excel / CSV / PDF Export */}
      <InteractiveDataTable
        title={`Employee WFH Attendance Records (${records.length})`}
        subtitle="Click any photo thumbnail or Inspect button to view side-by-side Clock-In and Clock-Out photos and server timestamps"
        data={records}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="Search employee name, NIP, department, or daily task..."
        externalSearchTerm={search}
        onSearchChange={setSearch}
        onExportExcel={() => void handleDownloadExport('xlsx')}
        onExportCsv={() => void handleDownloadExport('csv')}
        onPrintPdf={handlePrintPdf}
        isLoading={loading}
      />

      {/* Hybrid WFH, Overtime, Leave & Correction Approval Queue */}
      <div className="no-print taste-card bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Hybrid WFH (1x/Week), Overtime Pay, Leave &amp; Correction Approval Queue ({requests.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Approving a request automatically syncs the corresponding attendance and payroll overtime record
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-xs font-semibold font-sans tabular-nums">
            {pendingRequests.length} Pending Approval
          </span>
        </div>

        {requests.length === 0 ? (
          <div className="text-xs text-slate-400 py-6 text-center">No attendance requests submitted.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {requests.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col justify-between gap-3 text-xs"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white">{req.employee?.fullName}</span>{' '}
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        ({req.employee?.employeeCode})
                      </span>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>
                  <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 font-sans tabular-nums">
                    Type:{' '}
                    <span className="text-blue-700 dark:text-blue-400 font-semibold">
                      {req.requestType.replace('_', ' ')}
                    </span>{' '}
                    • Target Date: <strong>{req.targetDate}</strong>
                    {req.requestType === 'CORRECTION' &&
                      ` • Requested: ${req.requestedClockIn || '--:--'} to ${req.requestedClockOut || '--:--'} WIB`}
                    {req.requestType === 'OVERTIME' && req.overtimeMinutes
                      ? ` • ${req.overtimeMinutes}m Overtime (Rp ${Number(req.estimatedOvertimePay ?? 0).toLocaleString('id-ID')})`
                      : ''}
                  </div>
                  {req.managerEmail && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Manager Route: <strong className="text-slate-700 dark:text-slate-200">{req.managerEmail}</strong>
                      {req.ccEmails ? ` • CC: ${req.ccEmails}` : ''}
                    </div>
                  )}
                  <p className="text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
                    {req.reason}
                  </p>
                </div>

                {req.status === 'PENDING' ? (
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={reviewingId === req.id}
                      onClick={() => void handleReviewRequest(req.id, 'REJECTED')}
                      className="taste-btn inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-[#D32F2F] dark:text-rose-300 font-semibold"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                    <button
                      type="button"
                      disabled={reviewingId === req.id}
                      onClick={() => void handleReviewRequest(req.id, 'APPROVED')}
                      className="taste-btn inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve &amp; Sync Attendance</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Review Note: {req.reviewNotes || 'Processed by HRD'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <PhotoLightboxModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
      <AttendanceLocationMapModal
        isOpen={Boolean(mapRecord)}
        record={mapRecord}
        onClose={() => setMapRecord(null)}
      />
      <CompanyPolicyModal
        isOpen={policyModalOpen}
        onClose={() => setPolicyModalOpen(false)}
        onSaved={() => void loadAll(true)}
      />
    </div>
  );
};

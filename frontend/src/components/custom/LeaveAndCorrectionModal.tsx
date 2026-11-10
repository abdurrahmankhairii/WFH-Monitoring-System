// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarPlus, CheckCircle2, Clock, Eye, Mail, Paperclip, Send, ShieldCheck, X } from 'lucide-react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  AttendanceRequestRecord,
  AttendanceRequestType,
  DepartmentRecord,
  StandardApiResponse,
  WfhWorkflowMode,
} from '../../types';

interface LeaveAndCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  initialRequestType?: AttendanceRequestType;
  wfhWorkflowMode?: WfhWorkflowMode;
  enableOvertime?: boolean;
}

const REQUEST_TYPE_OPTIONS: Array<{ type: AttendanceRequestType; label: string; shortDesc: string }> = [
  { type: 'WFH_APPROVAL', label: 'WFH Approval (1x/Wk)', shortDesc: 'Hybrid WFH quota (Max 1 Day/Week)' },
  { type: 'OVERTIME', label: 'Overtime (Lembur)', shortDesc: 'PP 35/2021 rate (1.5x / 2.0x)' },
  { type: 'CORRECTION', label: 'Time Correction', shortDesc: 'Clock-In / Out adjustment' },
  { type: 'LEAVE', label: 'Annual Leave', shortDesc: 'Paid personal / annual leave' },
  { type: 'SICK', label: 'Sick Leave', shortDesc: 'Medical leave with note' },
];

// Feature: Hybrid WFH Approval, Overtime & Leave Modal — Purpose: 2-step self-service modal with interactive Email Overview Preview routed to Department Manager & HRD.
// OOP: Reusable UI Component (Encapsulated View & State) — Connected To: Submits multipart/form-data to POST /api/attendance-requests -> attendance-service.
export const LeaveAndCorrectionModal: React.FC<LeaveAndCorrectionModalProps> = ({
  isOpen,
  onClose,
  onSubmitted,
  initialRequestType,
  wfhWorkflowMode,
  enableOvertime = true,
}) => {
  const { user } = useAuth();
  const { notifyApiResponse, showToast } = useToast();
  const [step, setStep] = useState<'FORM' | 'EMAIL_PREVIEW'>('FORM');
  const [requestType, setRequestType] = useState<AttendanceRequestType>(initialRequestType ?? 'WFH_APPROVAL');
  const [targetDate, setTargetDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [requestedClockIn, setRequestedClockIn] = useState<string>('08:25');
  const [requestedClockOut, setRequestedClockOut] = useState<string>('17:30');
  const [overtimeMinutes, setOvertimeMinutes] = useState<number>(120);
  const [reason, setReason] = useState<string>('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (initialRequestType) {
      setRequestType(initialRequestType);
    }
  }, [initialRequestType, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setStep('FORM');
      return;
    }
    apiClient
      .get<StandardApiResponse<DepartmentRecord[]>>('/employees/department-directory')
      .then((res) => {
        if (res.data.data) setDepartments(res.data.data);
      })
      .catch(() => undefined);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const deptInfo = useMemo(() => {
    const matched = departments.find((d) => d.name === user?.department);
    const isManagerOrAdmin = user?.role === 'MANAGER' || user?.role === 'SYSTEM_ADMIN';
    return {
      departmentName: user?.department ?? matched?.name ?? 'IT & Digital Innovation',
      managerName: isManagerOrAdmin
        ? 'Dr. Rina Kusuma, M.Psi (Head of HRD)'
        : (matched?.managerName ?? user?.managerName ?? 'Ir. Hendra Wijaya, M.Kom'),
      managerEmail: isManagerOrAdmin
        ? 'admin.hrd@dexagroup.com'
        : (matched?.managerEmail ?? user?.managerEmail ?? 'manager.it@dexagroup.com'),
      hrPicEmail: isManagerOrAdmin ? 'sysadmin@dexagroup.com' : (matched?.hrPicEmail ?? user?.hrPicEmail ?? 'admin.hrd@dexagroup.com'),
      maxWfhDaysPerWeek: matched?.maxWfhDaysPerWeek ?? user?.maxWfhDaysPerWeek ?? 1,
      isManagerOrAdmin,
    };
  }, [departments, user]);

  const overtimePreview = useMemo(() => {
    const baseSalary = Number(user?.baseSalary ?? 16500000);
    const hourlyRate = Math.round(baseSalary / 173);
    const hours = Math.max(0.5, overtimeMinutes / 60);
    const firstHourMult = Math.min(1, hours) * 1.5;
    const nextHoursMult = Math.max(0, hours - 1) * 2.0;
    const multiplierHours = Math.round((firstHourMult + nextHoursMult) * 100) / 100;
    const estimatedPay = Math.round(hourlyRate * multiplierHours);
    return { baseSalary, hourlyRate, hours, multiplierHours, estimatedPay };
  }, [overtimeMinutes, user?.baseSalary]);

  const isNoticeOnlyWfh = requestType === 'WFH_APPROVAL' && wfhWorkflowMode === 'NOTICE_ONLY';

  const availableOptions = useMemo(() => {
    return REQUEST_TYPE_OPTIONS.filter((opt) => {
      if (opt.type === 'OVERTIME' && !enableOvertime) return false;
      return true;
    }).map((opt) => {
      if (opt.type === 'WFH_APPROVAL' && wfhWorkflowMode === 'NOTICE_ONLY') {
        return {
          ...opt,
          label: 'WFH Notice (1x/Wk)',
          shortDesc: 'Notify Manager & Unlock Clock-In',
        };
      }
      return opt;
    });
  }, [wfhWorkflowMode, enableOvertime]);

  if (!isOpen) return null;

  // Feature: Step 1 Validation & Email Preview Transition — Purpose: Validates form fields before transitioning to Step 2 (Email Overview Confirmation).
  // OOP: Event Handler Method — Connected To: Form submission in Step 1.
  const handleProceedToEmailPreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 10) {
      showToast({
        type: 'error',
        where: 'Attendance Request - Validation',
        what: 'Reason must be at least 10 characters',
        why: 'Please provide a clear deliverable plan or explanation for Manager & HRD review.',
      });
      return;
    }
    setStep('EMAIL_PREVIEW');
  };

  // Feature: Final Email Dispatch & Request Submission — Purpose: Sends multipart payload to POST /api/attendance-requests which emails Manager & HRD and saves the request.
  // OOP: Async Submission Handler — Connected To: POST /api/attendance-requests -> AttendanceRequestsService.create().
  const handleConfirmSendAndSubmit = async () => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('requestType', requestType);
      formData.append('targetDate', targetDate);
      if (requestType === 'CORRECTION') {
        if (requestedClockIn) formData.append('requestedClockIn', requestedClockIn);
        if (requestedClockOut) formData.append('requestedClockOut', requestedClockOut);
      }
      if (requestType === 'OVERTIME') {
        formData.append('overtimeMinutes', String(overtimeMinutes));
      }
      formData.append('reason', reason.trim());
      if (attachment) {
        formData.append('attachment', attachment);
      }

      const res = await apiClient.post<StandardApiResponse<AttendanceRequestRecord>>(
        '/attendance-requests',
        formData,
      );
      notifyApiResponse(res.data);
      setReason('');
      setAttachment(null);
      setStep('FORM');
      onSubmitted();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };


  const activeOption = availableOptions.find((o) => o.type === requestType) ?? availableOptions[0];
  const emailSubject = isNoticeOnlyWfh
    ? `[WFH Notice] Notification: ${user?.fullName ?? 'Employee'} is Working From Home Today (${targetDate})`
    : `Dexa Group ${requestType.replace('_', ' ')} Request — ${user?.fullName ?? 'Employee'} (${user?.employeeCode ?? 'NIP'}) for ${targetDate}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="WFH Approval, Overtime, Leave and Attendance Correction Request"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700/80 my-auto">
        <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#0A2D62] dark:text-blue-400 flex items-center justify-center border border-blue-200/70 dark:border-blue-800/60">
              {step === 'FORM' ? <CalendarPlus className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {step === 'FORM'
                    ? isNoticeOnlyWfh
                      ? 'WFH Notification to Manager & HRD'
                      : 'WFH Approval, Overtime & Leave Request'
                    : isNoticeOnlyWfh
                      ? 'Overview WFH Notice Email Before Dispatch'
                      : 'Overview Approval Email Before Dispatch'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Step {step === 'FORM' ? '1' : '2'} of 2
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {step === 'FORM'
                  ? isNoticeOnlyWfh
                    ? `Under Notice-Only policy, sending this notice directly unlocks Clock-In for today`
                    : `Routed to ${deptInfo.managerName} (${deptInfo.managerEmail}) & HRD (${deptInfo.hrPicEmail})`
                  : isNoticeOnlyWfh
                    ? 'Verify notification recipients and daily deliverables before sending via SMTP'
                    : 'Verify email recipients and request summary before sending via SMTP'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === 'FORM' ? (
          <form onSubmit={handleProceedToEmailPreview} className="p-5 sm:p-6 space-y-4">
            {/* Request Type Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Select Request Category *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {availableOptions.map((opt) => (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setRequestType(opt.type)}
                    className={`py-2.5 px-2.5 rounded-xl text-xs font-semibold border transition-all text-center ${
                      requestType === opt.type
                        ? 'bg-[#0A2D62] dark:bg-blue-600 text-white border-[#0A2D62] dark:border-blue-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Department Manager Routing Banner */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="space-y-0.5">
                <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>
                    Approval Route: {deptInfo.departmentName} Manager ({deptInfo.managerEmail})
                  </span>
                </div>
                <div className="text-slate-500 dark:text-slate-400">
                  CC: HRD Admin ({deptInfo.hrPicEmail}) &amp; {user?.email}
                </div>
              </div>
              {requestType === 'WFH_APPROVAL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-100/80 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800 shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Max {deptInfo.maxWfhDaysPerWeek} Day / Week Quota
                </span>
              )}
            </div>

            {/* Target Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Target Date *
                </label>
                <input
                  type="date"
                  required
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-sans tabular-nums focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div className="flex flex-col justify-end">
                <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{activeOption.label}:</span>{' '}
                  {activeOption.shortDesc}
                </div>
              </div>
            </div>

            {/* Conditional: Overtime Duration & Live Payroll Rate Calculator */}
            {requestType === 'OVERTIME' && (
              <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200/80 dark:border-emerald-800/60 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Overtime Duration &amp; Automated Payroll Calculation (PP No. 35/2021)
                    </div>
                    <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
                      Formula: Base Hourly = Base Salary / 173 • 1.5x first hour + 2.0x subsequent hours
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400">Estimated Overtime Pay</div>
                    <div className="text-base font-bold tabular-nums text-emerald-800 dark:text-emerald-300">
                      Rp {overtimePreview.estimatedPay.toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[60, 90, 120, 180, 240].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setOvertimeMinutes(mins)}
                      className={`py-2 px-2.5 rounded-lg text-xs font-semibold border tabular-nums transition-all ${
                        overtimeMinutes === mins
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {mins}m ({mins / 60}h)
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] text-slate-600 dark:text-slate-300 border-t border-emerald-200/60 dark:border-emerald-800/50">
                  <div>
                    Base Hourly (1/173):{' '}
                    <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      Rp {overtimePreview.hourlyRate.toLocaleString('id-ID')}/hr
                    </span>
                  </div>
                  <div>
                    Multiplier Tier:{' '}
                    <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {overtimePreview.multiplierHours}x hrs
                    </span>
                  </div>
                  <div>
                    Duration:{' '}
                    <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {overtimeMinutes} mins ({overtimePreview.hours.toFixed(1)}h)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Conditional: Time Correction */}
            {requestType === 'CORRECTION' && (
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/50">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Requested Clock-In (WIB)
                  </label>
                  <input
                    type="time"
                    value={requestedClockIn}
                    onChange={(e) => setRequestedClockIn(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-sans tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Requested Clock-Out (WIB)
                  </label>
                  <input
                    type="time"
                    value={requestedClockOut}
                    onChange={(e) => setRequestedClockOut(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-sans tabular-nums"
                  />
                </div>
              </div>
            )}

            {/* Deliverables / Reason */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {requestType === 'WFH_APPROVAL'
                  ? 'Planned WFH Deliverables & Reason (min. 10 chars) *'
                  : requestType === 'OVERTIME'
                    ? 'Overtime Task Deliverables & Justification (min. 10 chars) *'
                    : 'Detailed Reason / Explanation (min. 10 chars) *'}
              </label>
              <textarea
                required
                minLength={10}
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  requestType === 'WFH_APPROVAL'
                    ? 'Outline your planned WFH deliverables for this week (1 Day/Week hybrid WFH policy)...'
                    : requestType === 'OVERTIME'
                      ? 'Describe the urgent sprint deployment, audit report, or production task requiring overtime...'
                      : requestType === 'CORRECTION'
                        ? 'Describe the technical issue (e.g., power or fiber outage during clock-in window)...'
                        : requestType === 'SICK'
                          ? 'Describe medical condition and attach medical note below...'
                          : 'Specify leave reason and task handover contact...'
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            {/* Optional Attachment */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Supporting Proof Attachment (Optional)
              </label>
              <label className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-xs text-slate-600 dark:text-slate-300">
                <Paperclip className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="truncate">
                  {attachment ? attachment.name : 'Choose image or document file (max 8 MB)...'}
                </span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800">
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                {isNoticeOnlyWfh
                  ? 'Next: Review formatted notice email to Manager & HRD'
                  : 'Next: Review formatted email to Manager & HRD'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="taste-btn inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0A2D62] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{isNoticeOnlyWfh ? 'Review WFH Notice Email' : 'Review Approval Email'}</span>
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* STEP 2: Interactive Email Overview Preview */
          <div className="p-5 sm:p-6 space-y-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50/70 dark:bg-slate-800/40">
              <div className="px-4 py-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    {isNoticeOnlyWfh ? 'SMTP WFH Notice Email Dispatch Preview' : 'SMTP Approval Email Dispatch Preview'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[11px] font-semibold">
                    {isNoticeOnlyWfh ? 'Direct Clock-In Unlock' : 'Ready to Send'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1 text-slate-600 dark:text-slate-300">
                  <div>
                    <span className="text-slate-400">From:</span>{' '}
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {user?.fullName} &lt;{user?.email}&gt;
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">To (Manager):</span>{' '}
                    <span className="font-semibold text-blue-700 dark:text-blue-300">
                      {deptInfo.managerName} &lt;{deptInfo.managerEmail}&gt;
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400">CC (HRD &amp; Employee):</span>{' '}
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {deptInfo.hrPicEmail}, {user?.email}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400">Subject:</span>{' '}
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{emailSubject}</span>
                  </div>
                </div>
              </div>

              {/* Email Body Content Preview */}
              <div className="p-4 space-y-3 text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900">
                <p>
                  Dear <strong>{deptInfo.managerName}</strong> ({deptInfo.departmentName}) &amp; HRD Operations,
                </p>
                <p className="leading-relaxed">
                  <strong>{user?.fullName}</strong> ({user?.employeeCode ?? 'Employee'} — {user?.position}) has{' '}
                  {isNoticeOnlyWfh ? (
                    <>
                      dispatched a <strong>{activeOption.label}</strong> for{' '}
                      <strong className="tabular-nums">{targetDate}</strong> notifying Manager &amp; HRD to unlock today&apos;s WFH Clock-In:
                    </>
                  ) : (
                    <>
                      submitted a <strong>{activeOption.label}</strong> request for{' '}
                      <strong className="tabular-nums">{targetDate}</strong> requiring Manager &amp; HRD review:
                    </>
                  )}
                </p>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div>
                    <span className="text-slate-500">Request Category:</span>{' '}
                    <strong className="text-slate-900 dark:text-slate-100">{activeOption.label}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Target Date:</span>{' '}
                    <strong className="tabular-nums text-slate-900 dark:text-slate-100">{targetDate}</strong>
                  </div>
                  {requestType === 'WFH_APPROVAL' && (
                    <div>
                      <span className="text-slate-500">Hybrid WFH Policy:</span>{' '}
                      <strong className="text-blue-700 dark:text-blue-300">
                        Max {deptInfo.maxWfhDaysPerWeek} Day / Week Quota ({deptInfo.departmentName}) • {isNoticeOnlyWfh ? 'Notice Mode' : 'Approval Mode'}
                      </strong>
                    </div>
                  )}
                  {requestType === 'OVERTIME' && (
                    <div>
                      <span className="text-slate-500">Overtime Payroll Calculation:</span>{' '}
                      <strong className="text-emerald-700 dark:text-emerald-300 tabular-nums">
                        {overtimeMinutes} mins ({overtimePreview.multiplierHours}x multiplier hrs) = Rp{' '}
                        {overtimePreview.estimatedPay.toLocaleString('id-ID')}
                      </strong>
                    </div>
                  )}
                  {requestType === 'CORRECTION' && (
                    <div>
                      <span className="text-slate-500">Requested Timestamps:</span>{' '}
                      <strong className="tabular-nums text-slate-900 dark:text-slate-100">
                        Clock-In {requestedClockIn} WIB • Clock-Out {requestedClockOut} WIB
                      </strong>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500">Deliverables / Justification:</span>
                    <p className="mt-1 text-slate-800 dark:text-slate-200 whitespace-pre-line font-medium">
                      {reason}
                    </p>
                  </div>
                  {attachment && (
                    <div>
                      <span className="text-slate-500">Attachment:</span>{' '}
                      <strong className="text-slate-900 dark:text-slate-100">{attachment.name}</strong>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {isNoticeOnlyWfh
                      ? 'Clicking "Send WFH Notice & Unlock Clock-In" dispatches this notification via SMTP to your Manager & HRD, and unlocks your Clock-In immediately.'
                      : 'Clicking "Send Email & Submit Request" dispatches this email via SMTP and logs the request in the HRD Approval Queue.'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep('FORM')}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Edit</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmSendAndSubmit}
                disabled={submitting}
                className="taste-btn inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0A2D62] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {submitting
                    ? isNoticeOnlyWfh
                      ? 'Sending Notice & Unlocking Clock-In...'
                      : 'Sending Email & Submitting...'
                    : isNoticeOnlyWfh
                      ? 'Send WFH Notice & Unlock Clock-In'
                      : 'Send Email & Submit Request'}
                </span>
              </button>
            </div>
          </div>
        )}

        <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200/70 dark:border-slate-800 text-[10px] text-center text-slate-400">
          © 2026 Abdurrahman Khairi - Created strictly for Technical Assessment evaluation. Unauthorized commercial use is prohibited
        </div>
      </div>
    </div>
  );
};

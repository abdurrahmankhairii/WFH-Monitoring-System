// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Filter,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ApprovalStatus, AttendanceRequestRecord, AttendanceRequestType, StandardApiResponse } from '../../types';

// Feature: Manager WFH & Leave Approvals — Purpose: Displays department approval queue with direct deep-link handling and instant modal review.
// OOP: View Component (Stateful Presentation Layer) — Connected To: GET /api/attendance-requests & PATCH /api/attendance-requests/:id/review.
export const ManagerApprovalsPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [requests, setRequests] = useState<AttendanceRequestRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | ApprovalStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | AttendanceRequestType>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<'ALL' | string>('ALL');

  const uniqueDepartments = useMemo(() => {
    const set = new Set<string>();
    requests.forEach((r) => {
      if (r.employee?.department) set.add(r.employee.department);
    });
    return Array.from(set).sort();
  }, [requests]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [selectedRequest, setSelectedRequest] = useState<AttendanceRequestRecord | null>(null);
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Feature: Request Fetching — Purpose: Loads attendance requests scoped to the manager's department from the API Gateway.
  // OOP: Data Synchronization Method — Connected To: GET /api/attendance-requests.
  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<StandardApiResponse<AttendanceRequestRecord[]>>('/attendance-requests', {
        params: { limit: 100 },
      });
      if (res.data?.data) {
        setRequests(res.data.data);
      }
    } catch {
      // Toast handled by API interceptor
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  // Feature: Deep Link Auto-Selection — Purpose: Automatically opens the review modal when `?requestId=xxx` is present in the URL.
  // OOP: Deep Linking Handler — Connected To: Transactional Email CTA button [Review & Approve in System Portal].
  useEffect(() => {
    const requestedId = searchParams.get('requestId');
    if (requestedId && requests.length > 0) {
      const target = requests.find((r) => r.id === requestedId);
      if (target) {
        setSelectedRequest(target);
        setReviewNotes(target.reviewNotes || '');
      }
    }
  }, [searchParams, requests]);

  // Feature: Filtered Request List — Purpose: Computes dynamic multi-criteria filtered requests for search, status, and type.
  // OOP: Memoized Computation — Connected To: Local reactive state (requests, statusFilter, typeFilter, searchQuery).
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (statusFilter !== 'ALL' && req.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && req.requestType !== typeFilter) return false;
      if (isAdmin && departmentFilter !== 'ALL' && req.employee?.department !== departmentFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const empName = req.employee?.fullName?.toLowerCase() || '';
        const empNip = req.employee?.employeeCode?.toLowerCase() || '';
        const reason = req.reason?.toLowerCase() || '';
        if (!empName.includes(query) && !empNip.includes(query) && !reason.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [requests, statusFilter, typeFilter, searchQuery]);

  // Feature: Request Review Submission — Purpose: Submits manager decision (APPROVED / REJECTED) with optional review notes.
  // OOP: Mutation Handler — Connected To: PATCH /api/attendance-requests/:id/review.
  const handleReview = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!selectedRequest) return;
    if (decision === 'REJECTED' && !reviewNotes.trim()) {
      showToast({
        type: 'error',
        where: 'Manager Approvals - Review Submission',
        what: 'Rejection reason is required',
        why: 'Please provide a clear reason in the review notes so the employee understands why the request was not approved.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.patch<StandardApiResponse<{ request: AttendanceRequestRecord }>>(
        `/attendance-requests/${selectedRequest.id}/review`,
        {
          decision,
          reviewNotes: reviewNotes.trim() || undefined,
        },
      );

      const empName = selectedRequest.employee?.fullName || 'Employee';
      const actionText = decision === 'APPROVED' ? 'Approved' : 'Rejected';

      showToast({
        type: 'success',
        where: 'Manager Approvals - Review Action',
        what: `${actionText} request for ${empName}`,
        why: res.data?.why || `The attendance request for ${selectedRequest.targetDate} has been ${decision.toLowerCase()}.`,
      });

      // Clear search param if deep link was used
      if (searchParams.get('requestId')) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('requestId');
        setSearchParams(nextParams, { replace: true });
      }

      setSelectedRequest(null);
      setReviewNotes('');
      await fetchRequests();
    } catch {
      // Handled by API interceptor
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: ApprovalStatus) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approved
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5" /> Pending Review
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <XCircle className="w-3.5 h-3.5" /> Rejected
          </span>
        );
      default:
        return <span className="text-xs text-slate-500">{status}</span>;
    }
  };

  const formatRequestType = (type: AttendanceRequestType) => {
    switch (type) {
      case 'WFH_APPROVAL':
        return 'WFH Approval';
      case 'OVERTIME':
        return 'Overtime (Lembur)';
      case 'LEAVE':
        return 'Annual Leave';
      case 'SICK':
        return 'Sick Leave';
      case 'CORRECTION':
        return 'Attendance Correction';
      default:
        return type;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {isAdmin ? 'WFH & Leave Approvals' : 'Department Approvals'}
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#0A2D62] dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" />{' '}
              {isAdmin ? 'All Departments • Company-Wide Review' : user?.department || 'Department'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isAdmin
              ? 'Central review queue to authorize, audit, and manage employee WFH requests, overtime calculations, and leave applications across all departments.'
              : 'Review and authorize WFH requests, overtime pay calculations, and leave applications from team members in your department.'}
          </p>
        </div>

        <button
          type="button"
          onClick={fetchRequests}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs transition-colors self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Queue
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by employee name, NIP, or task details..."
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#0A2D62] dark:focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | ApprovalStatus)}
              className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#0A2D62]"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'ALL' | AttendanceRequestType)}
              className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#0A2D62]"
            >
              <option value="ALL">All Types</option>
              <option value="WFH_APPROVAL">WFH Approval</option>
              <option value="OVERTIME">Overtime</option>
              <option value="LEAVE">Leave</option>
              <option value="SICK">Sick</option>
              <option value="CORRECTION">Correction</option>
            </select>

            {isAdmin && uniqueDepartments.length > 0 && (
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#0A2D62]"
              >
                <option value="ALL">All Departments</option>
                {uniqueDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Request Type</th>
                <th className="py-3 px-4">Target Date</th>
                <th className="py-3 px-4">Work Plan / Reason</th>
                <th className="py-3 px-4">Proof</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-[#0A2D62] dark:text-blue-400" />
                    Loading approval queue...
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    No attendance requests match your current filters.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {req.employee?.fullName || 'Unknown Employee'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-mono">{req.employee?.employeeCode || 'N/A'}</span> • {req.employee?.position || 'Staff'}
                      </div>
                      {isAdmin && req.employee?.department && (
                        <div className="text-[11px] text-blue-700 dark:text-blue-300 font-medium mt-0.5">
                          {req.employee.department}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                      {formatRequestType(req.requestType)}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 font-mono">
                      {req.targetDate}
                    </td>

                    <td className="py-3.5 px-4 max-w-xs">
                      <p className="text-slate-700 dark:text-slate-300 truncate" title={req.reason}>
                        {req.reason}
                      </p>
                      {req.overtimeMinutes ? (
                        <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                          {req.overtimeMinutes} mins (Est: Rp{' '}
                          {(req.estimatedOvertimePay || 0).toLocaleString('id-ID')})
                        </span>
                      ) : null}
                    </td>

                    <td className="py-3.5 px-4">
                      {req.attachmentUrl ? (
                        <a
                          href={req.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-[#0A2D62] dark:text-blue-400 hover:underline font-medium"
                        >
                          <FileText className="w-3.5 h-3.5" /> View Proof
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400">None</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">{getStatusBadge(req.status)}</td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRequest(req);
                          setReviewNotes(req.reviewNotes || '');
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          req.status === 'PENDING'
                            ? 'bg-[#0A2D62] hover:bg-blue-900 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {req.status === 'PENDING' ? 'Review' : 'Details'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review & Details Modal Drawer */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#0A2D62] dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Review {formatRequestType(selectedRequest.requestType)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedRequest(null);
                  setReviewNotes('');
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 text-xs">
              {/* Employee Information */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {selectedRequest.employee?.fullName}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">
                    {selectedRequest.employee?.employeeCode}
                  </span>
                </div>
                <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                  {selectedRequest.employee?.position} • {selectedRequest.employee?.department}
                </div>
              </div>

              {/* Request Metadata */}
              <div className="grid grid-cols-2 gap-3 text-slate-600 dark:text-slate-400">
                <div>
                  <span className="text-[11px] text-slate-400 block">Target Date</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                    {selectedRequest.targetDate}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Current Status</span>
                  {getStatusBadge(selectedRequest.status)}
                </div>
              </div>

              {/* Work Plan / Reason */}
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Daily Work Plan / Reason
                </label>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {selectedRequest.reason}
                </div>
              </div>

              {/* Overtime Details (If Overtime) */}
              {selectedRequest.requestType === 'OVERTIME' && selectedRequest.overtimeMinutes && (
                <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 space-y-1">
                  <div className="font-semibold text-[#0A2D62] dark:text-blue-300">
                    Overtime Calculation (Depnaker Standard)
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400">
                    Duration: {selectedRequest.overtimeMinutes} mins • Estimated Pay: Rp{' '}
                    {(selectedRequest.estimatedOvertimePay || 0).toLocaleString('id-ID')}
                  </div>
                </div>
              )}

              {/* Proof Attachment Link */}
              {selectedRequest.attachmentUrl && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#0A2D62] dark:text-blue-400" /> Supporting Attachment
                  </span>
                  <a
                    href={selectedRequest.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-[#0A2D62] dark:text-blue-400 hover:underline"
                  >
                    Open Document <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Manager Review Notes */}
              <div>
                <label
                  htmlFor="reviewNotes"
                  className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1"
                >
                  Review Notes {selectedRequest.status === 'PENDING' && '(Required if Rejecting)'}
                </label>
                <textarea
                  id="reviewNotes"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  disabled={selectedRequest.status !== 'PENDING' || isSubmitting}
                  rows={3}
                  placeholder={
                    selectedRequest.status === 'PENDING'
                      ? 'Add any comments or instructions for the employee...'
                      : 'No review notes provided.'
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#0A2D62]"
                />
              </div>

              {selectedRequest.reviewedAt && (
                <div className="text-[11px] text-slate-400 text-right">
                  Reviewed at: {new Date(selectedRequest.reviewedAt).toLocaleString('id-ID')}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-3.5 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedRequest(null);
                  setReviewNotes('');
                }}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
              >
                Close
              </button>

              {selectedRequest.status === 'PENDING' && (
                <>
                  <button
                    type="button"
                    onClick={() => handleReview('REJECTED')}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors disabled:opacity-50"
                  >
                    Reject Request
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReview('APPROVED')}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors disabled:opacity-50"
                  >
                    Approve Request
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

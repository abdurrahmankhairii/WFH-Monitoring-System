// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Edit3,
  KeyRound,
  Plus,
  RotateCcw,
  UserX,
  UserCheck,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import { apiClient } from '../../api/client';
import {
  DataTableColumn,
  InteractiveDataTable,
  StatusBadge,
} from '../../components/custom/InteractiveDataTable';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  AccessRequestRecord,
  EmployeeRecord,
  EmployeeStatus,
  StandardApiResponse,
  UserRole,
} from '../../types';

interface EmployeeFormState {
  employeeCode: string;
  fullName: string;
  email: string;
  department: string;
  position: string;
  phoneNumber: string;
  joinDate: string;
  baseSalary: number;
  role: UserRole;
  status: EmployeeStatus;
  initialPassword: string;
}

const initialFormState: EmployeeFormState = {
  employeeCode: '',
  fullName: '',
  email: '',
  department: '',
  position: '',
  phoneNumber: '+62',
  joinDate: new Date().toISOString().slice(0, 10),
  baseSalary: 12000000,
  role: 'EMPLOYEE',
  status: 'ACTIVE',
  initialPassword: '',
};

// Feature: Master Employee Management & Soft Delete CRUD — Purpose: HRD Admin Master Employee Management page with Create, Update, Soft Delete, Restore, and Access Request approval.
// OOP: Presentation Page Component (View Layer Composition) — Connected To: Calls /api/employees and /api/access-requests -> employee-service EmployeesService and AccessRequestsService.
export const MasterEmployeesPage: React.FC = () => {
  const { user } = useAuth();
  const { notifyApiResponse, showToast } = useToast();

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequestRecord[]>([]);
  const [includeInactive, setIncludeInactive] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRecord | null>(null);
  const [form, setForm] = useState<EmployeeFormState>(initialFormState);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showInitialPassword, setShowInitialPassword] = useState<boolean>(false);

  // Feature: Master Employee Management & Soft Delete CRUD — Purpose: Loads master employee list and onboarding access requests from the API Gateway.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: GET /api/employees and GET /api/access-requests.
  const loadEmployeesAndRequests = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, reqRes] = await Promise.all([
        apiClient.get<StandardApiResponse<EmployeeRecord[]>>(
          `/employees?limit=100&includeInactive=${includeInactive ? 'true' : 'false'}`,
          {
            // @ts-expect-error silent background load
            silentToast: true,
          },
        ),
        apiClient.get<StandardApiResponse<AccessRequestRecord[]>>('/access-requests', {
          // @ts-expect-error silent background load
          silentToast: true,
        }),
      ]);
      setEmployees(empRes.data.data || []);
      setAccessRequests(reqRes.data.data || []);
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => {
    void loadEmployeesAndRequests();
  }, [loadEmployeesAndRequests]);

  useEffect(() => {
    if (!modalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen]);

  // Feature: Master Employee Management & Soft Delete CRUD — Purpose: Opens the employee modal in Create mode with clean default fields.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: "Add New Employee" button.
  const openCreateModal = () => {
    setEditingEmployee(null);
    setForm(initialFormState);
    setModalOpen(true);
    showToast({
      type: 'info',
      where: 'Master Employee • Create',
      what: 'Opened New Employee provisioning form',
      why: 'Fill in employee details to create their user account and dispatch a 6-digit verification OTP.',
    });
  };

  // Feature: Master Employee Management & Soft Delete CRUD — Purpose: Opens the employee modal in Edit mode populated with the selected employee's record.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: "Edit" button in InteractiveDataTable row.
  const openEditModal = (emp: EmployeeRecord) => {
    setEditingEmployee(emp);
    setForm({
      employeeCode: emp.employeeCode,
      fullName: emp.fullName,
      email: emp.email,
      department: emp.department,
      position: emp.position,
      phoneNumber: emp.phoneNumber || '',
      joinDate: emp.joinDate,
      baseSalary: emp.baseSalary ?? 12000000,
      role: emp.role,
      status: emp.status,
      initialPassword: '',
    });
    setModalOpen(true);
    showToast({
      type: 'info',
      where: 'Master Employee • Edit',
      what: `Editing ${emp.fullName} (${emp.employeeCode})`,
      why: 'Modify department, position, role, or contact details and click Save Changes.',
    });
  };

  // Feature: Master Employee Management & Soft Delete CRUD — Purpose: Submits Create (POST /api/employees) or Update (PATCH /api/employees/:id) and triggers a bottom-right green toast.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: EmployeesController.create() and EmployeesController.update() on api-gateway.
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCode = form.employeeCode.trim().toUpperCase();
    if (!trimmedCode) {
      showToast({
        type: 'error',
        where: 'Master Employee • Form Validation',
        what: 'Employee Code / NIP is required',
        why: 'Please enter a valid Employee Code / NIP (e.g., DEXA-2026-007) before saving the employee record.',
      });
      return;
    }

    setSubmitting(true);
    try {
      if (editingEmployee) {
        const res = await apiClient.patch<StandardApiResponse<EmployeeRecord>>(
          `/employees/${editingEmployee.id}`,
          {
            employeeCode: trimmedCode,
            fullName: form.fullName,
            email: form.email,
            department: form.department,
            position: form.position,
            phoneNumber: form.phoneNumber || undefined,
            joinDate: form.joinDate,
            baseSalary: Number(form.baseSalary || 12000000),
            role: form.role,
            status: form.status,
          },
        );
        notifyApiResponse(res.data);
      } else {
        const res = await apiClient.post<StandardApiResponse<EmployeeRecord>>('/employees', {
          employeeCode: trimmedCode,
          fullName: form.fullName,
          email: form.email,
          department: form.department,
          position: form.position,
          phoneNumber: form.phoneNumber || undefined,
          joinDate: form.joinDate,
          baseSalary: Number(form.baseSalary || 12000000),
          role: form.role,
          initialPassword: form.initialPassword || undefined,
        });
        notifyApiResponse(res.data);
      }
      setModalOpen(false);
      void loadEmployeesAndRequests();
    } finally {
      setSubmitting(false);
    }
  };

  // Feature: Master Employee Management & Soft Delete CRUD — Purpose: Soft-deletes an employee record while preserving historical attendance logs.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: DELETE /api/employees/:id.
  const handleSoftDelete = async (emp: EmployeeRecord) => {
    const res = await apiClient.delete<StandardApiResponse<EmployeeRecord>>(`/employees/${emp.id}`);
    notifyApiResponse(res.data);
    void loadEmployeesAndRequests();
  };

  // Feature: Master Employee Management & Soft Delete CRUD — Purpose: Restores a previously soft-deleted employee record back to ACTIVE status.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: PATCH /api/employees/:id/restore.
  const handleRestore = async (emp: EmployeeRecord) => {
    const res = await apiClient.patch<StandardApiResponse<EmployeeRecord>>(`/employees/${emp.id}/restore`);
    notifyApiResponse(res.data);
    void loadEmployeesAndRequests();
  };

  // Feature: Master Employee Management & Soft Delete CRUD — Purpose: Approves or rejects a public onboarding access request.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: PATCH /api/access-requests/:id/review.
  const handleReviewAccessRequest = async (reqId: string, decision: 'APPROVED' | 'REJECTED') => {
    const res = await apiClient.patch<StandardApiResponse>(`/access-requests/${reqId}/review`, {
      status: decision,
      reviewNotes:
        decision === 'APPROVED'
          ? 'Approved by HRD Admin — account provisioned and 6-digit OTP dispatched.'
          : 'Declined by HRD Admin.',
    });
    notifyApiResponse(res.data);
    void loadEmployeesAndRequests();
  };

  // Feature: Master Employee Management — Purpose: Converts raw uppercase role enums into human-friendly Title Case labels.
  // OOP: Pure Transformation Utility Function — Connected To: Used in Master Employee table Role column.
  const formatRoleLabel = (role: string): string => {
    switch (role) {
      case 'SYSTEM_ADMIN':
        return 'System Admin';
      case 'HR_ADMIN':
        return 'HR Admin';
      case 'MANAGER':
        return 'Manager';
      case 'EMPLOYEE':
        return 'Employee';
      default:
        return role.replace(/_/g, ' ');
    }
  };

  // Feature: Master Employee Management — Purpose: Supplies semantic theme styling for each role pill.
  // OOP: Pure Style Strategy Utility — Connected To: Master Employee table Role column badge.
  const getRoleBadgeStyle = (role: string): string => {
    switch (role) {
      case 'SYSTEM_ADMIN':
        return 'bg-rose-50 dark:bg-rose-950/60 text-[#D32F2F] dark:text-rose-300 border-rose-200 dark:border-rose-800/60';
      case 'HR_ADMIN':
        return 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60';
      case 'MANAGER':
        return 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60';
      case 'EMPLOYEE':
      default:
        return 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60';
    }
  };
  const columns: DataTableColumn<EmployeeRecord>[] = [
    {
      key: 'employee',
      header: 'Employee',
      sortable: true,
      sortValue: (r) => r.fullName,
      render: (r) => (
        <div className="min-w-[200px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 dark:text-slate-100">{r.fullName}</span>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono text-[11px] font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap tabular-nums">
              {r.employeeCode}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-sans mt-0.5">
            {r.email || '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department & Position',
      sortable: true,
      sortValue: (r) => r.department,
      render: (r) => (
        <div className="min-w-[170px]">
          <div className="font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">{r.department}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{r.position}</div>
        </div>
      ),
    },
    {
      key: 'baseSalary',
      header: 'Compensation',
      sortable: true,
      sortValue: (r) => r.baseSalary ?? 12000000,
      render: (r) => {
        const salary = Number(r.baseSalary ?? 12000000);
        const hourlyRate = Math.round(salary / 173);
        return (
          <div className="font-sans tabular-nums whitespace-nowrap">
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Rp {salary.toLocaleString('id-ID')}{' '}
              <span className="font-normal text-slate-500 dark:text-slate-400 text-[11px]">/ mo</span>
            </div>
            <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400 mt-0.5">
              Rp {hourlyRate.toLocaleString('id-ID')} / hr overtime
            </div>
          </div>
        );
      },
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      sortValue: (r) => r.role,
      render: (r) => (
        <span
          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${getRoleBadgeStyle(
            r.role,
          )}`}
        >
          {formatRoleLabel(r.role)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (r) => (!r.isActive ? 'INACTIVE' : !r.isVerified ? 'PENDING_OTP' : 'ACTIVE'),
      render: (r) => {
        if (!r.isActive) {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
              <span>Inactive</span>
            </span>
          );
        }
        if (!r.isVerified) {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              <span>Pending OTP</span>
            </span>
          );
        }
        return (
          <div className="inline-flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span>Active</span>
            </span>
            {r.isSiblingExempt && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 whitespace-nowrap" title="Sibling Biometric Exemption Active">
                Twin Exempt
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <button
            type="button"
            onClick={() => openEditModal(r)}
            className="taste-btn inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>

          {r.isActive ? (
            <button
              type="button"
              onClick={() => void handleSoftDelete(r)}
              className="taste-btn inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-[#D32F2F] dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 text-xs font-semibold"
              title="Deactivate employee access"
            >
              <UserX className="w-3.5 h-3.5" />
              <span>Deactivate</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleRestore(r)}
              className="taste-btn inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-xs font-semibold"
              title="Restore active status"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore</span>
            </button>
          )}
        </div>
      ),
    },
  ];

  const pendingAccessCount = accessRequests.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-sans text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
            Master Employee Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage company employee directory, roles, and employment access
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="taste-btn inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A2D62] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Employee</span>
        </button>
      </div>

      {/* Master Employee Table */}
      <InteractiveDataTable
        data={employees}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="Search name, NIP, email, department, or position..."
        searchKeys={[
          (r) => r.fullName,
          (r) => r.employeeCode,
          (r) => r.email,
          (r) => r.department,
          (r) => r.position,
        ]}
        isLoading={loading}
        toolbarRightSlot={
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500"
              />
              <span>Show Inactive ({employees.filter((e) => !e.isActive).length})</span>
            </label>
            <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-sans tabular-nums whitespace-nowrap">
              {employees.length} Employees
            </span>
          </div>
        }
      />

      {/* Public Onboarding Access Requests Section */}
      <div className="taste-card bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#D32F2F]" />
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Employee Onboarding Access Requests ({accessRequests.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Approving a request automatically provisions the user and employee record and emails a 6-digit verification OTP
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-xs font-semibold font-sans tabular-nums">
            {pendingAccessCount} Pending Review
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accessRequests.map((req) => (
            <div
              key={req.id}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col justify-between gap-3 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white text-sm">{req.fullName}</span>
                  <StatusBadge status={req.status} />
                </div>
                <div className="font-sans text-[11px] text-blue-700 dark:text-blue-400">
                  {req.email} • <span className="font-mono text-[11px] font-medium text-slate-500 dark:text-slate-400">{req.employeeCode || 'Auto-NIP'}</span>
                </div>
                <div className="text-slate-600 dark:text-slate-300 font-medium">
                  {req.department} • {req.position}
                </div>
                {req.reason && (
                  <p className="text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700 mt-1">
                    {req.reason}
                  </p>
                )}
              </div>

              {req.status === 'PENDING' && (
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void handleReviewAccessRequest(req.id, 'REJECTED')}
                    className="taste-btn inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-[#D32F2F] dark:text-rose-300 font-semibold"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleReviewAccessRequest(req.id, 'APPROVED')}
                    className="taste-btn inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve &amp; Send 6-Digit OTP</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Create / Edit Employee Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingEmployee ? 'Edit Employee Record' : 'Create New Employee'}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700/80">
            <div className="h-1 bg-gradient-to-r from-[#D32F2F] via-[#0A2D62] to-blue-600" />
            <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  {editingEmployee
                    ? `Edit Employee: ${editingEmployee.fullName}`
                    : 'Provision New Employee Account'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {editingEmployee
                    ? 'Update master employee record and role permissions'
                    : 'Creates linked User and Employee records and emails a 6-digit verification OTP'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="p-5 sm:p-6 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    placeholder="Abdurrahman Khairi"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Corporate Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="abdurrahman.khairi@dexagroup.com"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Employee Code / NIP (Mandatory) *
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={form.employeeCode}
                    onChange={(e) => setForm({ ...form, employeeCode: e.target.value.toUpperCase() })}
                    placeholder="DEXA-2026-007"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    RBAC Role *
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900"
                  >
                    <option value="EMPLOYEE">EMPLOYEE</option>
                    <option value="HR_ADMIN">HR_ADMIN</option>
                    <option value="SYSTEM_ADMIN">SYSTEM_ADMIN (Full Access)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Department *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    placeholder="e.g. IT & Digital Innovation"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Position / Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                    placeholder="e.g. Fullstack Developer"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={form.phoneNumber}
                    onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                    placeholder="+62"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-sans tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Join Date
                  </label>
                  <input
                    type="date"
                    value={form.joinDate}
                    onChange={(e) => setForm({ ...form, joinDate: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-sans tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Base Salary (IDR) — Overtime Rate Basis (1/173) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1000000}
                    step={500000}
                    required
                    value={form.baseSalary}
                    onChange={(e) => setForm({ ...form, baseSalary: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-sans tabular-nums"
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                  Hourly Overtime Rate (1/173):{' '}
                  <strong className="text-emerald-600 dark:text-emerald-400">
                    Rp {Math.round((form.baseSalary || 12000000) / 173).toLocaleString('id-ID')}/hr
                  </strong>{' '}
                  • 1st hr: 1.5x, next hrs: 2.0x (Kemenaker PP No. 35/2021)
                </p>
              </div>

              {editingEmployee ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Employment Status
                    </label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value as EmployeeStatus })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="ON_LEAVE">ON_LEAVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 font-sans">
                          Sibling Biometric Exemption
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                          Exempts employee from duplicate face rejection if an identical twin or lookalike sibling is enrolled.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
                        <input
                          type="checkbox"
                          checked={Boolean(editingEmployee.isSiblingExempt)}
                          onChange={async (e) => {
                            const isExempt = e.target.checked;
                            try {
                              await apiClient.patch(`/employees/${editingEmployee.id}/sibling-exemption`, {
                                isSiblingExempt: isExempt,
                                reason: isExempt ? 'Verified identical twin / sibling relation at Dexa Group' : 'Exemption revoked',
                              });
                              showToast({
                                type: 'success',
                                where: 'Master Employee - Biometric Exemption',
                                what: `${isExempt ? 'Granted' : 'Revoked'} sibling exemption`,
                                why: `Biometric sibling exemption for ${editingEmployee.fullName} has been updated.`,
                              });
                              setEditingEmployee({
                                ...editingEmployee,
                                isSiblingExempt: isExempt,
                                siblingExemptApprovedBy: isExempt ? user?.fullName || 'HR Admin' : null,
                              });
                              loadEmployeesAndRequests();
                            } catch (err: any) {
                              // toast handles error
                            }
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    {editingEmployee.isSiblingExempt && editingEmployee.siblingExemptApprovedBy && (
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800/40 font-sans">
                        Approved by: {editingEmployee.siblingExemptApprovedBy}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Initial Password (Optional — User can also set password via 6-digit OTP)
                  </label>
                  <div className="relative">
                    <input
                      type={showInitialPassword ? 'text' : 'password'}
                      value={form.initialPassword}
                      onChange={(e) => setForm({ ...form, initialPassword: e.target.value })}
                      placeholder="Default: EmployeeDexa2026!"
                      className="w-full pl-3.5 pr-10 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowInitialPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
                      title={showInitialPassword ? 'Hide password' : 'Show password'}
                      aria-label={showInitialPassword ? 'Hide password' : 'Show password'}
                    >
                      {showInitialPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="taste-btn px-5 py-2.5 rounded-xl bg-[#0A2D62] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingEmployee ? 'Save Changes' : 'Create & Dispatch OTP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

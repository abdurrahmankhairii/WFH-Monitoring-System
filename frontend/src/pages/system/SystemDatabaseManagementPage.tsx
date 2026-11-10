// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Database,
  Download,
  Edit2,
  Eye,
  FileCode,
  FileText,
  KeyRound,
  LifeBuoy,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sliders,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { DatabaseColumnMeta, DatabaseTableMeta, StandardApiResponse } from '../../types';

interface DynamicFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Record<string, any>) => Promise<void>;
  table: DatabaseTableMeta;
  initialData?: Record<string, any> | null;
  mode: 'CREATE' | 'EDIT';
  isSaving: boolean;
}

// Sensitive internal columns excluded from grid table view for security & clean UI
const SENSITIVE_TABLE_COLUMNS = new Set([
  'passwordHash',
  'password_hash',
  'codeHash',
  'code_hash',
  'faceEmbedding',
  'imageHash',
  'image_hash',
  'imagePhash',
  'image_phash',
  'clockOutImageHash',
  'clockOutImagePhash',
]);

// Feature: Dynamic Column Label Formatter — Purpose: Formats camelCase/snake_case property names into clean human-readable Title Case labels.
// OOP: Pure Presentation Function (Stateless Helper) — Connected To: SystemDatabaseManagementPage table header rendering.
const formatColumnHeader = (propName: string): string => {
  const customLabels: Record<string, string> = {
    id: 'ID',
    userId: 'User ID',
    employeeId: 'Employee ID',
    departmentId: 'Department ID',
    employeeCode: 'Employee Code',
    fullName: 'Full Name',
    email: 'Email',
    role: 'Role',
    isVerified: 'Verified',
    isActive: 'Active',
    lastLoginAt: 'Last Login',
    createdAt: 'Created At',
    updatedAt: 'Updated At',
    deletedAt: 'Deleted At',
    baseSalary: 'Base Salary',
    phoneNumber: 'Phone Number',
    joinDate: 'Join Date',
    status: 'Status',
    managerName: 'Manager Name',
    managerEmail: 'Manager Email',
    hrPicEmail: 'HR PIC Email',
    maxWfhDaysPerWeek: 'Max WFH / Wk',
    wfhWorkflowMode: 'WFH Mode',
    enableOvertime: 'Overtime Enabled',
    attendanceDate: 'Date',
    clockInTime: 'Clock In',
    clockOutTime: 'Clock Out',
    workDurationMinutes: 'Duration (m)',
    lateMinutes: 'Late (m)',
    wfhApproved: 'WFH Approved',
    verificationMethod: 'Verification Method',
    verificationStatus: 'Verification Status',
    livenessScore: 'Liveness',
    similarityScore: 'Similarity',
    clockOutSimilarityScore: 'Out Similarity',
    isFaceMatched: 'Face Matched',
    isClockOutFaceMatched: 'Out Matched',
    dailyPlan: 'Daily Plan',
    dailyAccomplishment: 'Daily Accomplishment',
    requestType: 'Request Type',
    targetDate: 'Target Date',
    requestedClockIn: 'Requested In',
    requestedClockOut: 'Requested Out',
    overtimeMinutes: 'Overtime (m)',
    overtimePayAmount: 'Overtime Pay',
    reason: 'Reason',
    attempts: 'Attempts',
    expiresAt: 'Expires At',
    usedAt: 'Used At',
    moduleLocation: 'Module',
    emailDelivered: 'Email Sent',
    subject: 'Subject',
    category: 'Category',
  };

  if (customLabels[propName]) {
    return customLabels[propName];
  }

  return propName
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

// Feature: Precise Timestamp Formatter — Purpose: Formats raw ISO-8601 strings into precise, human-friendly YYYY-MM-DD HH:mm WIB strings in Asia/Jakarta timezone.
// OOP: Pure Presentation Function (Stateless Helper) — Connected To: SystemDatabaseManagementPage table cell rendering.
const formatDatabaseDateTime = (val: any): string => {
  if (val === null || val === undefined || val === '') return '-';
  const str = String(val);

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  const date = new Date(str);
  if (isNaN(date.getTime())) {
    return str;
  }

  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';
    const yyyy = getPart('year');
    const mm = getPart('month');
    const dd = getPart('day');
    const hh = getPart('hour');
    const min = getPart('minute');

    return `${yyyy}-${mm}-${dd} ${hh}:${min} WIB`;
  } catch {
    return str.slice(0, 19).replace('T', ' ') + ' WIB';
  }
};

// Feature: System Administrator Database Studio — Purpose: Modal dialog dynamically generating form inputs according to the active table's relational column schema.
// OOP: Reusable Modal Component (View & Form State Encapsulation) — Connected To: SystemDatabaseManagementPage.tsx CRUD workflows.
const DynamicFormModal: React.FC<DynamicFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  table,
  initialData,
  mode,
  isSaving,
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [showPassword, setShowPassword] = useState<boolean>(false);

  useEffect(() => {
    if (initialData && mode === 'EDIT') {
      setFormData({ ...initialData });
    } else {
      const defaults: Record<string, any> = {};
      table.columns.forEach((col) => {
        if (!col.isPrimary && !['createdAt', 'updatedAt', 'deletedAt'].includes(col.propertyName)) {
          if (col.type.includes('bool') || col.type.includes('tinyint')) {
            defaults[col.propertyName] = col.default !== undefined ? Boolean(col.default) : true;
          } else if (col.type.includes('int') || col.type.includes('decimal')) {
            defaults[col.propertyName] = col.default !== undefined ? Number(col.default) : 0;
          } else if (col.enum && col.enum.length > 0) {
            defaults[col.propertyName] = col.enum[0];
          } else {
            defaults[col.propertyName] = col.default !== undefined ? String(col.default) : '';
          }
        }
      });
      if (table.tableName === 'users') {
        defaults.password = 'AdminDexa2026!';
      }
      setFormData(defaults);
    }
  }, [initialData, mode, table, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  const handleFieldChange = (propName: string, value: any) => {
    setFormData((prev) => ({ ...prev, [propName]: value }));
  };

  const editableColumns = table.columns.filter((col) => {
    if (col.isPrimary && mode === 'EDIT') return false;
    if (['createdAt', 'updatedAt', 'deletedAt'].includes(col.propertyName)) return false;
    if (col.propertyName === 'faceEmbedding') return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0A2D62] text-white flex items-center justify-center shadow-sm">
              <Database className="w-4 h-4 text-blue-300" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {mode === 'CREATE' ? 'Insert New Row' : 'Edit Existing Row'} • {table.displayName}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Table: <code className="font-mono text-blue-600 dark:text-blue-400">{table.tableName}</code>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {editableColumns.map((col) => {
              const val = formData[col.propertyName] ?? '';
              const isRequired = !col.isNullable && !col.isGenerated && col.default === undefined;

              // Enums
              if (col.enum && col.enum.length > 0) {
                return (
                  <div key={col.propertyName} className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {formatColumnHeader(col.propertyName)} {isRequired && <span className="text-rose-500">*</span>}
                    </label>
                    <select
                      value={val}
                      onChange={(e) => handleFieldChange(col.propertyName, e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      {col.enum.map((optVal) => (
                        <option key={String(optVal)} value={String(optVal)}>
                          {String(optVal)}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }

              // Boolean / Tinyint
              if (col.type.includes('bool') || col.type.includes('tinyint')) {
                return (
                  <div key={col.propertyName} className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {formatColumnHeader(col.propertyName)}
                    </label>
                    <select
                      value={Boolean(val) ? '1' : '0'}
                      onChange={(e) => handleFieldChange(col.propertyName, e.target.value === '1')}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="1">True (Active / Enabled)</option>
                      <option value="0">False (Inactive / Disabled)</option>
                    </select>
                  </div>
                );
              }

              // Numbers
              if (
                col.type.includes('int') ||
                col.type.includes('decimal') ||
                col.type.includes('float') ||
                col.type.includes('double')
              ) {
                return (
                  <div key={col.propertyName} className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {formatColumnHeader(col.propertyName)} {isRequired && <span className="text-rose-500">*</span>}
                    </label>
                    <input
                      type="number"
                      step={col.type.includes('decimal') || col.type.includes('float') ? '0.000001' : '1'}
                      value={val}
                      onChange={(e) =>
                        handleFieldChange(
                          col.propertyName,
                          e.target.value === '' ? null : Number(e.target.value),
                        )
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                );
              }

              // Datetime / Date
              if (col.type.includes('date') || col.type.includes('time')) {
                const isDateOnly = col.type === 'date';
                return (
                  <div key={col.propertyName} className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {formatColumnHeader(col.propertyName)}
                    </label>
                    <input
                      type={isDateOnly ? 'date' : 'datetime-local'}
                      value={
                        typeof val === 'string'
                          ? isDateOnly
                            ? val.slice(0, 10)
                            : val.slice(0, 16)
                          : ''
                      }
                      onChange={(e) => handleFieldChange(col.propertyName, e.target.value || null)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                );
              }

              // Large Text / JSON
              if (col.type.includes('text') || col.type.includes('json')) {
                return (
                  <div key={col.propertyName} className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {formatColumnHeader(col.propertyName)}
                    </label>
                    <textarea
                      rows={2}
                      value={typeof val === 'object' ? JSON.stringify(val) : val}
                      onChange={(e) => handleFieldChange(col.propertyName, e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                );
              }

              // Default Varchar / String
              return (
                <div key={col.propertyName} className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {formatColumnHeader(col.propertyName)} {isRequired && <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={val}
                    required={isRequired}
                    onChange={(e) => handleFieldChange(col.propertyName, e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              );
            })}

            {/* Special Password field for users table */}
            {table.tableName === 'users' && (
              <div className="sm:col-span-2 space-y-1.5 p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <label className="text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center justify-between">
                  <span>{mode === 'CREATE' ? 'User Password (will be bcrypt-hashed)' : 'Set New Password (leave blank to keep current)'}</span>
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={mode === 'EDIT' ? 'Leave empty to preserve existing password' : 'Enter password'}
                  value={formData.password ?? ''}
                  onChange={(e) => handleFieldChange('password', e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-[#0A2D62] hover:bg-blue-900 text-white shadow-sm disabled:opacity-50 transition-colors"
            >
              {isSaving ? 'Writing to MySQL...' : mode === 'CREATE' ? 'Insert Record' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Feature: System Administrator Database Studio — Purpose: Primary administrative page for querying, inspecting, and managing all 9 relational database tables.
// OOP: Presentation Page Component (View Layer Composition) — Connected To: Mounted on route `/system/database` via App.tsx.
export const SystemDatabaseManagementPage: React.FC = () => {
  const { user, isSystemAdmin } = useAuth();
  const { showToast, notifyApiResponse } = useToast();

  const [tables, setTables] = useState<DatabaseTableMeta[]>([]);
  const [selectedTableName, setSelectedTableName] = useState<string>('users');
  const [loadingTables, setLoadingTables] = useState<boolean>(true);

  const [rows, setRows] = useState<any[]>([]);
  const [loadingRows, setLoadingRows] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  // Modals
  const [modalMode, setModalMode] = useState<'CREATE' | 'EDIT'>('CREATE');
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [activeRow, setActiveRow] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [inspectRow, setInspectRow] = useState<any | null>(null);
  const [deleteConfirmRow, setDeleteConfirmRow] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Search debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  // Load tables metadata
  const loadTables = useCallback(
    async (notify = false) => {
      setLoadingTables(true);
      try {
        const res = await apiClient.get<StandardApiResponse<DatabaseTableMeta[]>>('/system/database/tables');
        if (res.data.data) {
          setTables(res.data.data);
          if (notify) {
            showToast({
              type: 'info',
              where: 'Database Studio • Overview',
              what: 'Schema metadata synchronized',
              why: `Refreshed ${res.data.data.length} relational table schemas and live row statistics.`,
            });
          }
        }
      } catch (err: any) {
        // Handled by toast interceptor
      } finally {
        setLoadingTables(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    void loadTables(false);
  }, [loadTables]);

  const activeTable = useMemo(() => {
    return tables.find((t) => t.tableName === selectedTableName) || tables[0] || null;
  }, [tables, selectedTableName]);

  // Clean list of columns for tabular grid view (excludes sensitive hashes and large vectors)
  const visibleGridColumns = useMemo(() => {
    if (!activeTable) return [];
    return activeTable.columns.filter((c) => !SENSITIVE_TABLE_COLUMNS.has(c.propertyName));
  }, [activeTable]);

  // Load table rows
  const loadRows = useCallback(async () => {
    if (!selectedTableName) return;
    setLoadingRows(true);
    try {
      const res = await apiClient.get<StandardApiResponse<any[]>>(`/system/database/${selectedTableName}`, {
        params: {
          page,
          limit,
          search: debouncedSearch,
        },
      });
      if (res.data.data) {
        setRows(res.data.data);
        if (res.data.meta) {
          setTotalPages(res.data.meta.totalPages || 1);
          setTotalRows(res.data.meta.total || 0);
        }
      }
    } finally {
      setLoadingRows(false);
    }
  }, [selectedTableName, page, limit, debouncedSearch]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  // Switch table tab
  const handleSelectTable = (tblName: string) => {
    setSelectedTableName(tblName);
    setSearch('');
    setDebouncedSearch('');
    setPage(1);
    const target = tables.find((t) => t.tableName === tblName);
    showToast({
      type: 'info',
      where: `Database Studio • ${tblName}`,
      what: `Active table: ${target?.displayName || tblName}`,
      why: `Loaded schema and records for table "${tblName}".`,
    });
  };

  // Create Row
  const handleOpenCreate = () => {
    setModalMode('CREATE');
    setActiveRow(null);
    setIsFormOpen(true);
    showToast({
      type: 'info',
      where: `Database Studio • ${selectedTableName}`,
      what: 'Opening insertion form',
      why: `Preparing form for table "${selectedTableName}".`,
    });
  };

  // Edit Row
  const handleOpenEdit = (row: any) => {
    setModalMode('EDIT');
    setActiveRow(row);
    setIsFormOpen(true);
    showToast({
      type: 'info',
      where: `Database Studio • ${selectedTableName}`,
      what: 'Opening row editor',
      why: `Editing record ID "${row[activeTable?.primaryKey || 'id']}".`,
    });
  };

  // Save (Create or Update)
  const handleSaveForm = async (data: Record<string, any>) => {
    setIsSaving(true);
    try {
      if (modalMode === 'CREATE') {
        const res = await apiClient.post<StandardApiResponse<any>>(`/system/database/${selectedTableName}`, data);
        notifyApiResponse(res.data);
      } else {
        const primaryKey = activeTable?.primaryKey || 'id';
        const id = activeRow[primaryKey];
        const res = await apiClient.put<StandardApiResponse<any>>(`/system/database/${selectedTableName}/${id}`, data);
        notifyApiResponse(res.data);
      }
      setIsFormOpen(false);
      void loadRows();
      void loadTables(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Row
  const handleDeleteRow = async () => {
    if (!deleteConfirmRow || !activeTable) return;
    setIsDeleting(true);
    const primaryKey = activeTable.primaryKey || 'id';
    const id = deleteConfirmRow[primaryKey];
    try {
      const res = await apiClient.delete<StandardApiResponse<any>>(`/system/database/${selectedTableName}/${id}`);
      notifyApiResponse(res.data);
      setDeleteConfirmRow(null);
      void loadRows();
      void loadTables(false);
    } finally {
      setIsDeleting(false);
    }
  };

  // Export JSON
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(rows, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${selectedTableName}_export_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showToast({
      type: 'info',
      where: `Database Studio • ${selectedTableName}`,
      what: 'Exported JSON file',
      why: `Downloaded ${rows.length} records from table "${selectedTableName}".`,
    });
  };

  // Export CSV
  const handleExportCsv = () => {
    if (rows.length === 0 || !activeTable) return;
    const cols = visibleGridColumns.map((c) => c.propertyName);
    const csvRows = [cols.map(formatColumnHeader).join(',')];

    rows.forEach((row) => {
      const line = cols.map((c) => {
        const val = row[c];
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      csvRows.push(line.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTableName}_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast({
      type: 'info',
      where: `Database Studio • ${selectedTableName}`,
      what: 'Exported CSV file',
      why: `Downloaded ${rows.length} tabular rows from table "${selectedTableName}".`,
    });
  };

  const getTableIcon = (tableName: string) => {
    switch (tableName) {
      case 'users':
        return Users;
      case 'employees':
        return UserCheck;
      case 'departments':
        return Building2;
      case 'attendances':
        return CalendarCheck2;
      case 'attendance_requests':
        return ClipboardCheck;
      case 'access_requests':
        return UserPlus;
      case 'support_tickets':
        return LifeBuoy;
      case 'system_settings':
        return Sliders;
      case 'otp_codes':
        return KeyRound;
      default:
        return Database;
    }
  };

  if (!isSystemAdmin) {
    return (
      <div className="p-8 text-center space-y-3">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold">Access Restricted to System Administrator</h2>
        <p className="text-xs text-slate-500">Only accounts with role SYSTEM_ADMIN are permitted to open Database Studio.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Compact Header (Consistent with HRD Dashboard & Master Employees) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-sans text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
            Database Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Relational table administration, direct record inspection, and live CRUD management
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void loadTables(true)}
            disabled={loadingTables}
            className="taste-btn inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${loadingTables ? 'animate-spin' : ''}`} />
            <span>Refresh Schema</span>
          </button>
        </div>
      </div>

      {/* Table Selector Tabs */}
      <div className="taste-card bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-2.5 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {tables.map((tbl) => {
            const Icon = getTableIcon(tbl.tableName);
            const isSelected = tbl.tableName === selectedTableName;
            return (
              <button
                key={tbl.tableName}
                type="button"
                onClick={() => handleSelectTable(tbl.tableName)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-[#0A2D62] text-white shadow-sm font-semibold'
                    : 'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-300' : 'text-slate-400'}`} />
                <span>{tbl.displayName}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {tbl.rowCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Table Details & Toolbar */}
      {activeTable && (
        <div className="taste-card bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Table: <code className="font-mono text-blue-600 dark:text-blue-400 font-semibold">{activeTable.tableName}</code>
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 tabular-nums">
                  {visibleGridColumns.length} Columns
                </span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 tabular-nums">
                  {totalRows} Rows
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {activeTable.description}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                className="taste-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={handleExportJson}
                className="taste-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <FileCode className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export JSON</span>
              </button>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="taste-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0A2D62] hover:bg-blue-900 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Record</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search across ${activeTable.displayName}...`}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex items-center gap-1.5">
                <span>Rows per page:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <span className="tabular-nums">
                Page {page} of {totalPages}
              </span>
            </div>
          </div>

          {/* Interactive Data Grid */}
          <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-semibold text-xs border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 text-center w-24 font-semibold">Actions</th>
                  {visibleGridColumns.slice(0, 8).map((col) => (
                    <th key={col.propertyName} className="px-4 py-3 whitespace-nowrap font-semibold">
                      {formatColumnHeader(col.propertyName)}
                      {col.isPrimary && (
                        <span className="ml-1 text-[9px] px-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-mono">
                          PK
                        </span>
                      )}
                    </th>
                  ))}
                  {visibleGridColumns.length > 8 && (
                    <th className="px-4 py-3 text-slate-400 font-normal">+{visibleGridColumns.length - 8} more</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">
                {loadingRows ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                      Loading table rows from MySQL...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                      No matching records found in table "{activeTable.tableName}".
                    </td>
                  </tr>
                ) : (
                  rows.map((row, rowIdx) => {
                    const primaryKey = activeTable.primaryKey || 'id';
                    const rowId = row[primaryKey];
                    return (
                      <tr key={String(rowId || rowIdx)} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        {/* Action buttons */}
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setInspectRow(row);
                                showToast({
                                  type: 'info',
                                  where: `Database Studio • ${activeTable.tableName}`,
                                  what: 'Inspecting record payload',
                                  why: `Viewing details for row ${rowId}.`,
                                });
                              }}
                              title="Inspect Full Record"
                              className="p-1 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(row)}
                              title="Edit Record"
                              className="p-1 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/60 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmRow(row)}
                              title="Delete Record"
                              className="p-1 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                        {/* Column Cells */}
                        {visibleGridColumns.slice(0, 8).map((col) => {
                          const val = row[col.propertyName];
                          const isDateField =
                            col.propertyName.toLowerCase().includes('date') ||
                            col.propertyName.toLowerCase().includes('time') ||
                            col.propertyName.toLowerCase().includes('at');

                          return (
                            <td key={col.propertyName} className="px-4 py-3 whitespace-nowrap max-w-[220px] truncate text-xs">
                              {val === null || val === undefined ? (
                                <span className="text-slate-300 dark:text-slate-600 italic">null</span>
                              ) : typeof val === 'boolean' ? (
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    val
                                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                      : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                  }`}
                                >
                                  {val ? 'True' : 'False'}
                                </span>
                              ) : isDateField ? (
                                <span className="font-sans tabular-nums text-xs text-slate-700 dark:text-slate-300">
                                  {formatDatabaseDateTime(val)}
                                </span>
                              ) : typeof val === 'object' ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                  [Object]
                                </span>
                              ) : (
                                <span title={String(val)} className="text-slate-800 dark:text-slate-200">
                                  {String(val)}
                                </span>
                              )}
                            </td>
                          );
                        })}

                        {visibleGridColumns.length > 8 && (
                          <td className="px-4 py-3 text-slate-400 text-center">...</td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3">
            <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalRows)} of {totalRows} entries
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="taste-btn p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 tabular-nums">
                {page} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="taste-btn p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Create / Edit Modal */}
      {activeTable && (
        <DynamicFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSave={handleSaveForm}
          table={activeTable}
          initialData={activeRow}
          mode={modalMode}
          isSaving={isSaving}
        />
      )}

      {/* Inspect Record Modal */}
      {inspectRow && activeTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Record Inspector • {activeTable.displayName}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    ID: {inspectRow[activeTable.primaryKey || 'id']}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectRow(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Formatted Field Values
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(inspectRow, null, 2));
                    showToast({
                      type: 'info',
                      where: `Database Studio • ${activeTable.tableName}`,
                      what: 'Copied JSON payload to clipboard',
                      why: 'Raw entity payload copied successfully.',
                    });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy JSON</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {Object.entries(inspectRow).map(([k, v]) => (
                  <div
                    key={k}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1"
                  >
                    <span className="font-semibold text-slate-500 dark:text-slate-400 block text-[11px]">
                      {formatColumnHeader(k)}
                    </span>
                    <div className="font-mono text-xs text-slate-900 dark:text-white break-all max-h-32 overflow-y-auto">
                      {v === null || v === undefined
                        ? 'null'
                        : typeof v === 'object'
                        ? JSON.stringify(v, null, 2)
                        : (k.toLowerCase().includes('date') || k.toLowerCase().includes('time') || k.toLowerCase().includes('at'))
                        ? formatDatabaseDateTime(v)
                        : String(v)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectRow(null)}
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-[#0A2D62] hover:bg-blue-900 text-white shadow-sm transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmRow && activeTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/60 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-[#D32F2F] flex items-center justify-center border border-rose-200 dark:border-rose-800 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Confirm Database Row Deletion
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Table: <code className="font-mono text-rose-600">{activeTable.tableName}</code>
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/50 text-xs text-rose-900 dark:text-rose-200 space-y-1">
              <p className="font-semibold">Are you sure you want to delete this record?</p>
              <p className="font-mono text-[11px] break-all">
                Primary Key: {deleteConfirmRow[activeTable.primaryKey || 'id']}
              </p>
              <p className="text-[11px] text-rose-700 dark:text-rose-300 pt-1">
                Warning: If this row is referenced by foreign keys in other tables (e.g. employee attendance history), deletion will be rejected to maintain database integrity.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmRow(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRow}
                disabled={isDeleting}
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-[#D32F2F] hover:bg-rose-700 text-white shadow-sm disabled:opacity-50 transition-colors"
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

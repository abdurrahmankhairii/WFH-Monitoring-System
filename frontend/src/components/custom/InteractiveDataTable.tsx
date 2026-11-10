// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Printer,
  Search,
} from 'lucide-react';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface InteractiveDataTableProps<T> {
  title?: string;
  subtitle?: string;
  data: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
  searchPlaceholder?: string;
  searchKeys?: Array<(row: T) => string>;
  onSearchChange?: (term: string) => void;
  externalSearchTerm?: string;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  onExportCsv?: () => void;
  onExportExcel?: () => void;
  onPrintPdf?: () => void;
  toolbarRightSlot?: React.ReactNode;
  emptyMessage?: string;
  isLoading?: boolean;
}

// Feature: Interactive Data Table & Export Controls — Purpose: Reusable sortable, searchable, paginated enterprise data table with CSV, Excel, and PDF export triggers.
// OOP: Generic Reusable UI Component (Polymorphic Column Renderer) — Connected To: Used across HRD Attendance Monitoring, Master Employees, and Employee Attendance History pages.
export function InteractiveDataTable<T>({
  title,
  subtitle,
  data,
  columns,
  rowKey,
  searchPlaceholder = 'Search records...',
  searchKeys = [],
  onSearchChange,
  externalSearchTerm,
  pageSizeOptions = [5, 10, 20, 50],
  defaultPageSize = 10,
  onExportCsv,
  onExportExcel,
  onPrintPdf,
  toolbarRightSlot,
  emptyMessage = 'No matching records found for the active filter criteria.',
  isLoading = false,
}: InteractiveDataTableProps<T>) {
  const [internalSearch, setInternalSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const activeSearch = externalSearchTerm !== undefined ? externalSearchTerm : internalSearch;

  // Feature: Interactive Data Table & Export Controls — Purpose: Toggles column sort direction (asc -> desc -> unsorted).
  // OOP: Generic Reusable UI Component (Polymorphic Column Renderer) — Connected To: Table column header click handler.
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const processedRows = useMemo(() => {
    let rows = [...data];

    if (externalSearchTerm === undefined && activeSearch.trim() && searchKeys.length > 0) {
      const q = activeSearch.toLowerCase();
      rows = rows.filter((row) =>
        searchKeys.some((extractor) => (extractor(row) || '').toLowerCase().includes(q)),
      );
    }

    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col && col.sortValue) {
        rows.sort((a, b) => {
          const valA = col.sortValue!(a);
          const valB = col.sortValue!(b);
          if (valA < valB) return sortDir === 'asc' ? -1 : 1;
          if (valA > valB) return sortDir === 'asc' ? 1 : -1;
          return 0;
        });
      }
    }

    return rows;
  }, [data, externalSearchTerm, activeSearch, searchKeys, sortKey, sortDir, columns]);

  const totalRows = processedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = processedRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="taste-card bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Table Top Header & Export Toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/60">
        {title ? (
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        ) : (
          (searchKeys.length > 0 || onSearchChange) && (
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={activeSearch}
                onChange={(e) => {
                  setPage(1);
                  if (onSearchChange) {
                    onSearchChange(e.target.value);
                  } else {
                    setInternalSearch(e.target.value);
                  }
                }}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>
          )
        )}

        <div className="flex flex-wrap items-center gap-2">
          {title && (searchKeys.length > 0 || onSearchChange) && (
            <div className="relative flex-1 sm:flex-initial sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={activeSearch}
                onChange={(e) => {
                  setPage(1);
                  if (onSearchChange) {
                    onSearchChange(e.target.value);
                  } else {
                    setInternalSearch(e.target.value);
                  }
                }}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>
          )}

          {toolbarRightSlot}

          {/* Export Buttons (CSV, Excel .xlsx, Print PDF) */}
          {onExportExcel && (
            <button
              type="button"
              onClick={onExportExcel}
              className="taste-btn no-print inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export .XLSX</span>
            </button>
          )}

          {onExportCsv && (
            <button
              type="button"
              onClick={onExportCsv}
              className="taste-btn no-print inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0A2D62] hover:bg-blue-900 text-white text-xs font-semibold shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .CSV</span>
            </button>
          )}

          {onPrintPdf && (
            <button
              type="button"
              onClick={onPrintPdf}
              className="taste-btn no-print inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`py-3 px-4 select-none ${col.className || ''} ${
                    col.sortable ? 'cursor-pointer hover:text-blue-700 dark:hover:text-blue-400' : ''
                  }`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="inline-flex items-center gap-1.5">
                    <span>{col.header}</span>
                    {col.sortable && (
                      <span className="text-slate-400">
                        {sortKey === col.key ? (
                          sortDir === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs text-slate-700 dark:text-slate-200">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-slate-400">
                  Loading records...
                </td>
              </tr>
            ) : paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedRows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="hover:bg-blue-50/35 dark:hover:bg-slate-800/50 transition-colors"
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`py-3.5 px-4 align-middle ${col.className || ''}`}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="no-print px-4 py-3 bg-slate-50/70 dark:bg-slate-900/80 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2 font-sans tabular-nums">
          <span>
            Showing{' '}
            <strong className="text-slate-900 dark:text-slate-100">
              {totalRows === 0 ? 0 : (safePage - 1) * pageSize + 1}
            </strong>{' '}
            – <strong className="text-slate-900 dark:text-slate-100">{Math.min(safePage * pageSize, totalRows)}</strong> of{' '}
            <strong className="text-slate-900 dark:text-slate-100">{totalRows}</strong>
          </span>

          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            aria-label="Rows per page"
            className="ml-2 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt} / page
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none font-medium"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Prev</span>
          </button>

          <span className="px-3 py-1.5 rounded-lg bg-[#0A2D62]/10 dark:bg-blue-950/60 text-[#0A2D62] dark:text-blue-300 font-semibold font-sans tabular-nums">
            {safePage} / {totalPages}
          </span>

          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none font-medium"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Feature: Interactive Data Table & Export Controls — Purpose: Standardized status badge pill for attendance, employee, and approval statuses with semantic signal dot.
// OOP: Reusable UI Component (Encapsulated View & State) — Connected To: Used across all tables, cards, and modals in frontend/src/.
export const StatusBadge: React.FC<{ status?: string | null }> = ({ status }) => {
  const safeStatus = status || 'PENDING';
  const palette: Record<string, { badge: string; dot: string }> = {
    ON_TIME: {
      badge: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
      dot: 'bg-emerald-500',
    },
    COMPLETED: {
      badge: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
      dot: 'bg-blue-600',
    },
    ACTIVE: {
      badge: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
      dot: 'bg-emerald-500',
    },
    APPROVED: {
      badge: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
      dot: 'bg-emerald-500',
    },
    RESOLVED: {
      badge: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
      dot: 'bg-emerald-500',
    },
    LATE: {
      badge: 'bg-rose-50 dark:bg-rose-950/50 text-[#D32F2F] dark:text-rose-300 border-rose-200 dark:border-rose-800/60',
      dot: 'bg-[#D32F2F]',
    },
    HALF_DAY: {
      badge: 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
      dot: 'bg-amber-500',
    },
    MISSING_CLOCK_OUT: {
      badge: 'bg-rose-50 dark:bg-rose-950/50 text-[#D32F2F] dark:text-rose-300 border-rose-200 dark:border-rose-800/60',
      dot: 'bg-[#D32F2F]',
    },
    REJECTED: {
      badge: 'bg-rose-50 dark:bg-rose-950/50 text-[#D32F2F] dark:text-rose-300 border-rose-200 dark:border-rose-800/60',
      dot: 'bg-[#D32F2F]',
    },
    INACTIVE: {
      badge: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      dot: 'bg-slate-400',
    },
    PENDING: {
      badge: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
      dot: 'bg-amber-500',
    },
    OPEN: {
      badge: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
      dot: 'bg-blue-600',
    },
    ON_LEAVE: {
      badge: 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/60',
      dot: 'bg-sky-500',
    },
    SICK: {
      badge: 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/60',
      dot: 'bg-teal-500',
    },
  };

  const selected = palette[safeStatus] || {
    badge: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${selected.badge}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${selected.dot}`} />
      <span>{safeStatus.replace(/_/g, ' ')}</span>
    </span>
  );
};

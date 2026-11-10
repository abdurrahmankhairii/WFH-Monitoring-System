// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, DollarSign, Save, Settings2, ShieldCheck, X } from 'lucide-react';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { CompanyPolicyRecord, StandardApiResponse, WfhWorkflowMode } from '../../types';

interface CompanyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (policy: CompanyPolicyRecord) => void;
}

// Feature: Enterprise WFH & Overtime Policy Configuration — Purpose: Enables HR Admin and System Admin to toggle WFH workflow mode (Strict Approval vs Notice Only) and Overtime Pay calculation.
// OOP: Reusable Modal Component (Encapsulated Configuration View) — Connected To: GET /api/system/policy and PATCH /api/system/policy -> api-gateway system.controller.ts.
export const CompanyPolicyModal: React.FC<CompanyPolicyModalProps> = ({ isOpen, onClose, onSaved }) => {
  const { notifyApiResponse, showToast } = useToast();
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const [wfhWorkflowMode, setWfhWorkflowMode] = useState<WfhWorkflowMode>('STRICT_APPROVAL');
  const [enableOvertime, setEnableOvertime] = useState<boolean>(true);
  const [maxWfhDaysPerWeek, setMaxWfhDaysPerWeek] = useState<number>(1);
  const [policyMeta, setPolicyMeta] = useState<CompanyPolicyRecord | null>(null);

  // Feature: Policy Data Retrieval — Purpose: Loads current system settings from GET /api/system/policy whenever the modal opens.
  // OOP: Lifecycle Hook Handler — Connected To: GET /api/system/policy -> api-gateway system.controller.ts.
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    apiClient
      .get<StandardApiResponse<CompanyPolicyRecord> | CompanyPolicyRecord>('/system/policy')
      .then((res) => {
        const payload = 'data' in res.data && res.data.data ? (res.data.data as CompanyPolicyRecord) : (res.data as CompanyPolicyRecord);
        if (payload) {
          setPolicyMeta(payload);
          setWfhWorkflowMode(payload.wfhWorkflowMode || 'STRICT_APPROVAL');
          setEnableOvertime(payload.enableOvertime ?? true);
          setMaxWfhDaysPerWeek(payload.maxWfhDaysPerWeek ?? 1);
        }
      })
      .catch((err) => {
        showToast({
          type: 'error',
          where: 'Company Policy - Load Error',
          what: 'Failed to load policy configuration',
          why: err.response?.data?.why || err.message || 'Unable to retrieve settings from server.',
        });
      })
      .finally(() => setLoading(false));
  }, [isOpen, showToast]);

  // Feature: Keyboard Escape Listener — Purpose: Closes the policy modal when the user presses the Escape key.
  // OOP: Event Listener Hook — Connected To: Window keydown event.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Feature: Policy Submission Handler — Purpose: Dispatches PATCH /api/system/policy payload to update enterprise WFH workflow and overtime rules.
  // OOP: Async Form Submission Method — Connected To: PATCH /api/system/policy -> SystemController.updatePolicy().
  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiClient.patch<StandardApiResponse<CompanyPolicyRecord>>('/system/policy', {
        wfhWorkflowMode,
        enableOvertime,
        maxWfhDaysPerWeek: Number(maxWfhDaysPerWeek),
      });
      notifyApiResponse(res.data);
      if (res.data.data) {
        onSaved?.(res.data.data);
      }
      onClose();
    } catch (err: any) {
      showToast({
        type: 'error',
        where: 'Company Policy - Save Error',
        what: 'Failed to update company policy',
        why: err.response?.data?.why || err.message || 'Server rejected the configuration update.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Configure Company Policy"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 my-auto">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0A2D62] text-white flex items-center justify-center shadow-sm">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Company Policy &amp; Attendance Configuration
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Admin Control
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Customize enterprise WFH approval workflow and overtime calculation rules
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

        {/* Content Form */}
        <form onSubmit={handleSavePolicy} className="p-5 sm:p-6 space-y-5">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
              Loading current enterprise policy configuration...
            </div>
          ) : (
            <>
              {/* Feature 1: WFH Workflow Mode */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-900 dark:text-slate-100">
                    1. WFH Approval Workflow Mode *
                  </label>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Controls whether manager pre-approval is mandatory
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Strict Approval Option */}
                  <label
                    className={`relative flex flex-col p-4 rounded-xl border cursor-pointer transition-all ${
                      wfhWorkflowMode === 'STRICT_APPROVAL'
                        ? 'bg-blue-50/70 dark:bg-blue-950/40 border-[#0A2D62] dark:border-blue-500 ring-2 ring-blue-500/20'
                        : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="wfhWorkflowMode"
                      value="STRICT_APPROVAL"
                      checked={wfhWorkflowMode === 'STRICT_APPROVAL'}
                      onChange={() => setWfhWorkflowMode('STRICT_APPROVAL')}
                      className="sr-only"
                    />
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        Strict Approval Required
                      </span>
                      {wfhWorkflowMode === 'STRICT_APPROVAL' && (
                        <CheckCircle2 className="w-4 h-4 text-[#0A2D62] dark:text-blue-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      Standard corporate governance. Employees submit a WFH request which must be formally reviewed and
                      approved by the Department Manager before Clock-In unlocks.
                    </p>
                    <span className="mt-2 text-[10px] font-semibold text-blue-800 dark:text-blue-300 bg-blue-100/70 dark:bg-blue-950/70 px-2 py-0.5 rounded self-start">
                      Recommended for Governance
                    </span>
                  </label>

                  {/* Notice Only Option */}
                  <label
                    className={`relative flex flex-col p-4 rounded-xl border cursor-pointer transition-all ${
                      wfhWorkflowMode === 'NOTICE_ONLY'
                        ? 'bg-blue-50/70 dark:bg-blue-950/40 border-[#0A2D62] dark:border-blue-500 ring-2 ring-blue-500/20'
                        : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="wfhWorkflowMode"
                      value="NOTICE_ONLY"
                      checked={wfhWorkflowMode === 'NOTICE_ONLY'}
                      onChange={() => setWfhWorkflowMode('NOTICE_ONLY')}
                      className="sr-only"
                    />
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        Notice / Notification Only
                      </span>
                      {wfhWorkflowMode === 'NOTICE_ONLY' && (
                        <CheckCircle2 className="w-4 h-4 text-[#0A2D62] dark:text-blue-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      Flexible notification flow. Employees preview and dispatch an email notice to Manager &amp; HRD,
                      which immediately unlocks Clock-In without waiting for manual approval.
                    </p>
                    <span className="mt-2 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/70 px-2 py-0.5 rounded self-start">
                      Fast Track • Auto Unlock
                    </span>
                  </label>
                </div>
              </div>

              {/* Feature 2: Overtime Calculation Toggle */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-900 dark:text-slate-100">
                    2. Overtime Pay Calculation Policy *
                  </label>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Controls whether overtime rate &amp; earnings are calculated
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Overtime Enabled Option */}
                  <label
                    className={`relative flex flex-col p-4 rounded-xl border cursor-pointer transition-all ${
                      enableOvertime
                        ? 'bg-blue-50/70 dark:bg-blue-950/40 border-[#0A2D62] dark:border-blue-500 ring-2 ring-blue-500/20'
                        : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="enableOvertime"
                      value="true"
                      checked={enableOvertime}
                      onChange={() => setEnableOvertime(true)}
                      className="sr-only"
                    />
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        Enabled (PP No. 35/2021)
                      </span>
                      {enableOvertime && (
                        <CheckCircle2 className="w-4 h-4 text-[#0A2D62] dark:text-blue-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      Hours worked beyond 17:30 WIB are calculated with Indonesian statutory 1/173 hourly rate (1.5x first
                      hour, 2.0x subsequent) and included in payroll export streams.
                    </p>
                    <span className="mt-2 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/70 px-2 py-0.5 rounded self-start">
                      Active Payroll Multiplier
                    </span>
                  </label>

                  {/* Overtime Disabled Option */}
                  <label
                    className={`relative flex flex-col p-4 rounded-xl border cursor-pointer transition-all ${
                      !enableOvertime
                        ? 'bg-blue-50/70 dark:bg-blue-950/40 border-[#0A2D62] dark:border-blue-500 ring-2 ring-blue-500/20'
                        : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="enableOvertime"
                      value="false"
                      checked={!enableOvertime}
                      onChange={() => setEnableOvertime(false)}
                      className="sr-only"
                    />
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        Disabled (No Overtime Pay)
                      </span>
                      {!enableOvertime && (
                        <CheckCircle2 className="w-4 h-4 text-[#0A2D62] dark:text-blue-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      Follows standard fixed monthly salary without overtime compensation. Overtime rates are hidden,
                      overtime requests are disabled, and overtime earnings calculate to Rp 0.
                    </p>
                    <span className="mt-2 text-[10px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded self-start">
                      Fixed Salary Rules
                    </span>
                  </label>
                </div>
              </div>

              {/* Feature 3: Max WFH Days Per Week */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-semibold text-slate-900 dark:text-slate-100">
                  3. Maximum Hybrid WFH Days Per Week *
                </label>
                <div className="flex items-center gap-3">
                  <select
                    value={maxWfhDaysPerWeek}
                    onChange={(e) => setMaxWfhDaysPerWeek(Number(e.target.value))}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-600"
                  >
                    <option value={1}>1 Day / Week (Standard Dexa Group Policy)</option>
                    <option value={2}>2 Days / Week (Flexible Hybrid)</option>
                    <option value={3}>3 Days / Week (Extended Remote)</option>
                    <option value={4}>4 Days / Week</option>
                    <option value={5}>5 Days / Week (Full Remote)</option>
                  </select>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Defines the quota enforcement cap per calendar week (Monday to Sunday)
                  </span>
                </div>
              </div>

              {/* Last Updated Meta */}
              {policyMeta && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Last updated by:{' '}
                    <strong className="text-slate-700 dark:text-slate-300 font-mono">
                      {policyMeta.updatedByEmail || 'System Default'}
                    </strong>
                  </span>
                  {policyMeta.updatedAt && (
                    <span>Updated at: {new Date(policyMeta.updatedAt).toLocaleString('id-ID')}</span>
                  )}
                </div>
              )}
            </>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200/70 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="taste-btn inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0A2D62] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving Policy...' : 'Save Company Policy'}</span>
            </button>
          </div>
        </form>

        {/* Mandatory Watermark Footer */}
        <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200/70 dark:border-slate-800 text-[10px] text-center text-slate-400">
          © 2026 Abdurrahman Khairi - Created strictly for Technical Assessment evaluation. Unauthorized commercial use is prohibited
        </div>
      </div>
    </div>
  );
};

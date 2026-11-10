// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React, { useEffect, useState } from 'react';
import { CheckCircle2, LifeBuoy, Mail, Send, X } from 'lucide-react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StandardApiResponse, SupportCategory, SupportTicketRecord } from '../../types';
import { StatusBadge } from './InteractiveDataTable';

interface ContactDeveloperModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultModuleLocation?: string;
}

// Feature: Contact Developer Support via SMTP — Purpose: Custom modal for dispatching support emails to System Admin and HRD Admin via SMTP.
// OOP: Reusable UI Component (Encapsulated View & State) — Connected To: Submits to POST /api/support/contact-developer -> employee-service SupportService & MailService.
export const ContactDeveloperModal: React.FC<ContactDeveloperModalProps> = ({
  isOpen,
  onClose,
  defaultModuleLocation = 'WFH Attendance Portal',
}) => {
  const { user, isAdmin } = useAuth();
  const { notifyApiResponse } = useToast();
  const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose');
  const [category, setCategory] = useState<SupportCategory>('ATTENDANCE_ISSUE');
  const [moduleLocation, setModuleLocation] = useState<string>(defaultModuleLocation);
  const [subject, setSubject] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [loadingTickets, setLoadingTickets] = useState<boolean>(false);

  // Feature: Contact Developer Support via SMTP — Purpose: Loads support ticket history from GET /api/support/tickets when the history tab is active.
  // OOP: Reusable UI Component (Encapsulated View & State) — Connected To: SupportController.getTickets() on api-gateway.
  const loadTickets = async () => {
    setLoadingTickets(true);
    try {
      const res = await apiClient.get<StandardApiResponse<SupportTicketRecord[]>>('/support/tickets', {
        // @ts-expect-error silent background load
        silentToast: true,
      });
      setTickets(res.data.data || []);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'history') {
      void loadTickets();
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !user) return null;

  // Feature: Contact Developer Support via SMTP — Purpose: Dispatches the support message via POST /api/support/contact-developer where sender = user.email.
  // OOP: Reusable UI Component (Encapsulated View & State) — Connected To: SupportController.contactDeveloper() on api-gateway.
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiClient.post<StandardApiResponse<SupportTicketRecord>>('/support/contact-developer', {
        category,
        moduleLocation,
        subject,
        message,
      });
      notifyApiResponse(res.data);
      setSubject('');
      setMessage('');
      setActiveTab('history');
      void loadTickets();
    } finally {
      setSubmitting(false);
    }
  };

  // Feature: Contact Developer Support via SMTP — Purpose: Allows HRD Admin or System Admin to resolve an open support ticket from the ticket log tab.
  // OOP: Reusable UI Component (Encapsulated View & State) — Connected To: PATCH /api/support/tickets/:id/resolve.
  const handleResolve = async (ticketId: string) => {
    const res = await apiClient.patch<StandardApiResponse<SupportTicketRecord>>(
      `/support/tickets/${ticketId}/resolve`,
    );
    notifyApiResponse(res.data);
    void loadTickets();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Contact Developer Support"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-700/80">
        <div className="h-1 bg-gradient-to-r from-[#D32F2F] via-[#0A2D62] to-blue-600" />
        <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-[#D32F2F] dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-800/60">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Contact Developer &amp; Technical Support
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Routed directly to System Admin (TO) and HRD Admin (CC) with your account as sender
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close support modal"
            className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('compose')}
            className={`pb-3 border-b-2 transition-colors ${
              activeTab === 'compose'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Send Support Message
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-3 border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {isAdmin ? 'All Support Tickets (Admin)' : 'My Submitted Tickets'}
          </button>
        </div>

        {activeTab === 'compose' ? (
          <form onSubmit={handleSend} className="p-5 sm:p-6 space-y-4">
            {/* Locked Sender Account Email Banner */}
            <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/50 flex items-center gap-3 text-xs">
              <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <div>
                <div className="text-[11px] font-medium text-blue-800 dark:text-blue-300">
                  Authenticated Sender (From &amp; Reply-To)
                </div>
                <div className="font-sans font-semibold text-slate-900 dark:text-slate-100">
                  &quot;{user.fullName}&quot; &lt;{user.email}&gt;
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Issue Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SupportCategory)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:border-blue-600 focus:outline-none"
                >
                  <option value="ATTENDANCE_ISSUE">WFH Attendance / Camera Issue</option>
                  <option value="ACCOUNT_ACCESS">Account Access / OTP / Role</option>
                  <option value="BUG">System Bug Report</option>
                  <option value="OTHER">General Inquiry / Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Module / Page Location *
                </label>
                <input
                  type="text"
                  required
                  value={moduleLocation}
                  onChange={(e) => setModuleLocation(e.target.value)}
                  placeholder="e.g. WFH Clock-In Page"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Subject *</label>
              <input
                type="text"
                required
                minLength={5}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of the assistance needed..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Detailed Message (min. 10 chars) *
              </label>
              <textarea
                required
                minLength={10}
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe what happened, why you need assistance, and any error details..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="taste-btn inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0A2D62] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? 'Dispatching Email...' : `Send from ${user.email}`}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5 sm:p-6 space-y-3">
            {loadingTickets ? (
              <div className="text-xs text-slate-500 py-8 text-center">Loading support tickets...</div>
            ) : tickets.length === 0 ? (
              <div className="text-xs text-slate-500 py-8 text-center">No support tickets recorded yet.</div>
            ) : (
              tickets.map((t) => (
                <div
                  key={t.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-sans tabular-nums text-[11px] font-semibold text-blue-700 dark:text-blue-400">
                        #{t.id.slice(0, 8).toUpperCase()}
                      </span>
                      <StatusBadge status={t.status} />
                      <span className="px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-700 text-[10px] font-medium text-slate-700 dark:text-slate-300">
                        {t.category.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {isAdmin && t.status === 'OPEN' && (
                      <button
                        type="button"
                        onClick={() => void handleResolve(t.id)}
                        className="taste-btn inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Mark Resolved</span>
                      </button>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t.subject}</div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{t.message}</p>
                  <div className="text-[11px] text-slate-400 font-sans">
                    Sender: {t.senderName} &lt;{t.senderEmail}&gt; • Module: {t.moduleLocation}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

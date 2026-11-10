// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { apiClient } from '../../api/client';
import { CopyrightFooterWatermark } from '../../components/custom/CopyrightFooterWatermark';
import { DexaBrandLogo } from '../../components/custom/DexaBrandLogo';
import { ThemeToggle } from '../../components/custom/ThemeToggle';
import { useToast } from '../../context/ToastContext';
import { DepartmentRecord, StandardApiResponse } from '../../types';

// Feature: Public Onboarding Access Request — Purpose: Public onboarding form where new employees can request WFH system access for HRD Admin review and approval.
// OOP: Presentation Page Component (View Layer Composition) — Connected To: Submits to POST /api/auth/request-access -> employee-service AccessRequestsService.create().
export const RequestAccessPage: React.FC = () => {
  const navigate = useNavigate();
  const { notifyApiResponse } = useToast();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(false);

  // Feature: Public Department Directory — Purpose: Loads active departments from database table department to populate the registration dropdown.
  // OOP: State Synchronization Hook (Observer & Lifecycle Management) — Connected To: GET /api/auth/departments -> backend AuthController.getDepartments().
  useEffect(() => {
    let isMounted = true;
    setLoadingDepts(true);
    apiClient
      .get<StandardApiResponse<DepartmentRecord[]>>('/auth/departments')
      .then((res) => {
        if (isMounted && res.data?.data) {
          setDepartments(res.data.data);
        }
      })
      .catch(() => {
        // Keeps empty array gracefully if network error
      })
      .finally(() => {
        if (isMounted) setLoadingDepts(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Feature: Public Onboarding Access Request — Purpose: Sends the access request to the backend and notifies the user with a bottom-right green toast.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: POST /api/auth/request-access.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiClient.post<StandardApiResponse>('/auth/request-access', {
        fullName,
        email,
        employeeCode: employeeCode || undefined,
        department,
        position,
        phoneNumber: phoneNumber || undefined,
        reason: reason || undefined,
      });
      notifyApiResponse(res.data);
      navigate('/login');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-[#f8f8f6] dark:bg-[#0b1120] transition-colors duration-200 overflow-hidden">
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat transition-all duration-300 dark:brightness-75"
        style={{ backgroundImage: "url('/background-dexa.png')" }}
      />
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 bg-transparent dark:bg-slate-950/70 transition-colors duration-300"
      />
      <div className="relative z-10 flex-1 flex items-center justify-center lg:justify-start p-4 sm:p-8 lg:pl-16 xl:pl-24">
        <div className="w-full max-w-[460px]">
          <div className="bg-white/95 dark:bg-[#0F141C]/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/90 dark:border-white/10 overflow-hidden">
          <div className="p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between">
              <DexaBrandLogo variant="auto" size="sm" showSubtitle={false} />
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Login</span>
                </Link>
              </div>
            </div>

            <div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
                Request an Account
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Submit your employee details below. Once HRD approves your request, a 6-digit activation code will be sent to your email.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Input your full name"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Corporate Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Input your corporate email"
                    className="w-full pl-3.5 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Employee Code / NIP (Optional)
                  </label>
                  <input
                    type="text"
                    value={employeeCode}
                    onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                    placeholder="Input your employee code / NIP (optional)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-sans tabular-nums focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Input your phone number"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-sans tabular-nums focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Department *
                  </label>
                  <select
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    disabled={loadingDepts}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:border-blue-600 focus:outline-none disabled:opacity-50"
                  >
                    <option value="" disabled>
                      {loadingDepts ? 'Loading departments...' : 'Select Department'}
                    </option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Position / Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="Input your position / title"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Onboarding Notes / Reason
                </label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Input your onboarding notes or reason..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="taste-btn w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#0A2D62] hover:bg-blue-900 dark:bg-[#1D4ED8] dark:hover:bg-blue-700 text-white text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'Submitting...' : 'Submit Request'}</span>
              </button>
            </form>

            <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Already have an account? </span>
              <Link
                to="/login"
                className="text-slate-700 dark:text-slate-200 hover:text-[#0A2D62] dark:hover:text-blue-400 hover:underline"
              >
                Sign in
              </Link>
            </div>
            </div>
          </div>
          <CopyrightFooterWatermark variant="auth" />
        </div>
      </div>
    </div>
  );
};

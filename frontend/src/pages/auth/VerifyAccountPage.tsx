// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Lock, Mail, RefreshCw } from 'lucide-react';
import { apiClient } from '../../api/client';
import { CopyrightFooterWatermark } from '../../components/custom/CopyrightFooterWatermark';
import { DexaBrandLogo } from '../../components/custom/DexaBrandLogo';
import { OtpInputGroup } from '../../components/custom/OtpInputGroup';
import { ThemeToggle } from '../../components/custom/ThemeToggle';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StandardApiResponse, UserProfile } from '../../types';

// Feature: New Account Email OTP Verification — Purpose: Activates a newly provisioned employee account using the 6-digit email OTP and sets their personal password.
// OOP: Presentation Page Component (View Layer Composition) — Connected To: Submits to POST /api/auth/verify-account and POST /api/auth/resend-verification.
export const VerifyAccountPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { establishSession } = useAuth();
  const { notifyApiResponse } = useToast();

  const [email, setEmail] = useState(searchParams.get('email') || 'nadia.putri@dexagroup.com');
  const [otp, setOtp] = useState(searchParams.get('otp') || '123456');
  const [newPassword, setNewPassword] = useState('EmployeeDexa2026!');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Feature: New Account Email OTP Verification — Purpose: Verifies the 6-digit OTP and logs the user into their newly activated account.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: POST /api/auth/verify-account.
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiClient.post<
        StandardApiResponse<{ accessToken: string; refreshToken: string; user: UserProfile }>
      >('/auth/verify-account', {
        email,
        otp,
        newPassword,
      });
      notifyApiResponse(res.data);
      const data = res.data.data!;
      establishSession(data);
      navigate(
        data.user.employeeId && !data.user.isFaceEnrolled
          ? '/auth/enroll-face'
          : data.user.role === 'HR_ADMIN' || data.user.role === 'SYSTEM_ADMIN'
            ? '/hrd/dashboard'
            : '/employee/attendance',
        { replace: true },
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Feature: New Account Email OTP Verification — Purpose: Requests a fresh 6-digit verification OTP email for the specified address.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: POST /api/auth/resend-verification.
  const handleResendOtp = async () => {
    if (!email) return;
    setResending(true);
    try {
      const res = await apiClient.post<StandardApiResponse<{ demoOtpHint?: string }>>('/auth/resend-verification', {
        email,
      });
      notifyApiResponse(res.data);
      if (res.data.data?.demoOtpHint) {
        setOtp(res.data.data.demoOtpHint);
      }
    } finally {
      setResending(false);
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
        <div className="w-full max-w-[436px]">
          <div className="bg-white/95 dark:bg-[#0F141C]/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/90 dark:border-white/10 overflow-hidden">
          <div className="p-6 sm:p-8 space-y-6">
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
                Activate with OTP
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Enter the 6-digit code sent to your email after HRD approval and set your password.
              </p>
            </div>

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Registered Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    6-Digit Verification OTP
                  </label>
                  <button
                    type="button"
                    disabled={resending}
                    onClick={() => void handleResendOtp()}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700"
                  >
                    <RefreshCw className={`w-3 h-3 ${resending ? 'animate-spin' : ''}`} />
                    <span>{resending ? 'Sending...' : 'Resend OTP'}</span>
                  </button>
                </div>
                <OtpInputGroup value={otp} onChange={setOtp} />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Set Account Password (min. 8 chars, letter + number)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || otp.length !== 6}
                className="taste-btn w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#0A2D62] hover:bg-blue-900 dark:bg-[#1D4ED8] dark:hover:bg-blue-700 text-white text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{submitting ? 'Activating...' : 'Activate Account'}</span>
              </button>
            </form>

            <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Don&apos;t have an account yet? </span>
              <Link
                to="/request-access"
                className="text-slate-700 dark:text-slate-200 hover:text-[#0A2D62] dark:hover:text-blue-400 hover:underline"
              >
                Request an account
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

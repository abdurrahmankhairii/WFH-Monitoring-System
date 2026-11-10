// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Eye, EyeOff, Lock, Mail, RefreshCw, Zap } from 'lucide-react';
import { apiClient } from '../../api/client';
import { CopyrightFooterWatermark } from '../../components/custom/CopyrightFooterWatermark';
import { DexaBrandLogo } from '../../components/custom/DexaBrandLogo';
import { LiveServerClock } from '../../components/custom/LiveServerClock';
import { OtpInputGroup } from '../../components/custom/OtpInputGroup';
import { ThemeToggle } from '../../components/custom/ThemeToggle';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StandardApiResponse, UserProfile } from '../../types';

// Feature: Daily Email & Password Authentication — Purpose: Single-door enterprise sign-in screen that logs in verified users directly and triggers inline 6-digit OTP verification for first-time new users.
// OOP: Presentation Page Component (View Layer Composition) — Connected To: Submits to POST /api/auth/login and POST /api/auth/verify-account -> employee-service AuthService.
export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { establishSession } = useAuth();
  const { notifyApiResponse, showToast } = useToast();

  const [step, setStep] = useState<'login' | 'verify-otp'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showQuickFill, setShowQuickFill] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Feature: Daily Email & Password Authentication — Purpose: Submits email and password to POST /api/auth/login; routes verified users or switches to inline OTP step for new accounts.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: AuthContext.establishSession() and ToastContext.notifyApiResponse().
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiClient.post<
        StandardApiResponse<{
          accessToken?: string;
          refreshToken?: string;
          user?: UserProfile;
          requiresVerification?: boolean;
          demoOtpHint?: string;
        }>
      >('/auth/login', { email, password });

      notifyApiResponse(res.data);
      const data = res.data.data;

      if (data?.requiresVerification) {
        setOtp(data.demoOtpHint || '');
        setStep('verify-otp');
        return;
      }

      if (data?.accessToken && data?.user && data?.refreshToken) {
        establishSession({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user,
        });
        if (data.user.role === 'SYSTEM_ADMIN') {
          navigate('/system/database', { replace: true });
        } else if (data.user.employeeId && !data.user.isFaceEnrolled) {
          navigate('/auth/enroll-face', { replace: true });
        } else if (data.user.role === 'HR_ADMIN') {
          navigate('/hrd/dashboard', { replace: true });
        } else if (data.user.role === 'MANAGER') {
          navigate('/manager/approvals', { replace: true });
        } else {
          navigate('/employee/attendance', { replace: true });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Feature: First-Time New User OTP Verification — Purpose: Verifies the 6-digit OTP dispatched on first login, activates the new account, and establishes the JWT session.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: POST /api/auth/verify-account -> employee-service AuthService.verifyAccount().
  const handleVerifyFirstLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiClient.post<
        StandardApiResponse<{ accessToken: string; refreshToken: string; user: UserProfile }>
      >('/auth/verify-account', {
        email,
        otp,
        newPassword: password,
      });
      notifyApiResponse(res.data);
      const data = res.data.data;
      if (data?.accessToken && data?.user) {
        establishSession(data);
        if (data.user.role === 'SYSTEM_ADMIN') {
          navigate('/system/database', { replace: true });
        } else if (data.user.employeeId && !data.user.isFaceEnrolled) {
          navigate('/auth/enroll-face', { replace: true });
        } else if (data.user.role === 'HR_ADMIN') {
          navigate('/hrd/dashboard', { replace: true });
        } else if (data.user.role === 'MANAGER') {
          navigate('/manager/approvals', { replace: true });
        } else {
          navigate('/employee/attendance', { replace: true });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Feature: First-Time New User OTP Verification — Purpose: Re-sends a fresh 6-digit verification OTP to the new user's email address.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: POST /api/auth/resend-verification.
  const handleResendOtp = async () => {
    if (!email) return;
    setResending(true);
    try {
      const res = await apiClient.post<StandardApiResponse<{ demoOtpHint?: string }>>(
        '/auth/resend-verification',
        { email },
      );
      notifyApiResponse(res.data);
      if (res.data.data?.demoOtpHint) {
        setOtp(res.data.data.demoOtpHint);
      }
    } finally {
      setResending(false);
    }
  };

  // Feature: Daily Email & Password Authentication — Purpose: Populates demo credentials with one click for fast technical evaluation testing.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: Evaluation role preset pills on LoginPage.
  const fillDemoAccount = (demoEmail: string, demoPassword: string, label: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    showToast({
      type: 'info',
      where: 'Login • Role Preset',
      what: `Loaded ${label} credentials`,
      why: `Filled ${demoEmail}. Click Sign In to continue.`,
    });
  };

  const presets = [
    {
      role: 'System Admin',
      email: 'sysadmin@dexagroup.com',
      password: 'AdminDexa2026!',
    },
    {
      role: 'HRD Admin',
      email: 'admin.hrd@dexagroup.com',
      password: 'AdminDexa2026!',
    },
    {
      role: 'IT Manager',
      email: 'manager.it@dexagroup.com',
      password: 'ManagerDexa2026!',
    },
    {
      role: 'Employee One',
      email: 'employee.one@dexagroup.com',
      password: 'EmployeeDexa2026!',
    },
  ];

  return (
    <div className="relative min-h-screen flex flex-col bg-[#f8f8f6] dark:bg-[#0b1120] transition-colors duration-200 overflow-hidden">
      {/* Full-Bleed Corporate Background Image (Unobstructed on Right) */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat transition-all duration-300 dark:brightness-75"
        style={{ backgroundImage: "url('/background-dexa.png')" }}
      />
      {/* Dark-Mode Translucent Darkening Layer */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 bg-transparent dark:bg-slate-950/70 transition-colors duration-300"
      />

      <div className="relative z-10 flex-1 flex items-center justify-center lg:justify-start p-4 sm:p-8 lg:pl-16 xl:pl-24">
        <div className="w-full max-w-[440px]">
          <div className="rounded-2xl overflow-hidden shadow-xl border border-slate-200/90 dark:border-white/10 bg-white/95 dark:bg-[#0F141C]/95 backdrop-blur-md p-6 sm:p-7 space-y-5 text-slate-900 dark:text-slate-100">
            {/* Card Header: Official Dexa Logo Left + Theme Toggle Right */}
            <div className="flex items-center justify-between gap-3">
              <DexaBrandLogo variant="auto" size="md" showSubtitle />
              <ThemeToggle />
            </div>

            {/* Compact Server Time Banner */}
            <LiveServerClock variant="auth-banner" />

            {step === 'login' ? (
              <>
                {/* Sign In Heading */}
                <div>
                  <h1 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
                    Sign In
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Enter your corporate email and password to access the portal.
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Corporate Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@dexagroup.com"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Password</label>
                      <Link
                        to="/forgot-password"
                        className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
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
                    disabled={loading}
                    className="taste-btn w-full py-2.5 px-5 rounded-xl bg-[#0A2D62] hover:bg-blue-900 dark:bg-[#1D4ED8] dark:hover:bg-blue-700 text-white text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Signing in...' : 'Sign In'}
                  </button>
                </form>

                <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span>Need access? </span>
                  <Link
                    to="/request-access"
                    className="text-slate-700 dark:text-slate-200 hover:text-[#0A2D62] dark:hover:text-blue-400 hover:underline"
                  >
                    Request an account
                  </Link>
                </div>

                {/* Technical Assessment Quick-Fill Collapsible */}
                <div className="pt-1 border-t border-slate-100 dark:border-slate-800/60">
                  <button
                    type="button"
                    onClick={() => setShowQuickFill((prev) => !prev)}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span>Technical Assessment Quick-Fill</span>
                    </span>
                    {showQuickFill ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {showQuickFill && (
                    <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-[#151D28] border border-slate-200/80 dark:border-white/10 space-y-2">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                        Click a pre-seeded evaluation account to populate credentials:
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {presets.map((preset) => {
                          const isActive = email.toLowerCase() === preset.email.toLowerCase();
                          return (
                            <button
                              key={preset.role}
                              type="button"
                              onClick={() => fillDemoAccount(preset.email, preset.password, preset.role)}
                              className={`taste-btn px-2.5 py-1.5 rounded-lg text-xs font-medium border text-left transition-colors truncate ${
                                isActive
                                  ? 'bg-[#0A2D62] text-white border-[#0A2D62] dark:bg-[#1D4ED8] dark:border-blue-500/30'
                                  : 'bg-white dark:bg-[#0F141C] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                              }`}
                            >
                              <div className="font-semibold truncate">{preset.role}</div>
                              <div className="text-[10px] opacity-75 truncate">{preset.email.split('@')[0]}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
                      Verify First-Time Login
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      We sent a 6-digit OTP to <span className="font-medium text-slate-700 dark:text-slate-200">{email}</span>. Enter it below to activate your new account.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleVerifyFirstLoginOtp} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        6-Digit Verification OTP
                      </label>
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={resending}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${resending ? 'animate-spin' : ''}`} />
                        <span>Resend code</span>
                      </button>
                    </div>
                    <OtpInputGroup value={otp} onChange={setOtp} disabled={loading} />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Confirm Account Password (min. 8 chars)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
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
                    disabled={loading || otp.length !== 6}
                    className="taste-btn w-full inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-[#0A2D62] hover:bg-blue-900 dark:bg-[#1D4ED8] dark:hover:bg-blue-700 text-white text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{loading ? 'Verifying & Signing In...' : 'Verify OTP & Sign In'}</span>
                  </button>
                </form>

                <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 text-center">
                  <button
                    type="button"
                    onClick={() => setStep('login')}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-[#0A2D62] dark:hover:text-blue-400"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Sign In</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <CopyrightFooterWatermark variant="auth" />
        </div>
      </div>
    </div>
  );
};

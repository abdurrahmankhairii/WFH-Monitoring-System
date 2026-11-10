// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React, { useState } from 'react';
import {
  Compass,
  Eye,
  EyeOff,
  Home,
  KeyRound,
  Lock,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  ShieldCheck,
  UserCircle,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { StatusBadge } from '../components/custom/InteractiveDataTable';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { StandardApiResponse } from '../types';

// Feature: Self-Service Employee Profile & Password Security — Purpose: Allows any logged-in user to update their contact details, registered home geofence coordinates, and change their account password.
// OOP: Presentation Page Component (View Layer Composition) — Connected To: Calls PATCH /api/employees/me/profile and POST /api/auth/change-password.
export const ProfilePage: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const { notifyApiResponse, showToast } = useToast();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [homeAddress, setHomeAddress] = useState(user?.homeAddress || '');
  const [homeLatitude, setHomeLatitude] = useState<number | null>(user?.homeLatitude ?? null);
  const [homeLongitude, setHomeLongitude] = useState<number | null>(user?.homeLongitude ?? null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [updatingGps, setUpdatingGps] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  if (!user) return null;

  // Feature: Self-Service Employee Profile & Password Security — Purpose: Saves updated profile details via PATCH /api/employees/me/profile and refreshes AuthContext.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: EmployeesController.updateMyProfile() on api-gateway.
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await apiClient.patch<StandardApiResponse<{ homeAddress?: string }>>('/employees/me/profile', {
        fullName,
        phoneNumber,
        homeAddress,
        homeLatitude,
        homeLongitude,
      });
      notifyApiResponse(res.data);
      if (res.data.data?.homeAddress) {
        setHomeAddress(res.data.data.homeAddress);
      }
      await refreshProfile(true);
    } finally {
      setSavingProfile(false);
    }
  };

  // Feature: Geolocation Tagging & Geofencing — Purpose: Automatically captures browser GPS hardware coordinates and registers them as the employee's authoritative WFH residence.
  // OOP: Presentation Event Handler — Connected To: PATCH /api/employees/me/profile with live device coordinates.
  const handleSetHomeFromDeviceGps = async () => {
    if (!navigator.geolocation) {
      showToast({
        type: 'error',
        where: 'Profile & Security • Home Geofence',
        what: 'Geolocation is not supported by your browser',
        why: 'Please use a modern browser with HTML5 Geolocation API support.',
      });
      return;
    }

    setUpdatingGps(true);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => {
        navigator.geolocation.getCurrentPosition(res, rej, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      setHomeLatitude(lat);
      setHomeLongitude(lon);

      // Save immediately to backend so registered home updates instantly
      const res = await apiClient.patch<StandardApiResponse<{ homeAddress?: string }>>('/employees/me/profile', {
        homeLatitude: lat,
        homeLongitude: lon,
      });

      notifyApiResponse(res.data);
      await refreshProfile(true);
      if (res.data.data?.homeAddress) {
        setHomeAddress(res.data.data.homeAddress);
      }
    } catch (err) {
      showToast({
        type: 'error',
        where: 'Profile & Security • Home Geofence',
        what: 'Failed to acquire device GPS location',
        why: (err as GeolocationPositionError)?.message || 'Please check that location permission is granted in your browser.',
      });
    } finally {
      setUpdatingGps(false);
    }
  };

  // Feature: Self-Service Employee Profile & Password Security — Purpose: Updates the logged-in user's password via POST /api/auth/change-password.
  // OOP: Presentation Page Component (View Layer Composition) — Connected To: AuthController.changePassword() on api-gateway.
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    try {
      const res = await apiClient.post<StandardApiResponse>('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      notifyApiResponse(res.data);
      setCurrentPassword('');
      setNewPassword('');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-sans text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
          My Profile &amp; Security Settings
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          View your corporate identity, role permissions, and manage your contact details, registered home geofence, and password
        </p>
      </div>

      {/* Identity Card */}
      <div className="taste-card bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#0A2D62] dark:bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-sm">
            {user.fullName
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{user.fullName}</h2>
              <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-sans tabular-nums text-xs font-medium">
                {user.employeeCode || 'EMP'}
              </span>
              <StatusBadge status={user.status} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {user.department} • {user.position} • <span className="font-sans">{user.email}</span>
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4" />
          <span>Role: {user.role}</span>
        </div>
      </div>

      {/* Registered WFH Home Residence & Geofence Section */}
      <div className="taste-card bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Home className="w-5 h-5 text-[#D32F2F]" />
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Registered WFH Home Residence &amp; Geofence
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Authoritative reference coordinates used by the system to evaluate your 100-meter WFH geofence limit.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSetHomeFromDeviceGps}
            disabled={updatingGps}
            className="taste-btn inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50 transition-colors"
          >
            {updatingGps ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Compass className="w-3.5 h-3.5" />
            )}
            <span>{updatingGps ? 'Acquiring GPS...' : 'Set Home from Current Device GPS'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
          <div className="md:col-span-8 space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Current Registered Coordinates:
              </span>
              <span className="text-xs font-mono text-slate-600 dark:text-slate-400 tabular-nums">
                {homeLatitude !== null && homeLongitude !== null
                  ? `${homeLatitude.toFixed(6)}, ${homeLongitude.toFixed(6)}`
                  : 'Coordinates not yet registered'}
              </span>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1.5 pt-0.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <span>
                <strong>Registered Address:</strong>{' '}
                {homeAddress || user.homeAddress || 'Jalan Budhi IX, Kebon Jeruk, Jakarta Barat, Indonesia (Demo Default)'}
              </span>
            </div>
          </div>

          <div className="md:col-span-4 text-xs text-slate-500 dark:text-slate-400 text-right space-y-0.5">
            <div>100m WFH Geofence Rule</div>
            <div className="text-[11px] text-slate-400">Strictly enforced during WFH Clock-In &amp; Clock-Out</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact Details Form */}
        <form
          onSubmit={handleSaveProfile}
          className="taste-card bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center gap-2">
            <UserCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Personal &amp; Contact Information
            </h3>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              minLength={3}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Phone / WhatsApp Number
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+62 812-xxxx-xxxx"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-sans tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Custom Home Address Note (Optional)
            </label>
            <input
              type="text"
              value={homeAddress}
              onChange={(e) => setHomeAddress(e.target.value)}
              placeholder="e.g. Jl. Anggrek No. 12, Kelurahan X"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Corporate Email (Locked to SSO / SMTP Identity)
            </label>
            <input
              type="email"
              disabled
              value={user.email}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm font-sans"
            />
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="taste-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0A2D62] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{savingProfile ? 'Saving Profile...' : 'Save Contact Details'}</span>
          </button>
        </form>

        {/* Change Password Form */}
        <form
          onSubmit={handleChangePassword}
          className="taste-card bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[#D32F2F]" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Change Account Password
            </h3>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Current Password *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                title={showCurrentPassword ? 'Hide password' : 'Show password'}
                aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              New Password (min. 8 chars, letter + number) *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                title={showNewPassword ? 'Hide password' : 'Show password'}
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingPassword}
            className="taste-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            <span>{savingPassword ? 'Updating Password...' : 'Update Password'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

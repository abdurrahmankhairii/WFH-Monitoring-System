// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  USER_PROFILE_KEY,
  apiClient,
} from '../api/client';
import { StandardApiResponse, UserProfile } from '../types';
import { useToast } from './ToastContext';

interface AuthSessionPayload {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isSystemAdmin: boolean;
  establishSession: (payload: AuthSessionPayload) => void;
  refreshProfile: (silent?: boolean) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Feature: Authentication State & Session Lifecycle — Purpose: Manages JWT authentication state, current user RBAC role (`HR_ADMIN` vs `EMPLOYEE`), profile synchronization, and logout.
// OOP: Context Provider Pattern (State Abstraction & Dependency Injection) — Connected To: Wraps `<App />` in `frontend/src/App.tsx`; interacts with `/api/auth/me` and `ToastContext`.
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useToast();
  const [user, setUser] = useState<UserProfile | null>(() => {
    const cached = localStorage.getItem(USER_PROFILE_KEY);
    if (!cached) return null;
    try {
      return JSON.parse(cached) as UserProfile;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Feature: Authentication State & Session Lifecycle — Purpose: Persists JWT tokens and user profile into localStorage and updates React state upon login or account verification.
  // OOP: Context Provider Pattern (State Abstraction & Dependency Injection) — Connected To: Called by LoginPage.tsx and VerifyAccountPage.tsx.
  const establishSession = useCallback((payload: AuthSessionPayload) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(payload.user));
    setUser(payload.user);
  }, []);

  // Feature: Authentication State & Session Lifecycle — Purpose: Fetches the latest user and employee profile from `GET /api/auth/me`.
  // OOP: Context Provider Pattern (State Abstraction & Dependency Injection) — Connected To: Called on initial app mount and from ProfilePage.tsx.
  const refreshProfile = useCallback(async (silent = true) => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await apiClient.get<StandardApiResponse<UserProfile>>('/auth/me', {
        // @ts-expect-error custom flag for silent startup check
        silentToast: silent,
      });
      if (res.data.data) {
        setUser(res.data.data);
        localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(res.data.data));
      }
    } catch {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_PROFILE_KEY);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Feature: Authentication State & Session Lifecycle — Purpose: Clears JWT session tokens and triggers a bottom-right informational toast confirming sign-out.
  // OOP: Context Provider Pattern (State Abstraction & Dependency Injection) — Connected To: Called from the sidebar/header Sign Out button in AppLayout.tsx.
  const logout = useCallback(() => {
    const email = user?.email ?? 'user';
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_PROFILE_KEY);
    setUser(null);
    showToast({
      type: 'info',
      where: 'Auth - Sign Out',
      what: 'Signed out successfully',
      why: 'You have signed out of your account successfully.',
    });
  }, [showToast, user?.email]);

  useEffect(() => {
    void refreshProfile(true);
  }, [refreshProfile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user),
        isAdmin: user?.role === 'HR_ADMIN' || user?.role === 'SYSTEM_ADMIN',
        isManager: user?.role === 'MANAGER',
        isSystemAdmin: user?.role === 'SYSTEM_ADMIN',
        establishSession,
        refreshProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Feature: Authentication State & Session Lifecycle — Purpose: Custom hook to access the current authenticated user, role flags (`isAdmin`), and session actions.
// OOP: Context Provider Pattern (State Abstraction & Dependency Injection) — Connected To: Used across all protected pages, AppLayout, and ProtectedRoute.
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

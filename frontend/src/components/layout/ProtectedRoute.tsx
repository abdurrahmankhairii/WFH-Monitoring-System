// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { UserRole } from '../../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

// Feature: Role-Based Route Guarding (RBAC) & Biometric Gate — Purpose: Enforces authentication, RBAC, and mandatory face biometric enrollment with System Admin SoD bypass.
// OOP: Reusable UI Component (Encapsulated View & State) — Connected To: Used in frontend/src/App.tsx route definitions; reads useAuth() and triggers useToast().
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isLoading, isAuthenticated, isSystemAdmin } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();

  const isRoleForbidden =
    Boolean(user) &&
    Boolean(allowedRoles && allowedRoles.length > 0) &&
    !isSystemAdmin &&
    user!.role !== 'HR_ADMIN' &&
    !allowedRoles!.includes(user!.role);

  // System Admin is dedicated to system administration and bypasses biometric enrollment
  const needsFaceEnrollment =
    Boolean(user) &&
    !isSystemAdmin &&
    Boolean(user!.employeeId) &&
    !user!.isFaceEnrolled &&
    location.pathname !== '/auth/enroll-face';

  // System Admin is restricted from operational employee attendance routes (Separation of Duties)
  const isSysAdminAccessingEmployeeRoute =
    isSystemAdmin &&
    (location.pathname.startsWith('/employee') ||
      location.pathname === '/dashboard' ||
      location.pathname === '/auth/enroll-face');

  useEffect(() => {
    if (needsFaceEnrollment && user) {
      showToast({
        type: 'info',
        where: 'Biometric Security Gate',
        what: 'Face registration required',
        why: 'Dexa Group policy requires all employees to register their facial biometric profile before accessing attendance.',
      });
    } else if (isSysAdminAccessingEmployeeRoute) {
      showToast({
        type: 'info',
        where: 'Separation of Duties',
        what: 'Self-service attendance disabled for System Administrator',
        why: 'System Administrator accounts are dedicated to system control and data management. Please use an Employee or Manager account to record operational attendance.',
      });
    } else if (isRoleForbidden && user) {
      showToast({
        type: 'error',
        where: `Route Guard • ${location.pathname}`,
        what: 'Access restricted to Administrator',
        why: `Your account role (${user.role}) is not permitted to open ${location.pathname}.`,
      });
    }
  }, [isRoleForbidden, needsFaceEnrollment, isSysAdminAccessingEmployeeRoute, location.pathname, showToast, user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-sm font-semibold">
        Verifying JWT session &amp; role permissions...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isSysAdminAccessingEmployeeRoute) {
    return <Navigate to="/system/database" replace />;
  }

  if (needsFaceEnrollment) {
    return <Navigate to="/auth/enroll-face" replace />;
  }

  if (isRoleForbidden) {
    return <Navigate to="/employee/attendance" replace />;
  }

  return <>{children}</>;
};

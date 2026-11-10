// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastContainerBottomRight } from './components/custom/ToastContainerBottomRight';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { FaceEnrollmentPage } from './pages/auth/FaceEnrollmentPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RequestAccessPage } from './pages/auth/RequestAccessPage';
import { VerifyAccountPage } from './pages/auth/VerifyAccountPage';
import { EmployeeAttendancePage } from './pages/employee/EmployeeAttendancePage';
import { EmployeeDashboardPage } from './pages/employee/EmployeeDashboardPage';
import { MyAttendanceHistoryPage } from './pages/employee/MyAttendanceHistoryPage';
import { AttendanceMonitoringPage } from './pages/hrd/AttendanceMonitoringPage';
import { HrdDashboardPage } from './pages/hrd/HrdDashboardPage';
import { MasterEmployeesPage } from './pages/hrd/MasterEmployeesPage';
import { ManagerApprovalsPage } from './pages/manager/ManagerApprovalsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SystemDatabaseManagementPage } from './pages/system/SystemDatabaseManagementPage';

// Feature: Application Route Tree & Context Providers — Purpose: Redirects the root path (`/`) to `/hrd/dashboard` for SYSTEM_ADMIN/HR_ADMIN or `/employee/dashboard` for EMPLOYEE.
// OOP: Reusable UI Component (Encapsulated View & State) — Connected To: Used as the index and catch-all route in `App.tsx`.
const RoleBasedHomeRedirect: React.FC = () => {
  const { user, isLoading, isAuthenticated, isAdmin, isManager } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (user.employeeId && !user.isFaceEnrolled) {
    return <Navigate to="/auth/enroll-face" replace />;
  }
  if (isManager) {
    return <Navigate to="/manager/approvals" replace />;
  }
  return <Navigate to={isAdmin ? '/hrd/dashboard' : '/employee/dashboard'} replace />;
};

// Feature: Application Route Tree & Context Providers — Purpose: Root React application component wiring ToastProvider, ThemeProvider, AuthProvider, BrowserRouter, RBAC routes, and the toast container.
// OOP: Reusable UI Component (Encapsulated View & State) — Connected To: Mounted by `frontend/src/main.tsx`.
export const App: React.FC = () => {
  return (
    <ToastProvider>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Authentication & Onboarding Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/verify-account" element={<VerifyAccountPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/request-access" element={<RequestAccessPage />} />

              {/* Mandatory Biometric Face Enrollment Route */}
              <Route
                path="/auth/enroll-face"
                element={
                  <ProtectedRoute>
                    <FaceEnrollmentPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected Authenticated Portal Routes */}
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<RoleBasedHomeRedirect />} />

                {/* Employee WFH Self-Service Portal (accessible to both EMPLOYEE and HR_ADMIN) */}
                <Route path="/employee/dashboard" element={<EmployeeDashboardPage />} />
                <Route path="/dashboard" element={<Navigate to="/employee/dashboard" replace />} />
                <Route path="/employee/attendance" element={<EmployeeAttendancePage />} />
                <Route path="/employee/history" element={<MyAttendanceHistoryPage />} />
                <Route path="/profile" element={<ProfilePage />} />

                {/* Department Manager Approvals (accessible to SYSTEM_ADMIN, HR_ADMIN, and MANAGER) */}
                <Route
                  path="/manager/approvals"
                  element={
                    <ProtectedRoute allowedRoles={['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER']}>
                      <ManagerApprovalsPage />
                    </ProtectedRoute>
                  }
                />

                {/* Administrator Control Center (accessible to SYSTEM_ADMIN and HR_ADMIN) */}
                <Route
                  path="/hrd/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
                      <HrdDashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/hrd/monitoring"
                  element={
                    <ProtectedRoute allowedRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
                      <AttendanceMonitoringPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/hrd/employees"
                  element={
                    <ProtectedRoute allowedRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
                      <MasterEmployeesPage />
                    </ProtectedRoute>
                  }
                />

                {/* System Administrator Database Studio (accessible strictly to SYSTEM_ADMIN) */}
                <Route
                  path="/system/database"
                  element={
                    <ProtectedRoute allowedRoles={['SYSTEM_ADMIN']}>
                      <SystemDatabaseManagementPage />
                    </ProtectedRoute>
                  }
                />
              </Route>

              {/* Fallback Route */}
              <Route path="*" element={<RoleBasedHomeRedirect />} />
            </Routes>

            {/* Mandatory Bottom-Right Toast Notification Stack */}
            <ToastContainerBottomRight />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </ToastProvider>
  );
};

export default App;

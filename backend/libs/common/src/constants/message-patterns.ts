// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================

// Feature: Microservice TCP Message Patterns — Purpose: Injection tokens for the TCP ClientProxy instances the API gateway uses to reach each microservice.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: backend/apps/api-gateway/src/app.module.ts (ClientsModule registration) and every gateway controller.
export const EMPLOYEE_SERVICE = 'EMPLOYEE_SERVICE';
export const ATTENDANCE_SERVICE = 'ATTENDANCE_SERVICE';

// Feature: Microservice TCP Message Patterns — Purpose: TCP message patterns for the Employee & Auth microservice (port 3001).
// OOP: Stateless Utility Function (Functional Helper) — Connected To: backend/apps/employee-service/src/**/*.controller.ts (@MessagePattern).
export const AUTH_PATTERNS = {
  LOGIN: { cmd: 'auth.login' },
  REFRESH: { cmd: 'auth.refresh' },
  ME: { cmd: 'auth.me' },
  CHANGE_PASSWORD: { cmd: 'auth.change_password' },
  REQUEST_ACCESS: { cmd: 'auth.request_access' },
  VERIFY_ACCOUNT: { cmd: 'auth.verify_account' },
  RESEND_VERIFICATION: { cmd: 'auth.resend_verification' },
  FORGOT_PASSWORD: { cmd: 'auth.forgot_password' },
  RESET_PASSWORD: { cmd: 'auth.reset_password' },
} as const;

export const EMPLOYEE_PATTERNS = {
  FIND_ALL: { cmd: 'employee.find_all' },
  FIND_ONE: { cmd: 'employee.find_one' },
  CREATE: { cmd: 'employee.create' },
  UPDATE: { cmd: 'employee.update' },
  SOFT_DELETE: { cmd: 'employee.soft_delete' },
  RESTORE: { cmd: 'employee.restore' },
  DEPARTMENTS: { cmd: 'employee.departments' },
  DEPARTMENT_DIRECTORY: { cmd: 'employee.department_directory' },
  RESEND_VERIFICATION: { cmd: 'employee.resend_verification' },
  ENROLL_FACE: { cmd: 'employee.enroll_face' },
  TOGGLE_SIBLING_EXEMPTION: { cmd: 'employee.toggle_sibling_exemption' },
  UPDATE_PROFILE: { cmd: 'employee.update_profile' },
} as const;

export const ACCESS_REQUEST_PATTERNS = {
  FIND_ALL: { cmd: 'access_request.find_all' },
  APPROVE: { cmd: 'access_request.approve' },
  REJECT: { cmd: 'access_request.reject' },
} as const;

export const SUPPORT_PATTERNS = {
  CONTACT_DEVELOPER: { cmd: 'support.contact_developer' },
  FIND_TICKETS: { cmd: 'support.find_tickets' },
  RESOLVE: { cmd: 'support.resolve' },
  TEST_EMAIL: { cmd: 'support.test_email' },
} as const;

// Feature: System Administrator Database Studio — Purpose: TCP message patterns for raw relational database CRUD operations across all tables.
// OOP: Stateless Utility Dictionary (Constants Record) — Connected To: backend/apps/api-gateway/src/database-management and backend/apps/employee-service/src/database-management.
export const DATABASE_PATTERNS = {
  GET_TABLES: { cmd: 'database.get_tables' },
  GET_ROWS: { cmd: 'database.get_rows' },
  GET_ROW: { cmd: 'database.get_row' },
  INSERT_ROW: { cmd: 'database.insert_row' },
  UPDATE_ROW: { cmd: 'database.update_row' },
  DELETE_ROW: { cmd: 'database.delete_row' },
} as const;

// Feature: Microservice TCP Message Patterns — Purpose: TCP message patterns for the Attendance microservice (port 3002).
// OOP: Stateless Utility Function (Functional Helper) — Connected To: backend/apps/attendance-service/src/**/*.controller.ts.
export const ATTENDANCE_PATTERNS = {
  CLOCK_IN: { cmd: 'attendance.clock_in' },
  CLOCK_OUT: { cmd: 'attendance.clock_out' },
  TODAY: { cmd: 'attendance.today' },
  MY_HISTORY: { cmd: 'attendance.my_history' },
  MY_DASHBOARD: { cmd: 'attendance.my_dashboard' },
  FIND_ALL: { cmd: 'attendance.find_all' },
  FIND_ONE: { cmd: 'attendance.find_one' },
  SUMMARY: { cmd: 'attendance.summary' },
  EXPORT: { cmd: 'attendance.export' },
  GET_POLICY: { cmd: 'attendance.get_policy' },
  UPDATE_POLICY: { cmd: 'attendance.update_policy' },
  VERIFY_FACE_PREVIEW: { cmd: 'attendance.verify_face_preview' },
} as const;

export const ATTENDANCE_REQUEST_PATTERNS = {
  CREATE: { cmd: 'attendance_request.create' },
  MY: { cmd: 'attendance_request.my' },
  FIND_ALL: { cmd: 'attendance_request.find_all' },
  REVIEW: { cmd: 'attendance_request.review' },
} as const;

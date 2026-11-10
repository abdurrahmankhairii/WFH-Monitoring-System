// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { dispatchGlobalToast } from '../context/ToastContext';
import { StandardApiResponse } from '../types';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const BACKEND_ORIGIN = import.meta.env.VITE_BACKEND_ORIGIN || '';

export const ACCESS_TOKEN_KEY = 'dexa_wfh_access_token';
export const REFRESH_TOKEN_KEY = 'dexa_wfh_refresh_token';
export const USER_PROFILE_KEY = 'dexa_wfh_user_profile';

// Feature: Axios HTTP Client & Interceptors — Purpose: Resolves photo proof URLs (supports inline `data:image/svg+xml` seed proofs, absolute URLs, and `/uploads/...` paths).
// OOP: Stateless Utility Function (Functional Helper) — Connected To: Used by PhotoLightboxModal.tsx, AttendanceMonitoringPage.tsx, and EmployeeAttendancePage.tsx.
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
    return url;
  }
  return `${BACKEND_ORIGIN}${url.startsWith('/') ? url : `/${url}`}`;
}

// Feature: Axios HTTP Client & Interceptors — Purpose: Pre-configured Axios client with automatic Bearer JWT injection, silent refresh token retry on 401, and automatic.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: Communicates with `backend/apps/api-gateway` (`/api/*`) -> Used by all frontend pages and components.
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<StandardApiResponse>) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean; silentToast?: boolean }) | undefined;

    // Attempt silent token refresh once if a 401 occurs outside /auth/login
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (refreshToken) {
        originalRequest._retry = true;
        try {
          const refreshRes = await axios.post<StandardApiResponse<{ accessToken: string; refreshToken: string }>>(
            `${API_BASE_URL}/auth/refresh`,
            { refreshToken },
          );
          const newAccess = refreshRes.data.data?.accessToken;
          const newRefresh = refreshRes.data.data?.refreshToken;
          if (newAccess && newRefresh) {
            localStorage.setItem(ACCESS_TOKEN_KEY, newAccess);
            localStorage.setItem(REFRESH_TOKEN_KEY, newRefresh);
            originalRequest.headers.Authorization = `Bearer ${newAccess}`;
            return apiClient(originalRequest);
          }
        } catch {
          localStorage.removeItem(ACCESS_TOKEN_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
          localStorage.removeItem(USER_PROFILE_KEY);
        }
      }
    }

    const data = error.response?.data;
    const where =
      data?.where ||
      `API Request • ${(originalRequest?.method || 'GET').toUpperCase()} ${originalRequest?.url || ''}`;
    const what = data?.what || 'Request failed';
    const why =
      data?.why ||
      error.message ||
      'Unable to reach the API Gateway. Please verify that the backend services are running.';

    if (!originalRequest?.silentToast) {
      dispatchGlobalToast({
        type: 'error',
        where,
        what,
        why,
      });
    }

    return Promise.reject(error);
  },
);

// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { StandardApiResponse, ToastType } from '../types';

export interface ToastItem {
  id: string;
  type: ToastType;
  where: string;
  what: string;
  why: string;
  createdAt: number;
  duration: number;
  read?: boolean;
}

export interface ToastPayload {
  type: ToastType;
  where: string;
  what: string;
  why: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  history: ToastItem[];
  unreadCount: number;
  showToast: (payload: ToastPayload) => void;
  notifyApiResponse: (response: StandardApiResponse<unknown>, fallbackWhere?: string) => void;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
  markAllHistoryAsRead: () => void;
  markItemAsRead: (id: string) => void;
  clearHistory: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let externalShowToast: ((payload: ToastPayload) => void) | null = null;
const NOTIFICATION_HISTORY_KEY = 'dexa_wfh_business_notifications_v3';

const SEED_BUSINESS_NOTIFICATIONS: ToastItem[] = [
  {
    id: 'seed-notif-1',
    type: 'success',
    where: 'Face Verification',
    what: 'Face verification setup completed',
    why: 'Face biometric verification is active for your account.',
    createdAt: Date.now() - 45 * 1000,
    duration: 5000,
    read: false,
  },
  {
    id: 'seed-notif-2',
    type: 'info',
    where: 'Leave Request',
    what: 'Sick leave request submitted',
    why: 'Budi Santoso submitted a Sick Leave request for Nov 09.',
    createdAt: Date.now() - 10 * 60 * 1000,
    duration: 5000,
    read: false,
  },
  {
    id: 'seed-notif-3',
    type: 'info',
    where: 'Time Correction',
    what: 'Clock-out time adjustment request',
    why: 'Siti Rahmawati requested a clock-out time adjustment.',
    createdAt: Date.now() - 60 * 60 * 1000,
    duration: 5000,
    read: true,
  },
];

// Feature: Normal Toast Notification & Headbar Notification Center — Purpose: Strips square brackets from notification strings so every message reads naturally.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: Used by ToastProvider.showToast() before displaying or storing any notification.
function stripSquareBrackets(text: string): string {
  return text.replace(/\[|\]/g, '').replace(/\s{2,}/g, ' ').trim();
}

// Feature: Normal Toast Notification & Headbar Notification Center — Purpose: Global toast dispatcher usable outside React components such as Axios interceptors.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: Called by frontend/src/api/client.ts response error interceptor.
export function dispatchGlobalToast(payload: ToastPayload): void {
  if (externalShowToast) {
    externalShowToast(payload);
  }
}

// Feature: Normal Toast Notification & Headbar Notification Center — Purpose: Provides bottom-right toast stack and persistent Headbar Notification Center history.
// OOP: Context Provider Pattern (State Abstraction & Dependency Injection) — Connected To: Consumed by ToastContainerBottomRight.tsx and NotificationCenterDropdown.tsx.
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const lastDispatchedRef = useRef<{ signature: string; timestamp: number }>({
    signature: '',
    timestamp: 0,
  });
  const [history, setHistory] = useState<ToastItem[]>(() => {
    try {
      const saved = localStorage.getItem(NOTIFICATION_HISTORY_KEY);
      return saved ? (JSON.parse(saved) as ToastItem[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(history.slice(0, 40)));
    } catch {
      // Ignore storage quota errors
    }
  }, [history]);

  // Feature: Normal Toast Notification & Headbar Notification Center — Purpose: Removes a single toast notification card from the bottom-right stack by ID.
  // OOP: Context Provider Pattern (State Abstraction & Dependency Injection) — Connected To: Triggered by auto-dismiss timer and manual close button.
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Feature: Normal Toast Notification & Headbar Notification Center — Purpose: Pushes a 3-part notification to both the bottom-right stack and the Headbar Notification Center with rapid-duplicate protection.
  // OOP: Context Provider Pattern (State Abstraction & Dependency Injection) — Connected To: Invoked across all CRUD, Auth, Attendance, Export, Filter, and Support actions.
  const showToast = useCallback(
    (payload: ToastPayload) => {
      const cleanWhere = stripSquareBrackets(payload.where || 'WFH System');
      const cleanWhat = stripSquareBrackets(payload.what || 'Action processed');
      const cleanWhy = stripSquareBrackets(payload.why || 'Operation completed.');
      const now = Date.now();
      const signature = `${payload.type}|${cleanWhere}|${cleanWhat}`;

      if (
        lastDispatchedRef.current.signature === signature &&
        now - lastDispatchedRef.current.timestamp < 1400
      ) {
        return;
      }
      lastDispatchedRef.current = { signature, timestamp: now };

      const id = `${now}-${Math.random().toString(36).slice(2, 8)}`;
      const duration = payload.duration ?? (payload.type === 'error' ? 7500 : 5200);
      const nextToast: ToastItem = {
        id,
        type: payload.type,
        where: cleanWhere,
        what: cleanWhat,
        why: cleanWhy,
        createdAt: now,
        duration,
        read: false,
      };

      setToasts((prev) => [...prev.slice(-3), nextToast]);
      setHistory((prev) => [nextToast, ...prev.slice(0, 39)]);

      window.setTimeout(() => {
        dismissToast(id);
      }, duration);
    },
    [dismissToast],
  );

  // Feature: Normal Toast Notification & Headbar Notification Center — Purpose: Converts a standardized backend API response directly into a 3-part toast notification.
  // OOP: Context Provider Pattern (State Abstraction & Dependency Injection) — Connected To: Used after API mutations in Auth, Attendance, Employee CRUD, and Support modules.
  const notifyApiResponse = useCallback(
    (response: StandardApiResponse<unknown>, fallbackWhere = 'WFH Portal') => {
      showToast({
        type: response.type || (response.success ? 'success' : 'error'),
        where: response.where || fallbackWhere,
        what: response.what || (response.success ? 'Operation completed' : 'Operation failed'),
        why: response.why || 'The request was processed by the API Gateway.',
      });
    },
    [showToast],
  );

  // Feature: Normal Toast Notification & Headbar Notification Center — Purpose: Clears all currently visible bottom-right toast cards.
  // OOP: Context Provider Pattern (State Abstraction & Dependency Injection) — Connected To: Clear All button in ToastContainerBottomRight.tsx.
  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Feature: Normal Toast Notification & Headbar Notification Center — Purpose: Marks all stored notifications in the Headbar Notification Center as read.
  // OOP: Context Provider Pattern (State Abstraction & Dependency Injection) — Connected To: Called when opening NotificationCenterDropdown.tsx.
  const markAllHistoryAsRead = useCallback(() => {
    setHistory((prev) => prev.map((item) => ({ ...item, read: true })));
  }, []);

  // Feature: Headbar Notification Center Dropdown — Purpose: Marks a single notification item as read upon user click.
  // OOP: Context Provider Pattern (State Abstraction & Dependency Injection) — Connected To: Triggered when user clicks a notification item.
  const markItemAsRead = useCallback((id: string) => {
    setHistory((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
  }, []);

  // Feature: Normal Toast Notification & Headbar Notification Center — Purpose: Clears the notification history list in the Headbar Notification Center.
  // OOP: Context Provider Pattern (State Abstraction & Dependency Injection) — Connected To: Clear History button in NotificationCenterDropdown.tsx.
  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(NOTIFICATION_HISTORY_KEY);
  }, []);

  useEffect(() => {
    externalShowToast = showToast;
    return () => {
      externalShowToast = null;
    };
  }, [showToast]);

  const unreadCount = history.filter((item) => !item.read).length;

  return (
    <ToastContext.Provider
      value={{
        toasts,
        history,
        unreadCount,
        showToast,
        notifyApiResponse,
        dismissToast,
        clearAllToasts,
        markAllHistoryAsRead,
        markItemAsRead,
        clearHistory,
      }}
    >
      {children}
    </ToastContext.Provider>
  );
};

// Feature: Normal Toast Notification & Headbar Notification Center — Purpose: React hook providing access to showToast, notifyApiResponse, and notification history.
// OOP: Custom React Hook (Encapsulated State & Side-Effects) — Connected To: Used across all pages and custom components in frontend/src/.
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

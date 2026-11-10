// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React from 'react';
import { CheckCircle2, Info, ShieldAlert, X } from 'lucide-react';
import { ToastItem, useToast } from '../../context/ToastContext';

// Feature: Bottom-Right Toast Notification Renderer — Purpose: Renders a compact single-line pill toast with small status icon and concise text.
// OOP: Reusable UI Component (Encapsulated View & State) — Connected To: Rendered by ToastContainerBottomRight from ToastContext.tsx state.
const ToastCard: React.FC<{ item: ToastItem; onDismiss: (id: string) => void }> = ({ item, onDismiss }) => {
  const styles = {
    success: {
      container:
        'bg-slate-900/95 dark:bg-slate-900/95 text-white border border-emerald-500/40 shadow-emerald-950/20',
      iconColor: 'text-emerald-400',
      Icon: CheckCircle2,
    },
    error: {
      container:
        'bg-slate-900/95 dark:bg-slate-900/95 text-white border border-rose-500/40 shadow-rose-950/20',
      iconColor: 'text-rose-400',
      Icon: ShieldAlert,
    },
    info: {
      container:
        'bg-slate-900/95 dark:bg-slate-900/95 text-white border border-slate-700/80 shadow-slate-950/20',
      iconColor: 'text-blue-400',
      Icon: Info,
    },
  }[item.type];

  const { Icon, iconColor } = styles;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`animate-toast-in pointer-events-auto px-4 py-3 rounded-xl text-xs font-medium flex items-start gap-2.5 shadow-xl backdrop-blur-md max-w-md transition-all duration-200 ${styles.container}`}
    >
      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
      <div className="flex-1 min-w-0 font-sans space-y-0.5">
        <div className="font-semibold text-white leading-tight">{item.what}</div>
        {item.why && item.why !== item.what && (
          <div className="text-[11px] text-slate-300 leading-relaxed break-words">{item.why}</div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss notification"
        className="p-1 rounded text-slate-400 hover:text-white transition-colors ml-1 -mt-0.5 shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

// Feature: Bottom-Right Toast Notification Renderer — Purpose: Fixed bottom-right viewport container rendering compact single-line toast pills.
// OOP: Reusable UI Component (Encapsulated View & State) — Connected To: Mounted once inside frontend/src/App.tsx.
export const ToastContainerBottomRight: React.FC = () => {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="System notifications"
      className="no-print fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2 pointer-events-none"
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={dismissToast} />
      ))}
    </div>
  );
};

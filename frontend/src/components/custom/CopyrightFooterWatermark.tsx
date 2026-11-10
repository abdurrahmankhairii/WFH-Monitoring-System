// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React from 'react';

interface CopyrightFooterWatermarkProps {
  variant?: 'default' | 'auth';
}

// Feature: Visible Copyright & Evaluation Watermark — Purpose: Displays mandatory All Rights Reserved copyright watermark across every screen, layout, and print view.
// OOP: Reusable UI Component (Encapsulated View & State) — Connected To: Rendered in AppLayout.tsx, auth layouts, and modals.
export const CopyrightFooterWatermark: React.FC<CopyrightFooterWatermarkProps> = ({ variant = 'default' }) => {
  const isAuth = variant === 'auth';
  return (
    <footer
      className={
        isAuth
          ? 'w-full mt-4 px-2 text-center text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed'
          : 'w-full py-3.5 px-4 text-center text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200/70 dark:border-slate-800/70 bg-transparent'
      }
    >
      &copy; 2026 Abdurrahman Khairi - Created strictly for Technical Assessment evaluation. Unauthorized commercial use is prohibited
    </footer>
  );
};

// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React from 'react';
import { useTheme } from '../../context/ThemeContext';

interface DexaBrandLogoProps {
  variant?: 'auto' | 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

// Feature: Dexa Group Brand Identity & Logos — Purpose: Renders official Dexa Group logo (red in Light Mode, white in Dark Mode).
// OOP: Reusable UI Component (Encapsulated View & State) — Connected To: Rendered in AppLayout.tsx headbar/sidebar and all authentication pages.
export const DexaBrandLogo: React.FC<DexaBrandLogoProps> = ({
  variant = 'auto',
  size = 'md',
  showSubtitle = true,
}) => {
  const { isDark } = useTheme();

  // Use white logo on forced dark surfaces (`variant === 'light'`) or when global Dark Mode is active
  const useWhiteLogo = variant === 'light' || (variant !== 'dark' && isDark) || (variant === 'dark' && isDark);
  const logoSrc = useWhiteLogo ? '/logo-dexa-white.png' : '/logo-dexa-red.png';

  const imgHeightClass =
    size === 'lg' ? 'h-7 sm:h-8' : size === 'sm' ? 'h-5 sm:h-6' : 'h-6 sm:h-7';

  const dividerColor =
    variant === 'light'
      ? 'border-white/25'
      : 'border-slate-200 dark:border-slate-700';

  return (
    <div className="inline-flex items-center gap-3 select-none">
      <img
        src={logoSrc}
        alt="Dexa Group"
        className={`${imgHeightClass} w-auto object-contain transition-opacity duration-200 shrink-0`}
      />
      {showSubtitle && (
        <div className={`hidden sm:flex items-center pl-3 border-l ${dividerColor}`}>
          <div
            className={`text-xs font-semibold tracking-tight whitespace-nowrap ${
              variant === 'light' ? 'text-white/95' : 'text-slate-800 dark:text-slate-100'
            }`}
          >
            WFH Attendance Portal
          </div>
        </div>
      )}
    </div>
  );
};

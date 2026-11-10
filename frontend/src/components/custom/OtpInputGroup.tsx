// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React, { useRef } from 'react';

interface OtpInputGroupProps {
  value: string;
  onChange: (nextOtp: string) => void;
  disabled?: boolean;
}

// Feature: 6-Digit Email OTP Input Control — Purpose: Custom 6-digit OTP input component supporting auto-focus advance, backspace navigation, and full 6-digit clipboard paste.
// OOP: Reusable UI Component (Encapsulated View & State) — Connected To: Used in `frontend/src/pages/auth/VerifyAccountPage.tsx` and `ForgotPasswordPage.tsx`.
export const OtpInputGroup: React.FC<OtpInputGroupProps> = ({ value, onChange, disabled = false }) => {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');

  // Feature: 6-Digit Email OTP Input Control — Purpose: Updates a single digit slot and moves focus to the next input box.
  // OOP: Reusable UI Component (Encapsulated View & State) — Connected To: Input onChange handler below.
  const handleDigitChange = (index: number, raw: string) => {
    const clean = raw.replace(/\D/g, '');
    if (!clean) {
      const next = [...digits];
      next[index] = '';
      onChange(next.join(''));
      return;
    }

    // Handle multi-digit paste or fast typing
    if (clean.length > 1) {
      const sliced = clean.slice(0, 6).split('');
      const next = [...digits];
      sliced.forEach((char, offset) => {
        if (index + offset < 6) next[index + offset] = char;
      });
      onChange(next.join(''));
      const focusIdx = Math.min(5, index + sliced.length);
      inputsRef.current[focusIdx]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = clean;
    onChange(next.join(''));
    if (index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  // Feature: 6-Digit Email OTP Input Control — Purpose: Moves focus backward on Backspace when the current box is empty.
  // OOP: Reusable UI Component (Encapsulated View & State) — Connected To: Input onKeyDown handler below.
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  // Feature: 6-Digit Email OTP Input Control — Purpose: Populates all 6 boxes when the user pastes a 6-digit code from their email.
  // OOP: Reusable UI Component (Encapsulated View & State) — Connected To: Input onPaste handler below.
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      onChange(pasted);
      const focusIdx = Math.min(5, pasted.length - 1);
      inputsRef.current[focusIdx]?.focus();
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 sm:gap-3">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={6}
          disabled={disabled}
          value={digit}
          onChange={(e) => handleDigitChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          aria-label={`OTP digit ${index + 1}`}
          className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-semibold font-sans tabular-nums rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:border-blue-600 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all disabled:opacity-50"
        />
      ))}
    </div>
  );
};

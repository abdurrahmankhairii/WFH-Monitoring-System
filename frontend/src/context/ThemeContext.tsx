// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type AppTheme = 'light' | 'dark';

interface ThemeContextValue {
  theme: AppTheme;
  isDark: boolean;
  setTheme: (nextTheme: AppTheme) => void;
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = 'dexa_wfh_theme';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Feature: UI Theme Context & Mode Persistence — Purpose: Global theme state provider synchronizing html.dark on root element and localStorage.
// OOP: Context Provider Pattern (State Abstraction & Dependency Injection) — Connected To: Wraps App.tsx; consumed by ThemeToggle.tsx and DexaBrandLogo.tsx.
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((nextTheme: AppTheme) => {
    setThemeState(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme: AppTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === 'dark',
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

// Feature: UI Theme Context & Mode Persistence — Purpose: Custom hook to read and toggle the active Light / Dark mode theme.
// OOP: Context Provider Pattern (State Abstraction & Dependency Injection) — Connected To: Used in `ThemeToggle.tsx`, `DexaBrandLogo.tsx`, `AppLayout.tsx`, and Auth pages.
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: 'light',
      isDark: false,
      setTheme: () => undefined,
      toggleTheme: () => undefined,
    };
  }
  return ctx;
}

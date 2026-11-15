'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Theme = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ 
  children,
  defaultTheme = 'light',
  storageKey = 'theme',
  attribute,
  enableSystem = false,
  disableTransitionOnChange
}: { 
  children: React.ReactNode;
  defaultTheme?: string;
  storageKey?: string;
  attribute?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}) {
  const fallbackTheme: Theme = (defaultTheme as Theme) || 'light';

  // 1. Selected preference: 'light' | 'dark' | 'system' (Defaults to fallbackTheme)
  const [theme, setThemeState] = useState<Theme>(fallbackTheme);
  
  // 2. Resolved theme: strictly 'dark' | 'light'
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(fallbackTheme === 'dark' ? 'dark' : 'light');
  const [mounted, setMounted] = useState(false);

  // Helper to determine resolved theme from system preference
  const getSystemTheme = useCallback((): ResolvedTheme => {
    if (typeof window === 'undefined') return fallbackTheme === 'dark' ? 'dark' : 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, [fallbackTheme]);

  const applyClasses = useCallback((active: ResolvedTheme) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const body = document.body;

    if (active === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.style.colorScheme = 'dark';
      if (body) {
        body.classList.add('dark');
        body.classList.remove('light');
      }
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
      if (body) {
        body.classList.add('light');
        body.classList.remove('dark');
      }
    }
  }, []);

  // Initialize theme from localStorage or default to fallbackTheme ('light')
  useEffect(() => {
    const stored = (localStorage.getItem(storageKey) || localStorage.getItem(`newsim_${storageKey}`)) as Theme | null;
    const initialTheme: Theme = (stored === 'light' || stored === 'dark' || (enableSystem && stored === 'system')) 
      ? stored 
      : fallbackTheme;
    
    setThemeState(initialTheme);
    
    const initialResolved: ResolvedTheme = initialTheme === 'system' ? getSystemTheme() : (initialTheme as ResolvedTheme);
    setResolvedTheme(initialResolved);
    applyClasses(initialResolved);
    
    setMounted(true);
  }, [fallbackTheme, storageKey, enableSystem, getSystemTheme, applyClasses]);

  // Handle theme changes & OS system preference listener
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const updateTheme = () => {
      let active: ResolvedTheme;
      if (theme === 'system') {
        active = mediaQuery.matches ? 'dark' : 'light';
      } else {
        active = theme;
      }

      setResolvedTheme(active);
      applyClasses(active);
    };

    updateTheme();
    localStorage.setItem(storageKey, theme);
    localStorage.setItem(`newsim_${storageKey}`, theme);

    // Listen for OS system theme changes (only affects UI when theme === 'system')
    const handleMediaChange = () => {
      if (theme === 'system') {
        updateTheme();
      }
    };

    mediaQuery.addEventListener('change', handleMediaChange);
    return () => mediaQuery.removeEventListener('change', handleMediaChange);
  }, [theme, storageKey, mounted, applyClasses]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

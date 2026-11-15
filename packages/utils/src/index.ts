import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'PHP'): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr: string | Date): string {
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(dateStr: string | Date): string {
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface PasswordValidationRules {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

export interface PasswordValidationResult {
  isValid: boolean;
  score: number;
  strength: 'Weak' | 'Fair' | 'Good' | 'Strong';
  rules: PasswordValidationRules;
  errors: string[];
}

export function validatePassword(password: string, minLength = 12): PasswordValidationResult {
  const pwd = password || '';
  const rules: PasswordValidationRules = {
    minLength: pwd.length >= minLength,
    hasUppercase: /[A-Z]/.test(pwd),
    hasLowercase: /[a-z]/.test(pwd),
    hasNumber: /[0-9]/.test(pwd),
    hasSpecialChar: /[^A-Za-z0-9]/.test(pwd),
  };

  const metCount = [
    rules.minLength,
    rules.hasUppercase,
    rules.hasLowercase,
    rules.hasNumber,
    rules.hasSpecialChar,
  ].filter(Boolean).length;

  const errors: string[] = [];
  if (!rules.minLength) errors.push(`at least ${minLength} characters`);
  if (!rules.hasUppercase) errors.push('an uppercase letter (A-Z)');
  if (!rules.hasLowercase) errors.push('a lowercase letter (a-z)');
  if (!rules.hasNumber) errors.push('a number (0-9)');
  if (!rules.hasSpecialChar) errors.push('a special character (e.g. !@#$%^&*)');

  let strength: 'Weak' | 'Fair' | 'Good' | 'Strong' = 'Weak';
  if (pwd.length === 0) {
    strength = 'Weak';
  } else if (metCount <= 2) {
    strength = 'Weak';
  } else if (metCount === 3) {
    strength = 'Fair';
  } else if (metCount === 4) {
    strength = 'Good';
  } else {
    strength = 'Strong';
  }

  return {
    isValid: metCount === 5,
    score: metCount,
    strength,
    rules,
    errors,
  };
}

export function isStrongPassword(password: string, minLength = 12): boolean {
  return validatePassword(password, minLength).isValid;
}

export * from './edge-security';
export * from './rbac';


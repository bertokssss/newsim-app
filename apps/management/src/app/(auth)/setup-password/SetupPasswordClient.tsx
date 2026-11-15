"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldCheck, Lock, Eye, EyeOff, CheckCircle2, XCircle, ArrowRight, Loader2 } from "lucide-react";
import { Button } from '@newsim/ui';
import { createClient } from '@supabase/supabase-js';

export default function SetupPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<'loading' | 'setup' | 'complete' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [userInfo, setUserInfo] = useState<{ email: string; username: string; role: string; status: string } | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  useEffect(() => {
    const initSession = async () => {
      const accessToken = searchParams.get('access_token');
      const refreshToken = searchParams.get('refresh_token');

      if (!accessToken || !refreshToken) {
        setStep('error');
        setErrorMessage('Invalid or expired verification link. Please request a new invitation.');
        return;
      }

      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error || !data.user) {
          setStep('error');
          setErrorMessage('Session expired. Please request a new invitation from your administrator.');
          return;
        }

        setUserInfo({
          email: data.user.email || '',
          username: data.user.user_metadata?.username || data.user.email?.split('@')[0] || '',
          role: 'ADMIN',
          status: 'ACTIVE',
        });

        setStep('setup');
      } catch {
        setStep('error');
        setErrorMessage('An unexpected error occurred. Please try again.');
      }
    };

    initSession();
  }, [searchParams]);

  const validatePassword = (pw: string): string[] => {
    const errors: string[] = [];
    if (pw.length < 12) errors.push('At least 12 characters');
    if (!/[A-Z]/.test(pw)) errors.push('At least one uppercase letter');
    if (!/[a-z]/.test(pw)) errors.push('At least one lowercase letter');
    if (!/[0-9]/.test(pw)) errors.push('At least one number');
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)) errors.push('At least one special character');
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErrors([]);

    const errors = validatePassword(password);
    if (errors.length > 0) {
      setPasswordErrors(errors);
      return;
    }

    if (password !== confirmPassword) {
      setPasswordErrors(['Passwords do not match']);
      return;
    }

    setSaving(true);

    try {
      const accessToken = searchParams.get('access_token');

      const res = await fetch('/api/auth/setup-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          accessToken,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setPasswordErrors([data.error || 'Failed to set password.']);
        setSaving(false);
        return;
      }

      setStep('complete');
    } catch {
      setPasswordErrors(['Network error. Please try again.']);
      setSaving(false);
    }
  };

  const passwordChecks = [
    { label: '12+ characters', pass: password.length >= 12 },
    { label: 'Uppercase letter', pass: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', pass: /[a-z]/.test(password) },
    { label: 'Number', pass: /[0-9]/.test(password) },
    { label: 'Special character', pass: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) },
    { label: 'Passwords match', pass: password.length > 0 && password === confirmPassword },
  ];

  return (
    <div className="min-h-screen w-full bg-[var(--color-navy-950)] flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--color-navy-800)_0%,_transparent_50%)] opacity-40" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md bg-[var(--color-navy-900)]/90 backdrop-blur-md rounded-2xl overflow-hidden shadow-2xl border border-[var(--color-border)] relative z-10 p-8 sm:p-12"
      >
        {/* Loading */}
        {step === 'loading' && (
          <div className="text-center space-y-4">
            <Loader2 className="w-10 h-10 text-[var(--color-ocean-400)] mx-auto animate-spin" />
            <h1 className="text-xl font-bold text-white font-heading">Verifying Your Invitation...</h1>
            <p className="text-sm text-[var(--color-text-secondary)]">Please wait while we confirm your email.</p>
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-rose-500/20 border border-rose-500/30 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="w-10 h-10 text-rose-400" />
            </div>
            <h1 className="text-xl font-bold text-white font-heading">Verification Failed</h1>
            <p className="text-sm text-[var(--color-text-secondary)]">{errorMessage}</p>
            <Button onClick={() => router.push('/login')} className="w-full h-12">
              Go to Login
            </Button>
          </div>
        )}

        {/* Setup Password */}
        {step === 'setup' && userInfo && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-[var(--color-ocean-500)]/20 border border-[var(--color-ocean-500)]/30 rounded-full flex items-center justify-center mx-auto">
                <ShieldCheck className="w-8 h-8 text-[var(--color-ocean-500)]" />
              </div>
              <h1 className="text-xl font-bold text-white font-heading">Complete Your Admin Account</h1>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Your email has been verified. Set your password to finish setup.
              </p>
            </div>

            {/* Account Info */}
            <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
              {[
                ['Email', userInfo.email],
                ['Username', `@${userInfo.username}`],
                ['Role', userInfo.role],
                ['Status', userInfo.status],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-[11px] text-[var(--color-text-secondary)] font-mono uppercase">{label}</span>
                  <span className={`text-sm font-bold ${
                    label === 'Status' ? 'text-emerald-400' :
                    label === 'Role' ? 'text-[var(--color-ocean-400)]' :
                    'text-white'
                  }`}>{value}</span>
                </div>
              ))}
            </div>

            {/* Password Input */}
            <div className="space-y-3">
              <div className="relative">
                <label className="block text-xs font-bold text-white mb-1.5 uppercase font-mono">Create Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setPasswordErrors([]); }}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-10 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-white text-sm outline-none focus:border-[var(--color-ocean-500)] transition-colors"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-white cursor-pointer">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="relative">
                <label className="block text-xs font-bold text-white mb-1.5 uppercase font-mono">Confirm Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setPasswordErrors([]); }}
                    placeholder="Confirm your password"
                    className="w-full pl-10 pr-10 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-white text-sm outline-none focus:border-[var(--color-ocean-500)] transition-colors"
                    required
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-white cursor-pointer">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password Strength Checks */}
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {passwordChecks.map((check) => (
                  <div key={check.label} className={`flex items-center gap-1.5 text-[10px] ${check.pass ? 'text-emerald-400' : 'text-[var(--color-text-secondary)]'}`}>
                    {check.pass ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    <span>{check.label}</span>
                  </div>
                ))}
              </div>

              {/* Password Errors */}
              {passwordErrors.length > 0 && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30">
                  {passwordErrors.map((err) => (
                    <p key={err} className="text-rose-400 text-xs flex items-center gap-1">
                      <XCircle className="w-3 h-3 shrink-0" />
                      {err}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <Button type="submit" className="w-full h-12" isLoading={saving}>
              {saving ? 'Setting Up Account...' : 'Complete Account Setup'}
            </Button>
          </form>
        )}

        {/* Complete */}
        {step === 'complete' && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6">
            <div className="w-24 h-24 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto">
              <ShieldCheck className="w-12 h-12 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white mb-2 font-heading">Account Activated ✓</h1>
              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                Your NEWSIM Administrator account is now active. You can log in with your email and the password you just created.
              </p>
            </div>
            <Button
              onClick={() => router.push('/login')}
              className="w-full h-12 flex items-center justify-center gap-2"
            >
              Continue to Admin Login
              <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

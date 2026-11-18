'use client';

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { cn } from '@newsim/utils';
import { Button } from './button';
import { OtpInput, type OtpInputHandle } from './otp-input';

export interface TwoFactorAuthCardProps {
  /** Role display label, e.g., "Super Admin", "Admin", "Instructor", "Trainee" */
  roleLabel: string;
  /** Whether TOTP is currently active and configured in Supabase */
  mfaEnabled: boolean;
  /** Portal API endpoint that handles INIT_MFA_SETUP, COMPLETE_MFA_SETUP, and REGENERATE_RECOVERY_CODES */
  endpoint: string;
  /** HTTP method supported by endpoint (defaults to POST; Super Admin supports PUT/POST) */
  method?: 'POST' | 'PUT';
  /** False only for OAuth-only accounts without a local password; defaults to true */
  requiresPasswordStepUp?: boolean;
  /** Render function for the QR code SVG using the app's react-qr-code package */
  renderQr?: (otpAuthUri: string) => React.ReactNode;
  /** Optional callback after MFA activation or recovery code regeneration succeeds */
  onMfaUpdated?: (enabled: boolean) => void;
  /** Optional class name override for portal card border radius/layout consistency */
  className?: string;
}

export function TwoFactorAuthCard({
  roleLabel,
  mfaEnabled,
  endpoint,
  method = 'POST',
  requiresPasswordStepUp = true,
  renderQr,
  onMfaUpdated,
  className,
}: TwoFactorAuthCardProps) {
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Step-Up Recovery Regeneration Modal State
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [stepUpPassword, setStepUpPassword] = useState('');
  const [showStepUpPassword, setShowStepUpPassword] = useState(false);
  const [stepUpMfaCode, setStepUpMfaCode] = useState('');
  const [stepUpLoading, setStepUpLoading] = useState(false);
  const [stepUpError, setStepUpError] = useState<string | null>(null);
  const stepUpOtpRef = useRef<OtpInputHandle | null>(null);

  // In-Portal TOTP Enrollment Modal State (for accounts without TOTP enrolled yet)
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupInitLoading, setSetupInitLoading] = useState(false);
  const [setupVerifyLoading, setSetupVerifyLoading] = useState(false);
  const [setupSecret, setSetupSecret] = useState('');
  const [setupOtpUri, setSetupOtpUri] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [setupError, setSetupError] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const setupOtpRef = useRef<OtpInputHandle | null>(null);

  const openRegenerateModal = () => {
    setStatusError(null);
    setStepUpError(null);
    setStepUpPassword('');
    setStepUpMfaCode('');
    setShowStepUpPassword(false);
    setStepUpOpen(true);
  };

  const handleRegenerateSubmit = async (e?: React.FormEvent, codeOverride?: string) => {
    if (e) e.preventDefault();
    const resolvedMfaCode = typeof codeOverride === 'string' ? codeOverride : stepUpMfaCode;

    if (requiresPasswordStepUp && !stepUpPassword) {
      setStepUpError(`Current ${roleLabel} password is required.`);
      return;
    }
    if (!requiresPasswordStepUp && resolvedMfaCode.length !== 6) {
      setStepUpError('Enter the 6-digit code from your authenticator app.');
      return;
    }

    setStepUpError(null);
    setStepUpLoading(true);
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REGENERATE_RECOVERY_CODES',
          ...(requiresPasswordStepUp
            ? { currentPassword: stepUpPassword }
            : { mfaCode: resolvedMfaCode }),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success || !Array.isArray(json.recoveryCodes)) {
        setStepUpError(json.error || 'Failed to regenerate emergency recovery codes.');
        if (!requiresPasswordStepUp) {
          setStepUpMfaCode('');
          stepUpOtpRef.current?.clear();
        }
        return;
      }

      setRecoveryCodes(json.recoveryCodes);
      setStepUpPassword('');
      setStepUpMfaCode('');
      setStepUpOpen(false);
      onMfaUpdated?.(true);
    } catch {
      setStepUpError('Network error while regenerating recovery codes.');
    } finally {
      setStepUpLoading(false);
    }
  };

  const handleStartSetup = async () => {
    setStatusError(null);
    setSetupError(null);
    setSetupInitLoading(true);
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'INIT_MFA_SETUP' }),
      });
      const json = await res.json();
      if (!res.ok || !json.success || !json.setupToken || !json.otpAuthUri || !json.secret) {
        setStatusError(json.error || 'Failed to initialize TOTP setup.');
        return;
      }
      setSetupSecret(json.secret);
      setSetupOtpUri(json.otpAuthUri);
      setSetupToken(json.setupToken);
      setSetupCode('');
      setCopiedSecret(false);
      setSetupOpen(true);
    } catch {
      setStatusError('Network error initializing TOTP setup.');
    } finally {
      setSetupInitLoading(false);
    }
  };

  const handleCompleteSetup = async (codeOverride?: string) => {
    const codeToVerify = typeof codeOverride === 'string' ? codeOverride : setupCode;
    if (codeToVerify.length !== 6 || !setupToken) return;

    setSetupError(null);
    setSetupVerifyLoading(true);
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'COMPLETE_MFA_SETUP',
          setupToken,
          code: codeToVerify,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setSetupError(json.error || 'Invalid 6-digit authenticator code.');
        setSetupCode('');
        setupOtpRef.current?.clear();
        return;
      }

      setSetupOpen(false);
      setSetupCode('');
      if (Array.isArray(json.recoveryCodes)) {
        setRecoveryCodes(json.recoveryCodes);
      }
      onMfaUpdated?.(true);
    } catch {
      setSetupError('Network error completing TOTP activation.');
    } finally {
      setSetupVerifyLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4 flex flex-col justify-between transition-colors duration-200',
          className
        )}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
              Two-Factor Authentication (TOTP)
            </h3>
            {mfaEnabled ? (
              <span className="px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/80 text-xs font-mono font-semibold">
                Active &amp; Enforced
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/80 text-xs font-mono font-semibold">
                Setup Required
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {mfaEnabled
              ? `Your ${roleLabel} account is protected by mandatory RFC 6238 Authenticator Multi-Factor Authentication.`
              : `Protect your ${roleLabel} account with mandatory RFC 6238 Authenticator Multi-Factor Authentication and single-use backup recovery codes.`}
          </p>
        </div>

        {statusError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-medium">
            {statusError}
          </div>
        )}

        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          {mfaEnabled ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={openRegenerateModal}
              className="w-full text-xs cursor-pointer border-slate-200 dark:border-slate-800 bg-slate-50/80 hover:bg-slate-100 dark:bg-slate-900/60 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold"
            >
              <KeyRound className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
              Regenerate Emergency Recovery Codes
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              isLoading={setupInitLoading}
              onClick={handleStartSetup}
              className="w-full text-xs cursor-pointer border-sky-200 dark:border-sky-800/80 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 font-semibold"
            >
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-sky-600 dark:text-sky-400" />
              Enable &amp; Configure Authenticator (TOTP)
            </Button>
          )}
        </div>
      </div>

      {/* Recovery Codes Vault Box */}
      {recoveryCodes && recoveryCodes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 space-y-4"
        >
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <h4 className="text-sm font-bold">New Emergency Recovery Codes Generated</h4>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300">
            Save these backup recovery codes immediately in a secure vault. Each code may only be used once if you lose access to your authenticator app.
          </p>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2 font-mono text-xs shadow-xs">
            {recoveryCodes.map((code, idx) => (
              <div
                key={idx}
                className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-center font-bold text-sky-600 dark:text-sky-400 border border-slate-200 dark:border-slate-700 select-all"
              >
                {code}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(recoveryCodes.join('\n'));
                setCopiedCodes(true);
                setTimeout(() => setCopiedCodes(false), 2000);
              }}
              className="cursor-pointer border-slate-200 dark:border-slate-800"
            >
              {copiedCodes ? (
                <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5 mr-1" />
              )}
              {copiedCodes ? 'Copied to Clipboard' : 'Copy All Codes'}
            </Button>
            <Button type="button" size="sm" onClick={() => setRecoveryCodes(null)} className="cursor-pointer">
              I Have Stored Them Safely
            </Button>
          </div>
        </motion.div>
      )}

      {/* Step-Up Modal for Recovery Code Regeneration */}
      <AnimatePresence>
        {stepUpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !stepUpLoading && setStepUpOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-md max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] overflow-y-auto overscroll-contain rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl z-10 text-slate-900 dark:text-slate-100"
            >
              <button
                type="button"
                onClick={() => !stepUpLoading && setStepUpOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4 pr-8">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                    Authorize Recovery Code Regeneration
                  </h3>
                  <span className="inline-block mt-0.5 text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold font-mono">
                    Security Step-Up Verification
                  </span>
                </div>
              </div>

              <div className="text-xs font-normal text-slate-600 dark:text-slate-300 mb-5 leading-relaxed bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                Regenerating backup recovery codes will immediately invalidate all previously issued recovery codes. Please verify your credentials to confirm.
              </div>

              {stepUpError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-medium">
                  {stepUpError}
                </div>
              )}

              <form onSubmit={handleRegenerateSubmit} className="space-y-4">
                {requiresPasswordStepUp ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono tracking-wider">
                      {roleLabel} Password
                    </label>
                    <div className="relative">
                      <input
                        type={showStepUpPassword ? 'text' : 'password'}
                        placeholder="Enter your current password"
                        value={stepUpPassword}
                        onChange={(e) => setStepUpPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all shadow-2xs"
                        autoFocus
                        required
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <button
                        type="button"
                        onClick={() => setShowStepUpPassword(!showStepUpPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                        aria-label={showStepUpPassword ? 'Hide password' : 'Show password'}
                      >
                        {showStepUpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-center">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase font-mono tracking-wider">
                      6-Digit Authenticator Code
                    </label>
                    <div className="flex justify-center">
                      <OtpInput
                        ref={stepUpOtpRef}
                        length={6}
                        disabled={stepUpLoading}
                        status={stepUpError ? 'error' : 'idle'}
                        onChange={setStepUpMfaCode}
                        onComplete={(val) => {
                          setStepUpMfaCode(val);
                          handleRegenerateSubmit(undefined, val);
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setStepUpOpen(false)}
                    disabled={stepUpLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    isLoading={stepUpLoading}
                    disabled={
                      stepUpLoading ||
                      (requiresPasswordStepUp ? !stepUpPassword : stepUpMfaCode.length !== 6)
                    }
                  >
                    Confirm &amp; Regenerate
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* In-Portal TOTP Authenticator Enrollment Modal */}
      <AnimatePresence>
        {setupOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !setupVerifyLoading && setSetupOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-md max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] overflow-y-auto overscroll-contain rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl z-10 text-slate-900 dark:text-slate-100 space-y-4 text-center"
            >
              <button
                type="button"
                onClick={() => !setupVerifyLoading && setSetupOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                aria-label="Close setup dialog"
              >
                <X className="w-5 h-5" />
              </button>

              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                  Set Up Two-Factor Authentication
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Scan this QR code in Google Authenticator, Microsoft Authenticator, or Authy, then enter the 6-digit verification code.
                </p>
              </div>

              <div className="bg-white p-3 rounded-xl w-44 h-44 mx-auto flex items-center justify-center border border-slate-200 shadow-sm">
                {setupOtpUri && renderQr ? (
                  renderQr(setupOtpUri)
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-500 text-xs p-2">
                    <KeyRound className="w-8 h-8 text-sky-500 mb-1" />
                    <span className="font-mono">Use Manual Setup Key</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-200">
                <span className="truncate mr-2 text-left">
                  Key: <span className="font-bold select-all tracking-wider">{setupSecret}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(setupSecret);
                    setCopiedSecret(true);
                    setTimeout(() => setCopiedSecret(false), 2000);
                  }}
                  className="shrink-0 p-1 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded transition-colors flex items-center gap-1 text-[11px] font-sans font-semibold cursor-pointer"
                >
                  {copiedSecret ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedSecret ? 'Copied' : 'Copy Key'}
                </button>
              </div>

              {setupError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-medium">
                  {setupError}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Enter the 6-digit authenticator code to verify:
                </p>
                <div className="flex justify-center">
                  <OtpInput
                    ref={setupOtpRef}
                    length={6}
                    disabled={setupVerifyLoading}
                    status={setupError ? 'error' : 'idle'}
                    onChange={setSetupCode}
                    onComplete={(val) => {
                      setSetupCode(val);
                      handleCompleteSetup(val);
                    }}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSetupOpen(false)}
                  disabled={setupVerifyLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  isLoading={setupVerifyLoading}
                  disabled={setupCode.length !== 6 || setupVerifyLoading}
                  onClick={() => handleCompleteSetup()}
                >
                  Verify &amp; Activate TOTP
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

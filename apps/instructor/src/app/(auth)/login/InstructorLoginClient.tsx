"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, ShieldCheck, User, Lock, AlertCircle, CheckCircle2, Anchor, KeyRound, Copy, Check, Shield } from "lucide-react";
import Link from "next/link";
import { NeuralAccessLogin, NeuralInput, Button, Checkbox, WaveBackground, MercuryBackground, NeuralButton, OtpInput, type OtpInputHandle, HoneypotField, CookiePreferencesTrigger } from "@newsim/ui";
import QRCode from "react-qr-code";

type AuthState = 
  | "LOGIN" 
  | "LOADING" 
  | "MFA_REQUIRED" 
  | "MFA_LOADING" 
  | "MFA_SETUP" 
  | "RECOVERY_CODES" 
  | "RECOVERY_INPUT" 
  | "PASSWORD_RECOVERY" 
  | "ACCOUNT_LOCKED" 
  | "INACTIVE" 
  | "SUSPENDED" 
  | "SUCCESS";

export default function InstructorLoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authState, setAuthState] = useState<AuthState>("LOGIN");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Credentials
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [hpWebsite, setHpWebsite] = useState("");

  useEffect(() => {
    const errorParam = searchParams.get("error");
    const messageParam = searchParams.get("message");

    if (messageParam === "account_confirmed") {
      setSuccessMessage("Your account has been confirmed! You can now sign in with your credentials.");
    } else if (messageParam === "already_confirmed") {
      setSuccessMessage("Your account is already confirmed. Please sign in to continue.");
    }

    if (errorParam === "inactivity" || errorParam === "session_expired_inactivity") {
      setError("Your session has expired due to inactivity. Please log in again.");
    } else if (errorParam === "session_expired") {
      setError("Your session has expired. Please log in again.");
    } else if (errorParam === "unauthorized_portal" || errorParam === "portal_forbidden") {
      setError("You are not authorized to access the Instructor Portal.");
    } else if (errorParam === "invalid_token") {
      setError("This confirmation link is invalid. Please request a new confirmation email from your Super Admin.");
    } else if (errorParam === "expired_token") {
      setError("This confirmation link has expired. Please ask your Super Admin to resend the confirmation email.");
    } else if (errorParam === "activation_failed") {
      setError("We could not activate your account automatically. Please contact your Super Admin for assistance.");
    }
  }, [searchParams]);

  // MFA Challenge State
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCodeStr, setMfaCodeStr] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const mfaInputRef = useRef<OtpInputHandle>(null);

  // MFA Setup State
  const [setupSecret, setSetupSecret] = useState<string>("");
  const [setupOtpAuthUri, setSetupOtpAuthUri] = useState<string>("");
  const [setupRecoveryCodes, setSetupRecoveryCodes] = useState<string[]>([]);
  const [setupHashedCodesJson, setSetupHashedCodesJson] = useState<string>("");
  const [setupInputCode, setSetupInputCode] = useState("");
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const setupMfaInputRef = useRef<OtpInputHandle>(null);

  // Lockout Countdown State
  const [lockoutSecondsRemaining, setLockoutSecondsRemaining] = useState<number>(0);
  const [lockoutUntilTimestamp, setLockoutUntilTimestamp] = useState<string | null>(null);

  // Recovery State
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [isRecoveryLoading, setIsRecoveryLoading] = useState(false);

  // Restore active lockout on mount / page refresh so suspension continues seamlessly
  useEffect(() => {
    try {
      const saved = localStorage.getItem('newsim_lockout_instructor');
      if (saved) {
        const { lockoutUntil, error: savedError, identifier: savedId } = JSON.parse(saved);
        if (lockoutUntil) {
          const targetMs = new Date(lockoutUntil).getTime();
          const now = Date.now();
          const remaining = Math.max(0, Math.ceil((targetMs - now) / 1000));
          if (remaining > 0) {
            setLockoutUntilTimestamp(lockoutUntil);
            setLockoutSecondsRemaining(remaining);
            setAuthState("ACCOUNT_LOCKED");
            setError(savedError || "Account temporarily suspended due to repeated incorrect login attempts.");
            if (savedId) setIdentifier(savedId);
          } else {
            localStorage.removeItem('newsim_lockout_instructor');
          }
        }
      }
    } catch (e) {
      console.warn('Error reading saved lockout from localStorage:', e);
    }
  }, []);

  // Real-time clock-based countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (lockoutSecondsRemaining > 0) {
      timer = setInterval(() => {
        if (lockoutUntilTimestamp) {
          const targetMs = new Date(lockoutUntilTimestamp).getTime();
          const now = Date.now();
          const remaining = Math.max(0, Math.ceil((targetMs - now) / 1000));
          if (remaining <= 0) {
            setLockoutSecondsRemaining(0);
            setLockoutUntilTimestamp(null);
            setAuthState("LOGIN");
            setError(null);
            try {
              localStorage.removeItem('newsim_lockout_instructor');
            } catch {}
          } else {
            setLockoutSecondsRemaining(remaining);
          }
        } else {
          setLockoutSecondsRemaining((prev) => {
            if (prev <= 1) {
              setAuthState("LOGIN");
              setError(null);
              try {
                localStorage.removeItem('newsim_lockout_instructor');
              } catch {}
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [lockoutSecondsRemaining, lockoutUntilTimestamp]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!identifier || !password) {
      setError("Please enter your credentials.");
      return;
    }

    setAuthState("LOADING");
    
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          password,
          rememberMe,
          _hp_website: hpWebsite,
        }),
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("API returned non-JSON response:", text.substring(0, 200));
        setError("Unable to reach the authentication server. Ensure the backend is running.");
        setAuthState("LOGIN");
        return;
      }

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.code === "ACCOUNT_PERMANENTLY_LOCKED") {
          setAuthState("LOGIN");
          setError(data.error || "Your account has been suspended due to multiple incorrect login attempts. Please contact the administrator to reactivate your account, then try logging in again with the correct credentials.");
          setPassword("");
        } else if (data.code === "ACCOUNT_LOCKED" || res.status === 423) {
          const seconds = data.remainingSeconds || (data.lockoutUntil ? Math.max(0, Math.ceil((new Date(data.lockoutUntil).getTime() - Date.now()) / 1000)) : 300);
          const targetLockoutUntil = data.lockoutUntil || new Date(Date.now() + seconds * 1000).toISOString();
          setLockoutUntilTimestamp(targetLockoutUntil);
          setLockoutSecondsRemaining(seconds);
          setAuthState("ACCOUNT_LOCKED");
          setError(data.error || "Account temporarily suspended due to repeated incorrect login attempts.");
          setPassword("");

          try {
            localStorage.setItem('newsim_lockout_instructor', JSON.stringify({
              identifier: identifier.trim(),
              lockoutUntil: targetLockoutUntil,
              error: data.error,
              remainingSeconds: seconds,
            }));
          } catch (e) {
            console.warn('LocalStorage error:', e);
          }
        } else {
          setError(data.error || "Invalid credentials. Please check your email and password.");
          setAuthState("LOGIN");
        }
        return;
      }

      setMfaToken(data.mfaToken);

      if (data.mfaSetupRequired) {
        const setupRes = await fetch("/api/auth/mfa/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mfaToken: data.mfaToken }),
        });
        const setupData = await setupRes.json();
        if (setupData.success) {
          setSetupSecret(setupData.secret);
          setSetupOtpAuthUri(setupData.otpAuthUri);
          setSetupRecoveryCodes(setupData.recoveryCodes);
          setSetupHashedCodesJson(setupData.hashedCodesJson);
          setAuthState("MFA_SETUP");
        } else {
          setError("Failed to initialize App MFA setup.");
          setAuthState("LOGIN");
        }
      } else if (data.mfaRequired) {
        setAuthState("MFA_REQUIRED");
      } else {
        try {
          localStorage.removeItem('newsim_lockout_instructor');
        } catch {}
        setAuthState("SUCCESS");
        setTimeout(() => {
          router.push("/dashboard");
          router.refresh();
        }, 1000);
      }
    } catch {
      setError("Unable to connect to authentication server.");
      setAuthState("LOGIN");
    }
  };

  const handleMfaSubmit = async (codeOverride?: string) => {
    const code = typeof codeOverride === 'string' ? codeOverride : mfaCodeStr;
    if (code.length !== 6 || !mfaToken) return;

    setError(null);
    setAuthState("MFA_LOADING");

    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaToken, code, rememberMe }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.code === "ACCOUNT_PERMANENTLY_LOCKED") {
          setAuthState("LOGIN");
          setError(data.error || "Your account has been suspended due to multiple incorrect login attempts. Please contact the administrator to reactivate your account, then try logging in again with the correct credentials.");
          setPassword("");
          return;
        }
        if (data.code === "ACCOUNT_LOCKED" || res.status === 423) {
          const seconds = data.remainingSeconds || (data.lockoutUntil ? Math.max(0, Math.ceil((new Date(data.lockoutUntil).getTime() - Date.now()) / 1000)) : 300);
          const targetLockoutUntil = data.lockoutUntil || new Date(Date.now() + seconds * 1000).toISOString();
          setLockoutUntilTimestamp(targetLockoutUntil);
          setLockoutSecondsRemaining(seconds);
          setAuthState("ACCOUNT_LOCKED");
          setError(data.error || "Account temporarily suspended due to consecutive failed attempts.");
          setPassword("");

          try {
            localStorage.setItem('newsim_lockout_instructor', JSON.stringify({
              identifier: identifier.trim(),
              lockoutUntil: targetLockoutUntil,
              error: data.error,
              remainingSeconds: seconds,
            }));
          } catch (e) {
            console.warn('LocalStorage error:', e);
          }
          return;
        }
        setError(data.error || "Invalid verification code. Please try again.");
        setAuthState("MFA_REQUIRED");
        setMfaCodeStr("");
        mfaInputRef.current?.clear();
        return;
      }

      try {
        localStorage.removeItem('newsim_lockout_instructor');
      } catch {}
      setAuthState("SUCCESS");
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1000);
    } catch {
      setError("Network error during MFA verification.");
      setAuthState("MFA_REQUIRED");
    }
  };

  const handleSetupVerify = async (codeOverride?: string) => {
    const code = typeof codeOverride === 'string' ? codeOverride : setupInputCode;
    if (code.length !== 6 || !mfaToken || !setupSecret) return;

    setError(null);
    setAuthState("MFA_LOADING");

    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mfaToken,
          code,
          isSetupVerification: true,
          setupSecret,
          setupRecoveryCodes: setupHashedCodesJson,
          rememberMe,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Invalid 6-digit TOTP verification code.");
        setAuthState("MFA_SETUP");
        setSetupInputCode("");
        setupMfaInputRef.current?.clear();
        return;
      }

      setAuthState("RECOVERY_CODES");
    } catch {
      setError("Network error verifying MFA setup.");
      setAuthState("MFA_SETUP");
    }
  };

  const handleRecoveryCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryCode.trim() || !mfaToken) return;

    setError(null);
    setAuthState("MFA_LOADING");

    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaToken, recoveryCode: recoveryCode.trim(), rememberMe }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.code === "ACCOUNT_PERMANENTLY_LOCKED") {
          setAuthState("LOGIN");
          setError(data.error || "Your account has been suspended due to multiple incorrect login attempts. Please contact the administrator to reactivate your account, then try logging in again with the correct credentials.");
          setPassword("");
          return;
        }
        if (data.code === "ACCOUNT_LOCKED" || res.status === 423) {
          const seconds = data.remainingSeconds || 300;
          setLockoutSecondsRemaining(seconds);
          setAuthState("ACCOUNT_LOCKED");
          setError(data.error || "Account temporarily suspended.");
          setPassword("");
          return;
        }
        setError(data.error || "Invalid or used recovery code.");
        setAuthState("RECOVERY_INPUT");
        return;
      }

      setAuthState("SUCCESS");
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1000);
    } catch {
      setError("Network error validating recovery code.");
      setAuthState("RECOVERY_INPUT");
    }
  };

  const handlePasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail.trim()) {
      setError("Please enter your registered email address.");
      return;
    }
    setError(null);
    setIsRecoveryLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: recoveryEmail.trim(),
          _hp_website: hpWebsite,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to process recovery request.");
      } else {
        setError(data.message || "A password reset link has been dispatched to your email address.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsRecoveryLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 1, y: 0 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.3 } }
  };

  return (
    <NeuralAccessLogin title="INSTRUCTOR" subtitle="ACCESS" withWaterEffect={true}>
      <AnimatePresence mode="wait">
        {/* 1. LOGIN FORM */}
        {(authState === "LOGIN" || authState === "LOADING") && (
          <motion.div
            key="login-form"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full"
          >
            <form onSubmit={handleLogin} className="space-y-5">
              {successMessage && (
                <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-sm text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: "auto" }}
                  className="bg-red-500/10 border border-red-500/20 text-red-500 p-3.5 rounded-md text-sm flex items-start"
                >
                  <AlertCircle className="w-4 h-4 mr-2.5 mt-0.5 shrink-0" />
                  <div className="flex flex-col gap-1 text-left">
                    {error.toLowerCase().includes("temporarily suspended") ? (
                      <span className="font-bold text-red-400 tracking-wide uppercase text-xs">Account Temporarily Suspended</span>
                    ) : error.toLowerCase().includes("suspended") ? (
                      <span className="font-bold text-red-400 tracking-wide uppercase text-xs">Account Suspended</span>
                    ) : null}
                    <span className="leading-relaxed text-xs sm:text-sm">{error}</span>
                  </div>
                </motion.div>
              )}

              <NeuralInput
                label="Email Address"
                type="text"
                placeholder="instructor@newsim.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={authState === "LOADING"}
                required
              />

              <NeuralInput
                label="Password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={authState === "LOADING"}
                required
                rightAction={
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[#0B3D91]/60 hover:text-[#0B3D91] transition-colors focus:outline-none cursor-pointer p-1"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />

              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="remember" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={authState === "LOADING"} 
                  />
                  <label htmlFor="remember" className="text-sm text-[#0B3D91] cursor-pointer select-none font-medium">Remember me</label>
                </div>
                
                <button 
                  type="button"
                  onClick={() => setAuthState("PASSWORD_RECOVERY")}
                  className="text-sm text-[#0B3D91]/80 hover:text-[#0B3D91] transition-colors focus:outline-none font-medium"
                >
                  Forgot password?
                </button>
              </div>

              <HoneypotField value={hpWebsite} onChange={setHpWebsite} />

              <NeuralButton 
                type="submit" 
                isLoading={authState === "LOADING"}
                disabled={authState === "LOADING"}
              >
                {authState === "LOADING" ? "Authenticating..." : "Sign in"}
              </NeuralButton>

              <div className="pt-3 border-t border-[#0B3D91]/20 flex flex-wrap items-center justify-center gap-3 text-[11px] text-[#0B3D91]/80">
                <CookiePreferencesTrigger className="text-[11px] text-[#0B3D91]/80" />
              </div>
            </form>
          </motion.div>
        )}

        {/* 2. MFA REQUIRED */}
        {(authState === "MFA_REQUIRED" || authState === "MFA_LOADING") && (
          <motion.div
            key="mfa-form"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full space-y-4"
          >
            <div className="text-center">
              <h2 className="text-xl font-bold text-[#0B3D91] mb-2 font-heading">
                Two-Factor Authentication
              </h2>
              <p className="text-sm text-[#0B3D91]/80">
                Enter the 6-digit verification code from your authenticator app.
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-2.5 rounded-md text-xs text-center">
                {error}
              </div>
            )}

            <div className="flex justify-center mb-6">
              <OtpInput
                ref={mfaInputRef}
                length={6}
                disabled={authState === "MFA_LOADING"}
                status={error ? "error" : "idle"}
                onChange={setMfaCodeStr}
                onComplete={(val) => {
                  setMfaCodeStr(val);
                  handleMfaSubmit(val);
                }}
              />
            </div>

            <Button 
              onClick={() => handleMfaSubmit()}
              className="w-full h-11 mb-3" 
              isLoading={authState === "MFA_LOADING"}
              disabled={mfaCodeStr.length !== 6}
            >
              VERIFY MFA CODE
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => { setAuthState("RECOVERY_INPUT"); setError(null); }}
                className="text-xs text-[#0B3D91]/70 hover:text-[#0B3D91] transition-colors"
              >
                Lost authenticator? Use emergency recovery code
              </button>
            </div>

            <div className="text-center mt-2">
              <button 
                type="button"
                onClick={() => { setAuthState("LOGIN"); setError(null); }}
                className="text-xs text-[#0B3D91]/60 hover:text-[#0B3D91] transition-colors"
              >
                Back to Sign In
              </button>
            </div>
          </motion.div>
        )}

        {/* 3. MFA SETUP (FIRST TIME) */}
        {authState === "MFA_SETUP" && (
          <motion.div
            key="mfa-setup"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full text-center space-y-3"
          >
            <div>
              <h2 className="text-base font-semibold text-[#0B3D91] mb-1 font-heading">Set Up Two-Factor Authentication</h2>
              <p className="text-xs text-[#0B3D91]/70">
                Open Google Authenticator or Microsoft Authenticator, tap &ldquo;+&rdquo; and scan this QR code:
              </p>
            </div>

            <div className="bg-white p-3 rounded-lg w-44 h-44 mx-auto flex items-center justify-center border border-[#0B3D91]/20 shadow-md">
              {setupOtpAuthUri ? (
                <QRCode 
                  value={setupOtpAuthUri} 
                  size={152}
                  style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                />
              ) : (
                <div className="w-full h-full bg-white/50 rounded flex flex-col items-center justify-center text-[#0B3D91] p-2">
                  <KeyRound className="w-8 h-8 text-[#3BA7F2] mb-1" />
                  <span className="text-[9px] font-mono">Scan TOTP</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-[#D8EEFF] border border-[#0B3D91]/20 text-xs font-mono text-[#0B3D91]">
              <span className="truncate mr-2 text-left">Key: <span className="font-bold select-all tracking-wider">{setupSecret}</span></span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(setupSecret);
                  setCopiedSecret(true);
                  setTimeout(() => setCopiedSecret(false), 2000);
                }}
                className="shrink-0 p-1 hover:bg-[#0B3D91]/10 rounded transition-colors text-[#0B3D91] flex items-center gap-1 text-[11px] font-sans font-medium"
              >
                {copiedSecret ? <Check className="w-3.5 h-3.5 text-ocean-300" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSecret ? "Copied" : "Copy Key"}
              </button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-2 rounded-md text-xs">
                {error}
              </div>
            )}

            <div className="text-[11px] text-[#0B3D91]/70">
              Enter the 6-digit code from your authenticator:
            </div>

            <div className="flex justify-center mb-4">
              <OtpInput
                ref={setupMfaInputRef}
                length={6}
                disabled={false}
                status={error ? "error" : "idle"}
                errorMessage={error || ""}
                onChange={setSetupInputCode}
                onComplete={(val) => {
                  setSetupInputCode(val);
                  handleSetupVerify(val);
                }}
              />
            </div>

            <Button 
              onClick={() => handleSetupVerify()}
              className="w-full h-11"
              isLoading={false}
              disabled={setupInputCode.length !== 6}
            >
              VERIFY & ACTIVATE MFA
            </Button>
          </motion.div>
        )}

        {/* 4. RECOVERY CODES DISPLAY */}
        {authState === "RECOVERY_CODES" && (
          <motion.div
            key="recovery-codes-save"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full space-y-3"
          >
            <div className="text-center">
              <h2 className="text-base font-semibold text-[#0B3D91] mb-1 font-heading">Save Backup Recovery Codes</h2>
              <p className="text-xs text-[#0B3D91]/70">
                Store these backup codes in a safe place. You can use them if you lose access to your authenticator.
              </p>
            </div>

            <div className="bg-[#D8EEFF] border border-[#7FE7D6] rounded-md p-3">
              <div className="grid grid-cols-2 gap-1.5 text-xs font-mono text-center text-[#0B3D91]">
                {setupRecoveryCodes.map((c, i) => (
                  <span key={i} className="p-1 rounded bg-white/40">{c}</span>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1 text-xs"
                onClick={() => {
                  navigator.clipboard.writeText(setupRecoveryCodes.join("\n"));
                  setCopiedCodes(true);
                  setTimeout(() => setCopiedCodes(false), 2000);
                }}
              >
                {copiedCodes ? <Check className="w-3.5 h-3.5 mr-1 text-ocean-300" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copiedCodes ? "Copied" : "Copy Codes"}
              </Button>
            </div>

            <Button 
              onClick={() => {
                setAuthState("SUCCESS");
                setTimeout(() => {
                  router.push("/dashboard");
                  router.refresh();
                }, 1000);
              }}
              className="w-full h-11"
            >
              I HAVE SAVED THEM — PROCEED
            </Button>
          </motion.div>
        )}

        {/* 5. RECOVERY CODE INPUT */}
        {authState === "RECOVERY_INPUT" && (
          <motion.div
            key="recovery-input"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full space-y-4"
          >
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-[#0B3D91] mb-2 font-heading">Emergency Recovery Code</h2>
              <p className="text-sm text-[#0B3D91]/80">
                Enter one of your single-use backup recovery codes.
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-2.5 rounded-md text-xs text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleRecoveryCodeSubmit} className="space-y-4">
              <NeuralInput
                type="text"
                placeholder="A1B2-C3D4"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                className="font-mono text-center tracking-widest uppercase"
                required
              />
              
              <Button type="submit" className="w-full h-11" disabled={!recoveryCode.trim()}>
                VERIFY RECOVERY CODE
              </Button>
              
              <div className="text-center">
                <button 
                  type="button"
                  onClick={() => { setAuthState("MFA_REQUIRED"); setError(null); }}
                  className="text-xs text-[#0B3D91]/70 hover:text-[#0B3D91] transition-colors"
                >
                  Back to Authenticator App
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* 6. ACCOUNT LOCKED / TEMPORARILY SUSPENDED */}
        {authState === "ACCOUNT_LOCKED" && (
          <motion.div
            key="account-locked"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full text-center space-y-4 py-4"
          >
            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto border border-red-500/30">
              <Lock className="text-red-500 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#0B3D91] mb-1 font-heading">Account Temporarily Suspended</h2>
              <p className="text-xs text-[#0B3D91]/80 leading-relaxed mb-3">
                {error || "Account temporarily suspended for 5 minutes due to 5 consecutive failed login attempts."}
              </p>
              {lockoutSecondsRemaining > 0 && (
                <div className="inline-flex items-center gap-2 font-mono text-base font-bold text-red-600 bg-red-50 py-1 px-4 rounded-md border border-red-200">
                  <span>Cooldown:</span>
                  <span>{Math.floor(lockoutSecondsRemaining / 60)}:{(lockoutSecondsRemaining % 60).toString().padStart(2, '0')}</span>
                </div>
              )}
            </div>
            <Button 
              onClick={() => { 
                if (lockoutSecondsRemaining <= 0) {
                  setAuthState("LOGIN"); 
                  setIdentifier(""); 
                  setPassword(""); 
                  setError(null); 
                  try { localStorage.removeItem('newsim_lockout_instructor'); } catch {}
                }
              }}
              variant="secondary"
              className={`w-full h-11 font-mono tracking-wider ${lockoutSecondsRemaining > 0 ? "opacity-60 cursor-not-allowed" : ""}`}
              disabled={lockoutSecondsRemaining > 0}
            >
              {lockoutSecondsRemaining > 0 
                ? `SUSPENSION ACTIVE (${Math.floor(lockoutSecondsRemaining / 60)}:${(lockoutSecondsRemaining % 60).toString().padStart(2, '0')})` 
                : "RETURN TO SIGN IN"}
            </Button>
          </motion.div>
        )}

        {/* 7. PASSWORD RECOVERY */}
        {authState === "PASSWORD_RECOVERY" && (
          <motion.div
            key="password-recovery"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full"
          >
            <div className="mb-8">
              <h2 className="text-xl font-bold text-[#0B3D91] mb-2 font-heading">Account Recovery</h2>
              <p className="text-sm text-[#0B3D91]/80">
                Enter your official email or Instructor ID. If the account exists, recovery instructions will be provided.
              </p>
            </div>

            <form onSubmit={handlePasswordRecovery}>
              {error && (
                <div className="bg-[#D8EEFF] border border-[#7FE7D6] text-[#0B3D91]/80 p-3 rounded-md text-sm mb-6 flex items-start">
                  <ShieldCheck className="w-4 h-4 mr-2 mt-0.5 text-[#0B3D91]" />
                  <span>{error}</span>
                </div>
              )}
              <NeuralInput
                label="Email Address"
                type="email"
                placeholder="instructor@newsim.com"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                className="mb-6"
                required
              />
              
              <Button type="submit" className="w-full h-12 mb-4" isLoading={isRecoveryLoading}>
                {isRecoveryLoading ? "Sending Request..." : "REQUEST RECOVERY"}
              </Button>
              
              <div className="text-center mt-6">
                <button 
                  type="button"
                  onClick={() => {setAuthState("LOGIN"); setError(null);}}
                  className="text-sm text-[#0B3D91]/70 hover:text-[#0B3D91] transition-colors"
                >
                  Return to Sign In
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* 8. SUCCESS STATE */}
        {authState === "SUCCESS" && (
          <motion.div
            key="success"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full text-center flex flex-col items-center py-6"
          >
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="w-16 h-16 rounded-full bg-ocean-300/20 flex items-center justify-center mb-4 border border-ocean-300/40 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
            >
              <ShieldCheck className="text-ocean-300 w-8 h-8" />
            </motion.div>
            <h2 className="text-lg font-bold text-[#0B3D91] mb-1 font-heading">Authentication Verified</h2>
            <p className="text-xs text-[#0B3D91]/70">
              Entering Instructor Portal...
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </NeuralAccessLogin>
  );
}

"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, AlertCircle, Lock, CheckCircle2, KeyRound, Copy, Check } from "lucide-react";
import { NeuralAccessLogin, NeuralInput, Button, Checkbox, SocialAuthButton, NeuralButton, OtpInput, type OtpInputHandle, HoneypotField, CookiePreferencesTrigger } from "@newsim/ui";
import QRCode from "react-qr-code";
import { createClient } from "@/lib/supabase/client";

type AuthState = 
  | "LOGIN" 
  | "LOADING" 
  | "MFA_REQUIRED"
  | "MFA_LOADING"
  | "MFA_SETUP"
  | "RECOVERY_CODES"
  | "RECOVERY_INPUT"
  | "ACCOUNT_LOCKED" 
  | "SUCCESS";

export default function TraineeLoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authState, setAuthState] = useState<AuthState>("LOGIN");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [hpWebsite, setHpWebsite] = useState("");

  // MFA State
  const [mfaToken, setMfaToken] = useState("");
  const [mfaCodeStr, setMfaCodeStr] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [setupSecret, setSetupSecret] = useState("");
  const [setupOtpAuthUri, setSetupOtpAuthUri] = useState("");
  const [setupRecoveryCodes, setSetupRecoveryCodes] = useState<string[]>([]);
  const [setupHashedCodesJson, setSetupHashedCodesJson] = useState("");
  const [setupInputCode, setSetupInputCode] = useState("");
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const mfaInputRef = useRef<OtpInputHandle | null>(null);
  const setupMfaInputRef = useRef<OtpInputHandle | null>(null);

  // Lockout Countdown State
  const [lockoutSecondsRemaining, setLockoutSecondsRemaining] = useState<number>(0);
  const [lockoutUntilTimestamp, setLockoutUntilTimestamp] = useState<string | null>(null);
  const socialClickLockRef = React.useRef(false);

  // Restore active lockout on mount / page refresh
  useEffect(() => {
    try {
      const saved = localStorage.getItem('newsim_lockout_trainee');
      if (saved) {
        const { lockoutUntil, error: savedError, email: savedEmail } = JSON.parse(saved);
        if (lockoutUntil) {
          const targetMs = new Date(lockoutUntil).getTime();
          const now = Date.now();
          const remaining = Math.max(0, Math.ceil((targetMs - now) / 1000));
          if (remaining > 0) {
            setLockoutUntilTimestamp(lockoutUntil);
            setLockoutSecondsRemaining(remaining);
            setAuthState("ACCOUNT_LOCKED");
            setError(savedError || "Account temporarily suspended due to consecutive failed login attempts.");
            if (savedEmail) setEmail(savedEmail);
          } else {
            localStorage.removeItem('newsim_lockout_trainee');
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
              localStorage.removeItem('newsim_lockout_trainee');
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
                localStorage.removeItem('newsim_lockout_trainee');
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

  React.useEffect(() => {
    const errCode = searchParams.get("error");
    const msg = searchParams.get("message");

    if (msg === "registration_successful" || msg === "registered") {
      setSuccessMessage("Registration successful! Your trainee account is ready. Please sign in to access your portal.");
    } else if (msg === "account_confirmed") {
      setSuccessMessage("Your account has been successfully confirmed. You may now sign in.");
    } else if (msg === "already_confirmed") {
      setSuccessMessage("Your account is already confirmed. Please sign in.");
    } else if (msg === "account_exists") {
      setSuccessMessage("Your account already exists. Please sign in with your credentials or Google.");
    }

    if (!errCode) return;

    if (errCode === "inactivity" || errCode === "session_expired_inactivity") {
      setError("Your session has expired due to inactivity. Please log in again.");
      return;
    }

    const errorMap: Record<string, string> = {
      session_expired: "Your session has expired. Please log in again.",
      account_already_exists: "An account with this email already exists. Please sign in below.",
      missing_code: "Sign-in could not be completed. Please try again.",
      oauth_pkce_missing: "Your browser verification cookie expired or was cleared before returning from Google. Ensure cookies are enabled and avoid in-app browsers, then try again.",
      oauth_callback_failed: "Unable to complete sign-in. Please try again.",
      google_signin_failed: "Unable to sign in with Google. Please try again.",
      facebook_signin_failed: "Unable to sign in with Facebook. Please try again.",
      email_dispatch_failed: "Unable to dispatch your verification email. Please try again.",
      invalid_token: "The confirmation link is invalid or has already been used.",
      expired_token: "The confirmation link has expired. Please ask an administrator to resend your invitation.",
      activation_failed: "Failed to activate your account. Please contact the administrator.",
      profile_creation_failed: "Your NEWSIM profile could not be loaded. Please contact the administrator.",
      profile_not_found: "Your NEWSIM profile could not be loaded. Please contact the administrator.",
      unauthorized_portal: "Your account is not authorized to access the Trainee Portal.",
      account_suspended: "Your trainee account is currently suspended. Please contact NEWSIM.",
      account_locked: "Your account is currently locked. Please contact NEWSIM.",
      account_inactive: "Your account is inactive. Please contact NEWSIM.",
      account_pending: "Your account is pending email confirmation. Please check your email.",
      portal_forbidden: "Access denied to Trainee Portal.",
    };

    setError(errorMap[errCode] || "Authentication error. Please try again.");
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Please enter your email or Trainee ID and password.");
      return;
    }

    setAuthState("LOADING");
    
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: email,
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
          setError(data.error || "Account temporarily suspended due to consecutive failed login attempts.");
          setPassword("");

          try {
            localStorage.setItem('newsim_lockout_trainee', JSON.stringify({
              email: email.trim(),
              lockoutUntil: targetLockoutUntil,
              error: data.error,
              remainingSeconds: seconds,
            }));
          } catch (e) {
            console.warn('LocalStorage error:', e);
          }
        } else {
          setError(data.error || "Invalid email or password. Please try again.");
          setAuthState("LOGIN");
        }
        return;
      }

      setMfaToken(data.mfaToken || "");

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
          localStorage.removeItem('newsim_lockout_trainee');
        } catch {}
        setAuthState("SUCCESS");
        setTimeout(() => {
          router.push(data.redirectTo || "/dashboard");
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
          setError(data.error || "Your account has been suspended due to multiple incorrect login attempts.");
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
            localStorage.setItem('newsim_lockout_trainee', JSON.stringify({
              email: email.trim(),
              lockoutUntil: targetLockoutUntil,
              error: data.error,
              remainingSeconds: seconds,
            }));
          } catch {}
          return;
        }
        setError(data.error || "Invalid verification code. Please try again.");
        setAuthState("MFA_REQUIRED");
        setMfaCodeStr("");
        mfaInputRef.current?.clear();
        return;
      }

      try {
        localStorage.removeItem('newsim_lockout_trainee');
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

      try {
        localStorage.removeItem('newsim_lockout_trainee');
      } catch {}
      setAuthState("RECOVERY_CODES");
    } catch {
      setError("Network error during TOTP setup verification.");
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
        if (data.code === "ACCOUNT_LOCKED" || res.status === 423) {
          const seconds = data.remainingSeconds || 300;
          const targetLockoutUntil = data.lockoutUntil || new Date(Date.now() + seconds * 1000).toISOString();
          setLockoutUntilTimestamp(targetLockoutUntil);
          setLockoutSecondsRemaining(seconds);
          setAuthState("ACCOUNT_LOCKED");
          setError(data.error || "Account temporarily suspended.");
          setPassword("");
          return;
        }
        setError(data.error || "Invalid or already used recovery code.");
        setAuthState("RECOVERY_INPUT");
        return;
      }

      try {
        localStorage.removeItem('newsim_lockout_trainee');
      } catch {}
      setAuthState("SUCCESS");
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1000);
    } catch {
      setError("Network error during recovery code verification.");
      setAuthState("RECOVERY_INPUT");
    }
  };

  const handleSocialLogin = async (provider: 'Google' = 'Google') => {
    if (socialClickLockRef.current) return;
    if (typeof navigator !== "undefined" && /FB_IAB|FBAN|FBAV|Instagram|Line\/|MicroMessenger|;\s*wv\)/i.test(navigator.userAgent)) {
      setError("Google Sign-In is blocked inside embedded in-app browsers (such as Facebook or Messenger). Please open this page in Chrome or Safari and try again.");
      return;
    }
    socialClickLockRef.current = true;
    try {
      setError(null);
      setAuthState("LOADING");

      const secureAttr = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `newsim_oauth_flow=login; path=/; max-age=600; SameSite=Lax${secureAttr}`;
      document.cookie = `newsim_oauth_terms=; path=/; max-age=0; SameSite=Lax${secureAttr}`;

      const supabase = createClient();
      const redirectUrl = `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });
      if (error) throw error;
    } catch (err: any) {
      socialClickLockRef.current = false;
      console.error('Google OAuth error:', err);
      setError(err?.message || 'Failed to initialize Google sign-in.');
      setAuthState("LOGIN");
    }
  };

  const containerVariants = {
    hidden: { opacity: 1, y: 0 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.3 } }
  };

  return (
    <NeuralAccessLogin title="TRAINEE" subtitle="ACCESS" withWaterEffect={true}>
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
              <AnimatePresence mode="popLayout">
                {successMessage && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }} 
                    animate={{ opacity: 1, height: "auto", marginBottom: 20 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 p-3 rounded-md text-sm flex items-start"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 shrink-0" />
                    <span>{successMessage}</span>
                  </motion.div>
                )}
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }} 
                    animate={{ opacity: 1, height: "auto", marginBottom: 20 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    className="bg-red-500/10 border border-red-500/20 text-red-500 p-3.5 rounded-md text-sm flex items-start"
                  >
                    <AlertCircle className="w-4 h-4 mr-2.5 mt-0.5 shrink-0" />
                    <div className="flex flex-col gap-1 text-left">
                      {error.toLowerCase().includes("temporarily suspended") ? (
                        <span className="font-bold text-red-600 dark:text-red-400 tracking-wide uppercase text-xs">Account Temporarily Suspended</span>
                      ) : error.toLowerCase().includes("suspended") ? (
                        <span className="font-bold text-red-600 dark:text-red-400 tracking-wide uppercase text-xs">Account Suspended</span>
                      ) : null}
                      <span className="leading-relaxed text-xs sm:text-sm">{error}</span>
                      {error.includes("verify") && (
                        <Link href="/verify-email" className="text-red-700 underline font-medium hover:text-red-900 mt-1">
                          Resend Verification Email
                        </Link>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <NeuralInput
                label="Email Address" 
                type="text"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                    className="text-black/40 hover:text-black transition-colors focus:outline-none cursor-pointer p-1"
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
                    className="border-black/30 checked:bg-black checked:border-black" 
                    disabled={authState === "LOADING"} 
                  />
                  <label htmlFor="remember" className="text-sm text-black cursor-pointer select-none font-medium">
                    Remember me
                  </label>
                </div>
                
                <Link 
                  href="/forgot-password"
                  className="text-sm text-black hover:text-black/70 transition-colors focus:outline-none font-medium"
                >
                  Forgot password?
                </Link>
              </div>

              <HoneypotField value={hpWebsite} onChange={setHpWebsite} />

              <NeuralButton 
                type="submit" 
                isLoading={authState === "LOADING"}
                disabled={authState === "LOADING"}
              >
                {authState === "LOADING" ? "Authenticating..." : "Sign in"}
              </NeuralButton>
            </form>

            <div className="mt-8 mb-6 flex items-center gap-4">
              <div className="h-[1px] flex-1 bg-[#0B3D91]/25" />
              <span className="text-xs uppercase tracking-widest text-gray-500 font-mono">Or Continue With</span>
              <div className="h-[1px] flex-1 bg-[#0B3D91]/25" />
            </div>

            <div className="w-full">
              <SocialAuthButton
                provider="Google"
                onClick={() => handleSocialLogin('Google')}
                disabled={authState === "LOADING"}
                variant="light"
              />
            </div>

            <footer className="mt-10 flex flex-col items-center gap-3 font-mono text-sm uppercase">
              <div className="flex justify-center items-center">
                <span className="text-black font-semibold">NO ACCOUNT YET?</span>
                <Link href="/register" className="ml-2 text-black hover:text-black/70 transition-colors focus:outline-none font-bold underline">
                  SIGN UP
                </Link>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] font-sans normal-case text-gray-600">
                <CookiePreferencesTrigger className="text-[11px] text-gray-600 hover:text-black" />
              </div>
            </footer>
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
                className="text-xs text-[#0B3D91]/70 hover:text-[#0B3D91] transition-colors cursor-pointer"
              >
                Lost authenticator? Use emergency recovery code
              </button>
            </div>

            <div className="text-center mt-2">
              <button 
                type="button"
                onClick={() => { setAuthState("LOGIN"); setError(null); }}
                className="text-xs text-[#0B3D91]/60 hover:text-[#0B3D91] transition-colors cursor-pointer"
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
                className="shrink-0 p-1 hover:bg-[#0B3D91]/10 rounded transition-colors text-[#0B3D91] flex items-center gap-1 text-[11px] font-sans font-medium cursor-pointer"
              >
                {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
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
              VERIFY &amp; ACTIVATE MFA
            </Button>

            <div className="text-center mt-2">
              <button 
                type="button"
                onClick={() => { setAuthState("LOGIN"); setError(null); }}
                className="text-xs text-[#0B3D91]/60 hover:text-[#0B3D91] transition-colors cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
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
                {copiedCodes ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
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

        {/* 5. EMERGENCY RECOVERY CODE INPUT */}
        {authState === "RECOVERY_INPUT" && (
          <motion.div
            key="recovery-input"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full space-y-4"
          >
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold text-[#0B3D91] mb-2 font-heading">Emergency Recovery Code</h2>
              <p className="text-sm text-[#0B3D91]/80">
                Enter one of your 8-character backup recovery codes.
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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecoveryCode(e.target.value.toUpperCase())}
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
                  className="text-xs text-[#0B3D91]/70 hover:text-[#0B3D91] transition-colors cursor-pointer"
                >
                  Back to Authenticator App
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* 6. ACCOUNT LOCKED / TEMPORARILY SUSPENDED (5 CONSECUTIVE FAILED ATTEMPTS) */}
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
              <h2 className="text-base font-semibold text-black mb-1 font-heading">Account Temporarily Suspended</h2>
              <p className="text-xs text-gray-600 leading-relaxed mb-3">
                {error || "Your account has been temporarily suspended for 5 minutes due to 5 consecutive failed login attempts."}
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
                  setEmail(""); 
                  setPassword(""); 
                  setError(null); 
                  try { localStorage.removeItem('newsim_lockout_trainee'); } catch {}
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

        {/* 3. SUCCESS STATE */}
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
              className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4 border border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
            >
              <CheckCircle2 className="text-emerald-500 w-8 h-8" />
            </motion.div>
            <h2 className="text-lg font-bold text-black mb-1 font-heading">Authentication Verified</h2>
            <p className="text-xs text-gray-500">
              Entering Trainee Portal...
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </NeuralAccessLogin>
  );
}

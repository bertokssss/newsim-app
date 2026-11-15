"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { 
  NeuralAccessLogin, 
  NeuralInput, 
  Button,
  Checkbox, 
  SocialAuthButton, 
  PasswordStrength, 
  NeuralButton,
  OtpInput,
  type OtpInputHandle
} from "@newsim/ui";
import { createClient } from "@/lib/supabase/client";
import {
  executeRecaptchaChallenge,
  getLastRecaptchaError,
  getRecaptchaV2SiteKey,
  getRecaptchaV3SiteKey,
  RecaptchaControl,
  HoneypotField,
  trackAnalyticsEvent,
  CookiePreferencesTrigger,
} from "@newsim/ui";

type AuthState =
  | "IDLE"
  | "LOADING"
  | "ERROR"
  | "OTP_VERIFY"
  | "VERIFYING_OTP"
  | "GOOGLE_MATCH"
  | "VERIFYING_GOOGLE_MATCH"
  | "SUCCESS";

export default function TraineeRegisterClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authState, setAuthState] = useState<AuthState>("IDLE");
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [srn, setSrn] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [hpWebsite, setHpWebsite] = useState("");
  const [recaptchaV2Token, setRecaptchaV2Token] = useState<string | null>(null);

  // OTP Verification State (Manual Registration)
  const [otp, setOtp] = useState("");
  const [registrationToken, setRegistrationToken] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<number>(0);
  const [resending, setResending] = useState<boolean>(false);
  const otpInputRef = useRef<OtpInputHandle>(null);
  const socialClickLockRef = useRef<boolean>(false);

  // Google Number-Matching Security State (Third-Party Registration)
  const [googleMatchToken, setGoogleMatchToken] = useState<string | null>(null);
  const [googleMatchEmail, setGoogleMatchEmail] = useState<string>("");
  const [googleMatchName, setGoogleMatchName] = useState<string>("");
  const [googleMatchOptions, setGoogleMatchOptions] = useState<number[]>([]);
  const [selectedMatchNumber, setSelectedMatchNumber] = useState<number | null>(null);
  const [googleTermsPrompt, setGoogleTermsPrompt] = useState<boolean>(false);
  const initializedGoogleTokenRef = useRef<string | null>(null);

  useEffect(() => {
    const errParam = searchParams.get("error");
    if (!errParam) return;
    const regErrorMap: Record<string, string> = {
      email_dispatch_failed:
        "Google sign-in succeeded, but we could not send the 2-digit security verification email. Please try again shortly.",
      google_signin_failed: "Unable to complete Google registration. Please try again.",
      oauth_callback_failed: "Google verification could not be completed. Please try again.",
    };
    setError(regErrorMap[errParam] || "Unable to complete registration. Please try again.");
  }, [searchParams]);

  useEffect(() => {
    const isGoogleMatch = searchParams.get("google_match") === "1";
    const tokenParam = searchParams.get("token");
    if (!isGoogleMatch || !tokenParam) return;
    if (initializedGoogleTokenRef.current === tokenParam) return;
    initializedGoogleTokenRef.current = tokenParam;

    let cancelled = false;
    (async () => {
      setError(null);
      setAuthState("LOADING");
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "INIT_GOOGLE_MATCH",
            matchToken: tokenParam,
          }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.success) {
          setError(data.error || "Google security verification session has expired. Please try again.");
          setAuthState("IDLE");
          return;
        }
        setGoogleMatchToken(tokenParam);
        setGoogleMatchEmail(data.email || "");
        setGoogleMatchName(data.name || "");
        setGoogleMatchOptions(Array.isArray(data.options) ? data.options : []);
        setInfoMessage(
          `We sent a 2-digit security number to ${data.email}. Tap the matching number below to verify your Google registration.`
        );
        setCooldown(60);
        setAuthState("GOOGLE_MATCH");
      } catch {
        if (!cancelled) {
          setError("Unable to initialize Google security verification. Please try again.");
          setAuthState("IDLE");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [cooldown]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !srn.trim() || !password) {
      setError("Please fill in all required fields including your SRN.");
      return;
    }

    if (!agreedToTerms) {
      setError("You must accept the Terms of Service to continue.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 12) {
      setError("Password must be at least 12 characters long.");
      return;
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      setError("Password must include uppercase, lowercase, number, and special character.");
      return;
    }

    setAuthState("LOADING");
    
    try {
      // Execute reCAPTCHA for registration
      const recaptchaToken = await executeRecaptchaChallenge('trainee_register', recaptchaV2Token);
      if (!recaptchaToken) {
        const msg = getRecaptchaV2SiteKey()
          ? "Please complete the security verification check before creating an account."
          : getRecaptchaV3SiteKey()
          ? (getLastRecaptchaError() || "Google reCAPTCHA verification could not be completed. Please refresh the page or verify your reCAPTCHA configuration.")
          : (getLastRecaptchaError() || "Security verification service is unavailable. Please contact support.");
        setError(msg);
        setAuthState("IDLE");
        return;
      }

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: 'SEND_OTP',
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          mobile: mobile.trim(),
          srn: srn.trim(),
          password,
          agreedToTerms,
          recaptchaToken,
          _hp_website: hpWebsite,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to initiate trainee registration.");
      }

      setRegistrationToken(data.registrationToken);
      setInfoMessage(data.message || `A 6-digit verification code has been dispatched to ${email.trim()}.`);
      setAuthState("OTP_VERIFY");
      setCooldown(60);
      setOtp("");
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred during registration. Please try again.");
      setAuthState("ERROR");
    }
  };

  const handleVerifyOtp = async (codeOverride?: string) => {
    const code = typeof codeOverride === "string" ? codeOverride : otp;
    if (!registrationToken) {
      setError("Registration session has expired. Please fill in the details again.");
      setAuthState("IDLE");
      return;
    }

    if (code.trim().length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setError(null);
    setInfoMessage(null);
    setAuthState("VERIFYING_OTP");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: 'VERIFY_OTP',
          registrationToken,
          otp: code.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Incorrect or expired verification code.");
      }

      setAuthState("SUCCESS");
      trackAnalyticsEvent('sign_up', { method: 'email' });
      setTimeout(() => {
        router.push("/login?message=registration_successful");
        router.refresh();
      }, 1200);
    } catch (err: any) {
      setError(err?.message || "Invalid verification code. Please try again.");
      setAuthState("OTP_VERIFY");
      setOtp("");
      otpInputRef.current?.clear();
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    setInfoMessage(null);

    try {
      const recaptchaToken = await executeRecaptchaChallenge('trainee_register_resend', recaptchaV2Token);
      if (!recaptchaToken) {
        setError(
          getRecaptchaV2SiteKey()
            ? "Please complete the security verification check."
            : (getLastRecaptchaError() || "Security verification could not be completed. Please refresh and try again.")
        );
        setResending(false);
        return;
      }
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: 'SEND_OTP',
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          mobile: mobile.trim(),
          srn: srn.trim(),
          password,
          agreedToTerms,
          recaptchaToken,
          _hp_website: hpWebsite,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to resend verification code.");
      }

      setRegistrationToken(data.registrationToken);
      setInfoMessage(`A fresh verification code has been dispatched to ${email.trim()}.`);
      setCooldown(60);
      setOtp("");
      otpInputRef.current?.clear();
    } catch (err: any) {
      setError(err?.message || "Failed to resend code. Please try again.");
    } finally {
      setResending(false);
    }
  };

  const handleVerifyGoogleMatch = async (selectedNum: number) => {
    if (!googleMatchToken || authState === "VERIFYING_GOOGLE_MATCH") return;
    setSelectedMatchNumber(selectedNum);
    setError(null);
    setInfoMessage(null);
    setAuthState("VERIFYING_GOOGLE_MATCH");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "VERIFY_GOOGLE_MATCH",
          matchToken: googleMatchToken,
          selectedNumber: selectedNum,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.rotated && data.matchToken && Array.isArray(data.options)) {
          setGoogleMatchToken(data.matchToken);
          setGoogleMatchOptions(data.options);
        }
        setError(data.error || "Incorrect security number selected. Please check your email and try again.");
        setSelectedMatchNumber(null);
        setAuthState("GOOGLE_MATCH");
        return;
      }

      setAuthState("SUCCESS");
      trackAnalyticsEvent('sign_up', { method: 'google' });
      setTimeout(() => {
        router.push("/login?message=registration_successful");
        router.refresh();
      }, 1200);
    } catch (err: any) {
      setError(err?.message || "Failed to verify security number. Please try again.");
      setSelectedMatchNumber(null);
      setAuthState("GOOGLE_MATCH");
    }
  };

  const handleResendGoogleMatch = async () => {
    if (!googleMatchToken || cooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    setInfoMessage(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RESEND_GOOGLE_MATCH",
          matchToken: googleMatchToken,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send a new security number.");
      }

      setGoogleMatchToken(data.matchToken);
      setGoogleMatchOptions(Array.isArray(data.options) ? data.options : []);
      setInfoMessage(data.message || `A new 2-digit security number has been sent to ${googleMatchEmail}.`);
      setCooldown(60);
    } catch (err: any) {
      setError(err?.message || "Failed to send a new security number. Please try again.");
    } finally {
      setResending(false);
    }
  };

  const launchGoogleOAuth = async () => {
    if (socialClickLockRef.current) return;
    if (typeof navigator !== "undefined" && /FB_IAB|FBAN|FBAV|Instagram|Line\/|MicroMessenger|;\s*wv\)/i.test(navigator.userAgent)) {
      setError("Google Sign-In is blocked inside embedded in-app browsers (such as Facebook or Messenger). Please open this page in Chrome or Safari and try again.");
      return;
    }

    socialClickLockRef.current = true;
    try {
      setError(null);
      setGoogleTermsPrompt(false);
      setAuthState("LOADING");

      const secureAttr = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `newsim_oauth_flow=register; path=/; max-age=600; SameSite=Lax${secureAttr}`;
      document.cookie = `newsim_oauth_terms=1; path=/; max-age=600; SameSite=Lax${secureAttr}`;

      const supabase = createClient();
      const redirectUrl = `${window.location.origin}/auth/callback?flow=register&terms_agreed=1`;

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });
      if (oauthError) throw oauthError;
    } catch (err: any) {
      socialClickLockRef.current = false;
      console.error('Google registration error:', err);
      setError(err?.message || 'Failed to initialize Google registration.');
      setAuthState("IDLE");
    }
  };

  const handleSocialRegister = async (_provider: 'Google' = 'Google') => {
    if (!agreedToTerms) {
      setGoogleTermsPrompt(true);
      setError("Please agree to the NEWSIM Terms and Conditions and Privacy Policy before registering with Google.");
      return;
    }
    await launchGoogleOAuth();
  };

  const handleAgreeAndGoogleRegister = async () => {
    setAgreedToTerms(true);
    setGoogleTermsPrompt(false);
    await launchGoogleOAuth();
  };

  const containerVariants = {
    hidden: { opacity: 1, y: 0 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.3 } }
  };

  const isOtpStep = authState === "OTP_VERIFY" || authState === "VERIFYING_OTP";
  const isGoogleMatchStep = authState === "GOOGLE_MATCH" || authState === "VERIFYING_GOOGLE_MATCH";
  const isVerificationStep = isOtpStep || isGoogleMatchStep;

  return (
    <NeuralAccessLogin 
      title={isVerificationStep ? "VERIFY" : "REGISTER"} 
      subtitle={isGoogleMatchStep ? "GOOGLE" : isOtpStep ? "EMAIL" : "TRAINEE"} 
      withWaterEffect={true} 
      containerClassName={isVerificationStep ? undefined : "!max-w-[480px] sm:!max-w-[520px]"}
    >
      <AnimatePresence mode="wait">
        {/* ======================================================== */}
        {/* STEP 1: INITIAL REGISTRATION FORM                       */}
        {/* ======================================================== */}
        {(authState === "IDLE" || authState === "LOADING" || authState === "ERROR") && (
          <motion.div
            key="register-form"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full"
          >
            <p className="text-xs text-[#0B3D91]/70 leading-relaxed -mt-8 mb-6 font-sans">
              Create an account to begin your maritime journey, access simulator training, and track your progress across all modules.
            </p>

            {/* Quick 1-Click Authenticate with Google (with Number-Matching Security) */}
            <div className="w-full space-y-3">
              <SocialAuthButton
                provider="Google"
                onClick={() => handleSocialRegister('Google')}
                disabled={authState === "LOADING"}
                variant="light"
              />
              {googleTermsPrompt && !agreedToTerms && (
                <div className="rounded-lg border border-[#0B3D91]/25 bg-[#0B3D91]/5 p-3 text-xs text-slate-800 space-y-2.5">
                  <p className="leading-relaxed">
                    To register with Google, confirm that you agree to the NEWSIM{' '}
                    <Link href="/terms" className="text-[#0B3D91] font-bold underline">Terms and Conditions</Link>
                    {' '}and{' '}
                    <Link href="/privacy" className="text-[#0B3D91] font-bold underline">Privacy Policy</Link>.
                  </p>
                  <button
                    type="button"
                    onClick={handleAgreeAndGoogleRegister}
                    disabled={authState === "LOADING"}
                    className="w-full py-2 px-3 rounded-md bg-[#0B3D91] hover:bg-[#092f73] text-white font-semibold transition-colors cursor-pointer disabled:opacity-60"
                  >
                    Agree &amp; Continue with Google
                  </button>
                </div>
              )}
            </div>

            {/* Vertical Divider */}
            <div className="my-6 flex items-center gap-4">
              <div className="h-[1px] flex-1 bg-[#0B3D91]/25" />
              <span className="text-[10px] uppercase tracking-widest text-gray-500 font-mono shrink-0">
                Or Register With Email
              </span>
              <div className="h-[1px] flex-1 bg-[#0B3D91]/25" />
            </div>

            {/* Registration Form */}
            <form onSubmit={handleRegister} className="space-y-4">
              <AnimatePresence mode="popLayout">
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }} 
                    animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-md text-sm flex items-start"
                  >
                    <AlertCircle className="w-4 h-4 mr-2 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* First & Last Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <NeuralInput
                  label="First Name"
                  type="text"
                  placeholder="Juan"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={authState === "LOADING"}
                  required
                />
                <NeuralInput
                  label="Last Name"
                  type="text"
                  placeholder="Dela Cruz"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={authState === "LOADING"}
                  required
                />
              </div>

              {/* Email Address */}
              <NeuralInput
                label="Email Address"
                type="email"
                placeholder="seafarer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={authState === "LOADING"}
                required
              />

              {/* Mobile Number */}
              <NeuralInput
                label="Mobile Number"
                type="tel"
                placeholder="+63 917 123 4567"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                disabled={authState === "LOADING"}
              />

              {/* Seafarer's Registration Number (SRN) */}
              <NeuralInput
                label="Seafarer's Registration Number (SRN)"
                type="text"
                placeholder="e.g. SRN-2026-0001"
                value={srn}
                onChange={(e) => setSrn(e.target.value)}
                disabled={authState === "LOADING"}
                required
              />

              {/* Password */}
              <div>
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
                {password && (
                  <div className="mt-2">
                    <PasswordStrength password={password} />
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <NeuralInput
                  label="Confirm Password"
                  type={showConfirm ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={authState === "LOADING"}
                  required
                  rightAction={
                    <button 
                      type="button" 
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="text-black/40 hover:text-black transition-colors focus:outline-none cursor-pointer p-1"
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
              </div>

              {/* Terms & Conditions */}
              <div className="pt-2">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <Checkbox 
                      id="terms" 
                      className="border-black/30 checked:bg-black checked:border-black"
                      checked={agreedToTerms} 
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setAgreedToTerms(checked);
                        if (checked) {
                          setGoogleTermsPrompt(false);
                          if (error?.includes("Terms and Conditions")) {
                            setError(null);
                          }
                        }
                      }}
                      disabled={authState === "LOADING"} 
                    />
                  </div>
                  <label htmlFor="terms" className="text-sm text-black leading-relaxed cursor-pointer select-none">
                    I agree to the NEWSIM{' '}
                    <Link href="/terms" className="text-black hover:underline font-bold">Terms and Conditions</Link>
                    {' '}and acknowledge the{' '}
                    <Link href="/privacy" className="text-black hover:underline font-bold">Privacy Policy</Link>.
                  </label>
                </div>
              </div>

              <HoneypotField value={hpWebsite} onChange={setHpWebsite} />
              <RecaptchaControl onTokenChange={setRecaptchaV2Token} theme="light" />

              {/* Submit Button */}
              <div className="pt-3">
                <NeuralButton 
                  type="submit" 
                  isLoading={authState === "LOADING"}
                  disabled={authState === "LOADING"}
                >
                  {authState === "LOADING" ? "Sending Verification Code..." : "Create Account"}
                </NeuralButton>
              </div>

              {/* Footer Navigation Link */}
              <footer className="mt-8 pt-6 border-t border-[#0B3D91]/25 flex flex-col items-center gap-3 font-mono text-sm uppercase">
                <div className="flex justify-center items-center">
                  <span className="text-black font-semibold">ALREADY HAVE AN ACCOUNT?</span>
                  <Link 
                    href="/login" 
                    className="ml-2 text-black hover:text-black/70 transition-colors focus:outline-none font-bold underline tracking-wider"
                  >
                    SIGN IN
                  </Link>
                </div>
                <CookiePreferencesTrigger className="text-xs font-sans normal-case text-[#0B3D91]/80" />
              </footer>
            </form>
          </motion.div>
        )}

        {/* ======================================================== */}
        {/* STEP 2A: EMAIL OTP VERIFICATION (MANUAL REGISTRATION)    */}
        {/* ======================================================== */}
        {isOtpStep && (
          <motion.div
            key="otp-verification"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full space-y-4"
          >
            <div className="text-center">
              <h2 className="text-xl font-bold text-[#0B3D91] mb-2 font-heading">
                Email Verification
              </h2>
              <p className="text-sm text-[#0B3D91]/80">
                Enter the 6-digit verification code sent to <span className="font-semibold text-[#0B3D91]">{email}</span>.
              </p>
            </div>

            {infoMessage && !error && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 p-2.5 rounded-md text-xs text-center">
                {infoMessage}
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-2.5 rounded-md text-xs text-center">
                {error}
              </div>
            )}

            <div className="flex justify-center mb-6">
              <OtpInput
                ref={otpInputRef}
                length={6}
                autoFocus
                disabled={authState === "VERIFYING_OTP"}
                status={error ? "error" : "idle"}
                onChange={(val) => {
                  setOtp(val);
                  if (error) setError(null);
                }}
                onComplete={(val) => {
                  setOtp(val);
                  handleVerifyOtp(val);
                }}
              />
            </div>

            <Button
              onClick={() => handleVerifyOtp()}
              className="w-full h-11 mb-3"
              isLoading={authState === "VERIFYING_OTP"}
              disabled={otp.length !== 6}
            >
              VERIFY OTP CODE
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={cooldown > 0 || resending}
                className={`text-xs text-[#0B3D91]/70 hover:text-[#0B3D91] transition-colors ${
                  cooldown > 0 || resending ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                {cooldown > 0
                  ? `Resend verification code in ${cooldown}s`
                  : resending
                  ? "Sending fresh code..."
                  : "Didn't receive a code? Resend verification code"}
              </button>
            </div>

            <div className="text-center mt-2">
              <button
                type="button"
                onClick={() => {
                  setAuthState("IDLE");
                  setError(null);
                  setInfoMessage(null);
                  setOtp("");
                }}
                className="text-xs text-[#0B3D91]/60 hover:text-[#0B3D91] transition-colors cursor-pointer"
              >
                Back to Registration
              </button>
            </div>
          </motion.div>
        )}

        {/* ======================================================== */}
        {/* STEP 2B: GOOGLE NUMBER-MATCHING SECURITY CONFIRMATION    */}
        {/* ======================================================== */}
        {isGoogleMatchStep && (
          <motion.div
            key="google-number-match"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full space-y-5"
          >
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#0B3D91]/10 border border-[#0B3D91]/25 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-[#0B3D91]" />
              </div>
              <h2 className="text-xl font-bold text-[#0B3D91] mb-1.5 font-heading">
                Confirm Your Google Registration
              </h2>
              <p className="text-xs text-[#0B3D91]/80 leading-relaxed">
                Open the security email sent to{' '}
                <span className="font-semibold text-[#0B3D91]">{googleMatchEmail || "your Google email"}</span>{' '}
                and tap the matching 2-digit number below to verify it&apos;s you.
              </p>
            </div>

            {infoMessage && !error && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 p-2.5 rounded-md text-xs text-center">
                {infoMessage}
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-2.5 rounded-md text-xs text-center">
                {error}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 py-2">
              {googleMatchOptions.map((num) => {
                const isSelected = selectedMatchNumber === num && authState === "VERIFYING_GOOGLE_MATCH";
                return (
                  <button
                    key={num}
                    type="button"
                    disabled={authState === "VERIFYING_GOOGLE_MATCH"}
                    onClick={() => handleVerifyGoogleMatch(num)}
                    className={`h-20 rounded-xl border-2 font-mono text-2xl font-extrabold tracking-wider transition-all flex flex-col items-center justify-center shadow-sm ${
                      isSelected
                        ? "bg-[#0B3D91] text-white border-[#0B3D91] scale-[0.98]"
                        : "bg-white/90 text-[#0B3D91] border-[#0B3D91]/25 hover:border-[#0B3D91] hover:bg-[#0B3D91]/5 cursor-pointer"
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    <span>{num}</span>
                    {isSelected && (
                      <span className="text-[10px] font-sans font-medium uppercase tracking-widest mt-1 text-white/90">
                        Verifying...
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={handleResendGoogleMatch}
                disabled={cooldown > 0 || resending || authState === "VERIFYING_GOOGLE_MATCH"}
                className={`text-xs text-[#0B3D91]/75 hover:text-[#0B3D91] transition-colors ${
                  cooldown > 0 || resending || authState === "VERIFYING_GOOGLE_MATCH"
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer"
                }`}
              >
                {cooldown > 0
                  ? `Send a new security number in ${cooldown}s`
                  : resending
                  ? "Sending new security number..."
                  : "Didn't receive the number? Send a new 2-digit number"}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setAuthState("IDLE");
                  setError(null);
                  setInfoMessage(null);
                  setGoogleMatchToken(null);
                  router.replace("/register");
                }}
                className="text-xs text-[#0B3D91]/60 hover:text-[#0B3D91] transition-colors cursor-pointer"
              >
                Cancel & Back to Registration
              </button>
            </div>
          </motion.div>
        )}

        {/* ======================================================== */}
        {/* STEP 3: SUCCESS STATE                                    */}
        {/* ======================================================== */}
        {authState === "SUCCESS" && (
          <motion.div
            key="success-step"
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
            <h2 className="text-lg font-bold text-black mb-1 font-heading">Account Created & Verified</h2>
            <p className="text-xs text-gray-500">
              Redirecting to Trainee Access portal...
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </NeuralAccessLogin>
  );
}

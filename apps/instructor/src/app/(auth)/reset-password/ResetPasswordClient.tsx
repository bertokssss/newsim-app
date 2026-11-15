"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, ShieldCheck, ArrowRight, KeyRound } from "lucide-react";
import { AppInput } from '@newsim/ui';
import { Button } from '@newsim/ui';
import { PasswordStrength } from '@newsim/ui';

export default function ResetPasswordClient() {
  const router = useRouter();
  const [status, setStatus] = useState<"IDLE" | "LOADING" | "SUCCESS">("IDLE");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [tokenHash, setTokenHash] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Check URL hash (Supabase standard recovery format: #access_token=...&type=recovery)
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const hashToken = hashParams.get("access_token") || hashParams.get("token");
      const hashTokenHash = hashParams.get("token_hash");
      if (hashToken) setAccessToken(hashToken);
      if (hashTokenHash) setTokenHash(hashTokenHash);
    }

    // 2. Check query search params (?access_token=... or ?code=... or ?email=... or ?token_hash=...)
    const searchParams = new URLSearchParams(window.location.search);
    const queryToken = searchParams.get("access_token") || searchParams.get("token");
    const queryCode = searchParams.get("code");
    const queryTokenHash = searchParams.get("token_hash");
    const queryEmail = searchParams.get("email");

    if (queryToken && !accessToken) setAccessToken(queryToken);
    if (queryCode) setCode(queryCode);
    if (queryTokenHash) setTokenHash(queryTokenHash);
    if (queryEmail) {
      setEmail(queryEmail);
      setAccountEmail(queryEmail);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    
    if (password.length < 12) {
      setError("Password must contain at least 12 characters.");
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError("Password must include at least one uppercase letter (A-Z).");
      return;
    }

    if (!/[a-z]/.test(password)) {
      setError("Password must include at least one lowercase letter (a-z).");
      return;
    }

    if (!/[0-9]/.test(password)) {
      setError("Password must include at least one number (0-9).");
      return;
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      setError("Password must include at least one special character (!@#$%^&* etc.).");
      return;
    }

    setStatus("LOADING");
    
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPassword: password,
          accessToken,
          code,
          token_hash: tokenHash,
          email: email || accountEmail.trim().toLowerCase() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to update password. Your recovery link may have expired.");
        setStatus("IDLE");
        return;
      }

      setStatus("SUCCESS");
    } catch {
      setError("Unable to update password right now. Please try again.");
      setStatus("IDLE");
    }
  };

  return (
    <div className="min-h-screen w-full bg-[var(--color-navy-950)] flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_var(--color-navy-800)_0%,_transparent_60%)] opacity-30" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md bg-[var(--color-navy-900)]/90 backdrop-blur-md rounded-2xl overflow-hidden shadow-2xl border border-[var(--color-border)] relative z-10 p-8 sm:p-12 text-center"
      >
        <AnimatePresence mode="wait">
          {status !== "SUCCESS" ? (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <div className="w-16 h-16 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full flex items-center justify-center mx-auto mb-6">
                <KeyRound className="w-8 h-8 text-white" />
              </div>

              <h1 className="text-2xl font-bold text-white mb-2 font-heading">Create a New Password</h1>
              <p className="text-[var(--color-text-secondary)] text-sm mb-8 leading-relaxed">
                Please enter your new password below to regain access to your Instructor account.
              </p>

              <form onSubmit={handleSubmit} className="space-y-6 text-left">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-md text-sm mb-4">
                    {error}
                  </div>
                )}

                <div>
                  <AppInput
                    label="New Password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={status === "LOADING"}
                    required
                    icon={
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)}
                        className="hover:text-white transition-colors focus:outline-none cursor-pointer"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                  />
                  <PasswordStrength password={password} minLength={12} showAlways={true} />
                </div>

                <div>
                  <AppInput
                    label="Confirm New Password"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Confirm your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={status === "LOADING"}
                    required
                    icon={
                      <button 
                        type="button" 
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="hover:text-white transition-colors focus:outline-none cursor-pointer"
                        aria-label={showConfirm ? "Hide password" : "Show password"}
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                  />
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-12 mt-2"
                  isLoading={status === "LOADING"}
                >
                  {status === "LOADING" ? "Updating password..." : "Reset Password"}
                </Button>
              </form>
            </motion.div>
          ) : (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="w-20 h-20 bg-[var(--color-ocean-500)]/20 border border-[var(--color-ocean-500)]/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShieldCheck className="w-10 h-10 text-[var(--color-ocean-500)]" />
              </div>

              <h1 className="text-2xl font-bold text-white mb-3 font-heading">Password Updated</h1>
              <p className="text-[var(--color-text-secondary)] mb-8 leading-relaxed text-sm">
                Your password has been successfully updated. You can now sign in with your new credentials.
              </p>

              <Link href="/login">
                <Button className="w-full h-12 flex items-center justify-center gap-2">
                  Continue to Sign In
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

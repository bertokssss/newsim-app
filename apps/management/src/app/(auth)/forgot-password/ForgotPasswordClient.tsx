"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, ArrowLeft, ShieldCheck, ExternalLink } from "lucide-react";
import { AppInput, Button, HoneypotField } from '@newsim/ui';

export default function ForgotPasswordClient() {
  const [email, setEmail] = useState("");
  const [hpWebsite, setHpWebsite] = useState("");
  const [status, setStatus] = useState<"IDLE" | "LOADING" | "SUCCESS">("IDLE");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === "LOADING") return;

    setError(null);
    setStatus("LOADING");
    
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, _hp_website: hpWebsite }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send reset link.");
        setStatus("IDLE");
        return;
      }
      setStatus("SUCCESS");
    } catch {
      setError("Unable to process password reset. Please try again.");
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

              <h1 className="text-2xl font-bold text-white mb-2 font-heading">Forgot Your Password?</h1>
              <p className="text-[var(--color-text-secondary)] text-sm mb-8 leading-relaxed">
                Enter the official email address associated with your Management account and we'll send you a password reset link.
              </p>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-md text-xs mb-4 text-center">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6 text-left">
                <AppInput
                  label="Email Address"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status === "LOADING"}
                  required
                />
                
                <HoneypotField value={hpWebsite} onChange={setHpWebsite} />

                <Button 
                  type="submit" 
                  className="w-full h-12"
                  isLoading={status === "LOADING"}
                  disabled={status === "LOADING"}
                >
                  {status === "LOADING" ? "Sending Link..." : "Send Reset Link"}
                </Button>
              </form>

              <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
                <Link href="/login" className="text-sm text-[var(--color-text-secondary)] hover:text-white transition-colors flex items-center justify-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Return to Sign In
                </Link>
              </div>
            </motion.div>
          ) : (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="w-20 h-20 bg-[var(--color-ocean-500)]/20 border border-[var(--color-ocean-500)]/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShieldCheck className="w-10 h-10 text-[var(--color-ocean-500)]" />
              </div>

              <h1 className="text-2xl font-bold text-white mb-3 font-heading">Check Your Email</h1>
              <p className="text-[var(--color-text-secondary)] mb-6 leading-relaxed text-sm">
                A password reset link has been dispatched to <strong>{email}</strong>. Please check your inbox and click the link to proceed with resetting your password.
              </p>

              <div className="mt-4 pt-6 border-t border-[var(--color-border)]">
                <Link href="/login" className="text-sm text-[var(--color-text-secondary)] hover:text-white transition-colors flex items-center justify-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Return to Sign In
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

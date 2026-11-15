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
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-900/60 flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_#3BA7F2_0%,_transparent_60%)] opacity-20" />

      <motion.div 
        initial={{ opacity: 1, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md bg-white dark:bg-[#0c1a2c] backdrop-blur-md rounded-3xl overflow-hidden shadow-2xl border border-slate-200/80 dark:border-slate-800 relative z-10 p-8 sm:p-12 text-center"
      >
        <AnimatePresence mode="wait">
          {status !== "SUCCESS" ? (
            <motion.div key="form" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 1, scale: 0.95 }}>
              <div className="w-16 h-16 bg-sky-500/10 border border-slate-200/80 dark:border-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-900 dark:text-sky-400">
                <KeyRound className="w-8 h-8" />
              </div>

              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] mb-2 font-heading">Forgot Your Password?</h1>
              <p className="text-slate-600 dark:text-[#CBD5E1] text-sm mb-8 leading-relaxed">
                Enter the email address associated with your NEWSIM trainee account and we'll send you a password reset link.
              </p>

              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 p-3 rounded-xl text-xs mb-4 text-center">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6 text-left">
                <AppInput
                  label="Email Address"
                  type="email"
                  placeholder="trainee@newsim.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status === "LOADING"}
                  required
                />
                
                <HoneypotField value={hpWebsite} onChange={setHpWebsite} />

                <Button 
                  type="submit" 
                  className="w-full h-12 bg-sky-600 hover:bg-sky-700 hover:opacity-95 text-white font-bold shadow-md shadow-sky-500/20"
                  isLoading={status === "LOADING"}
                  disabled={status === "LOADING"}
                >
                  {status === "LOADING" ? "Sending Link..." : "Send Reset Link"}
                </Button>
              </form>

              <div className="mt-8 pt-6 border-t border-slate-200/80 dark:border-slate-800">
                <Link href="/login" className="text-sm text-slate-900 dark:text-sky-400 font-semibold hover:underline transition-colors flex items-center justify-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Return to Sign In
                </Link>
              </div>
            </motion.div>
          ) : (
            <motion.div key="success" initial={{ opacity: 1, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="w-20 h-20 bg-sky-500/10 border border-sky-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-900 dark:text-sky-400">
                <ShieldCheck className="w-10 h-10" />
              </div>

              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] mb-3 font-heading">Check Your Email</h1>
              <p className="text-slate-600 dark:text-[#CBD5E1] mb-6 leading-relaxed text-sm">
                A password reset link has been dispatched to <strong>{email}</strong>. Please check your inbox and click the link to proceed with resetting your password.
              </p>

              <div className="mt-4 pt-6 border-t border-slate-200/80 dark:border-slate-800">
                <Link href="/login" className="text-sm text-slate-900 dark:text-sky-400 font-semibold hover:underline transition-colors flex items-center justify-center gap-2">
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

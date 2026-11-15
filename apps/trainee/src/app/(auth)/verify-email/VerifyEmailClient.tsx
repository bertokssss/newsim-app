"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, ArrowRight, ShieldCheck } from "lucide-react";
import {  Button  } from '@newsim/ui';

export default function VerifyEmailClient() {
  const router = useRouter();
  const [cooldown, setCooldown] = useState(45);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  // Mock cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleResend = () => {
    if (cooldown === 0) {
      setCooldown(45);
      // Logic to trigger backend resend...
    }
  };

  const handleSimulateVerify = () => {
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      setVerified(true);
    }, 1500);
  };

  const handleContinue = () => {
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-900/60 flex items-center justify-center p-4 relative">
      
      {/* Background Decor */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_#3BA7F2_0%,_transparent_50%)] opacity-20" />

      <motion.div 
        initial={{ opacity: 1, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md bg-white dark:bg-[#0c1a2c] backdrop-blur-md rounded-3xl overflow-hidden shadow-2xl border border-slate-200/80 dark:border-slate-800 relative z-10 p-8 sm:p-12 text-center"
      >
        {!verified ? (
          <>
            <div className="w-20 h-20 bg-sky-500/10 border border-slate-200/80 dark:border-slate-800 rounded-full flex items-center justify-center mx-auto mb-8 text-slate-900 dark:text-sky-400">
              <Mail className="w-10 h-10" />
            </div>

            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] mb-3 font-heading">Verify Your Email</h1>
            <p className="text-slate-600 dark:text-[#CBD5E1] mb-8 leading-relaxed">
              We've sent a verification link to your email address.
              <br />
              <strong className="text-slate-900 dark:text-white font-medium mt-2 block">j••••••@gmail.com</strong>
            </p>

            <div className="space-y-4">
              <Button 
                onClick={handleSimulateVerify}
                className="w-full h-12 bg-sky-600 hover:bg-sky-700 hover:opacity-95 text-white font-bold shadow-md shadow-sky-500/20"
                isLoading={verifying}
              >
                {verifying ? "Verifying..." : "Open Email App"}
              </Button>
              
              <Button 
                variant="secondary"
                onClick={handleResend}
                disabled={cooldown > 0}
                className="w-full h-12 border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-white"
              >
                {cooldown > 0 ? `Resend available in 00:${cooldown.toString().padStart(2, '0')}` : "Resend Verification Email"}
              </Button>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-200/80 dark:border-slate-800">
              <Link href="/register" className="text-sm text-slate-900 dark:text-sky-400 font-semibold hover:underline transition-colors">
                Change Email Address
              </Link>
            </div>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 1, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="w-24 h-24 bg-sky-500/10 border border-sky-500/20 rounded-full flex items-center justify-center mx-auto mb-8 text-slate-900 dark:text-sky-400">
              <ShieldCheck className="w-12 h-12" />
            </div>

            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] mb-3 font-heading">Email Verified</h1>
            <p className="text-slate-600 dark:text-[#CBD5E1] mb-10 leading-relaxed">
              Your NEWSIM trainee account is ready.
            </p>

            <Button 
              onClick={handleContinue}
              className="w-full h-12 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 hover:opacity-95 text-white font-bold"
            >
              Continue to Trainee Portal
              <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

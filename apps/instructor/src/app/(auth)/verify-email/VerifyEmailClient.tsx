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
    <div className="min-h-screen w-full bg-[var(--color-navy-950)] flex items-center justify-center p-4 relative">
      
      {/* Background Decor */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--color-navy-800)_0%,_transparent_50%)] opacity-40" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md bg-[var(--color-navy-900)]/90 backdrop-blur-md rounded-2xl overflow-hidden shadow-2xl border border-[var(--color-border)] relative z-10 p-8 sm:p-12 text-center"
      >
        
        {!verified ? (
          <>
            <div className="w-20 h-20 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full flex items-center justify-center mx-auto mb-8">
              <Mail className="w-10 h-10 text-[var(--color-ocean-400)]" />
            </div>

            <h1 className="text-2xl font-bold text-white mb-3 font-heading">Verify Your Email</h1>
            <p className="text-[var(--color-text-secondary)] mb-8 leading-relaxed">
              We've sent a verification link to your email address.
              <br />
              <strong className="text-white font-medium mt-2 block">j••••••@gmail.com</strong>
            </p>

            <div className="space-y-4">
              <Button 
                onClick={handleSimulateVerify}
                className="w-full h-12"
                isLoading={verifying}
              >
                {verifying ? "Verifying..." : "Open Email App"}
              </Button>
              
              <Button 
                variant="secondary"
                onClick={handleResend}
                disabled={cooldown > 0}
                className="w-full h-12"
              >
                {cooldown > 0 ? `Resend available in 00:${cooldown.toString().padStart(2, '0')}` : "Resend Verification Email"}
              </Button>
            </div>

            <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
              <Link href="/login" className="text-sm text-[var(--color-text-secondary)] hover:text-white transition-colors">
                Change Email Address
              </Link>
            </div>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="w-24 h-24 bg-[var(--color-ocean-500)]/20 border border-[var(--color-ocean-500)]/30 rounded-full flex items-center justify-center mx-auto mb-8">
              <ShieldCheck className="w-12 h-12 text-[var(--color-ocean-500)]" />
            </div>

            <h1 className="text-2xl font-bold text-white mb-3 font-heading">Email Verified</h1>
            <p className="text-[var(--color-text-secondary)] mb-10 leading-relaxed">
              Your NEWSIM instructor account is ready.
            </p>

            <Button 
              onClick={handleContinue}
              className="w-full h-12 flex items-center justify-center gap-2"
            >
              Continue to Instructor Portal
              <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

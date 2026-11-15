"use client";

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';

export interface PasswordStrengthProps {
  password?: string;
  minLength?: number;
  className?: string;
  showAlways?: boolean;
}

export type StrengthLevel = "Weak" | "Fair" | "Good" | "Strong";

function Requirement({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {met ? (
        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
      ) : (
        <X className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
      )}
      <span
        className={`text-[11px] transition-colors ${
          met
            ? 'text-slate-800 dark:text-slate-200 font-semibold'
            : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {text}
      </span>
    </div>
  );
}

export function PasswordStrength({
  password = "",
  minLength = 12,
  className = "",
  showAlways = false,
}: PasswordStrengthProps) {
  // Evaluation logic
  const lengthCheck = password.length >= minLength;
  const upperCheck = /[A-Z]/.test(password);
  const lowerCheck = /[a-z]/.test(password);
  const numberCheck = /[0-9]/.test(password);
  const specialCheck = /[^A-Za-z0-9]/.test(password);

  const criteriaMet = [lengthCheck, upperCheck, lowerCheck, numberCheck, specialCheck].filter(Boolean).length;

  const strength: StrengthLevel = useMemo(() => {
    if (password.length === 0) return "Weak";
    if (criteriaMet <= 2) return "Weak";
    if (criteriaMet === 3) return "Fair";
    if (criteriaMet === 4) return "Good";
    return "Strong";
  }, [password, criteriaMet]);

  const getStrengthColor = () => {
    if (password.length === 0) return "bg-slate-300 dark:bg-slate-700";
    switch (strength) {
      case "Weak": return "bg-rose-500";
      case "Fair": return "bg-amber-500";
      case "Good": return "bg-sky-500";
      case "Strong": return "bg-emerald-500";
      default: return "bg-slate-300 dark:bg-slate-700";
    }
  };

  const getStrengthWidth = () => {
    if (password.length === 0) return "0%";
    switch (strength) {
      case "Weak": return "25%";
      case "Fair": return "50%";
      case "Good": return "75%";
      case "Strong": return "100%";
      default: return "0%";
    }
  };

  return (
    <div className={`mt-2 space-y-2 select-none ${className}`}>
      {/* Visual Bar & Strength Label */}
      <div className="flex items-center gap-2.5">
        <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700/80 rounded-full overflow-hidden flex">
          <motion.div
            className={`h-full transition-colors duration-300 ${getStrengthColor()}`}
            initial={{ width: "0%" }}
            animate={{ width: getStrengthWidth() }}
          />
        </div>
        <span className={`text-xs font-bold uppercase tracking-wider shrink-0 w-16 text-right ${
          password.length === 0 ? 'text-slate-400 dark:text-slate-500' : 
          strength === "Weak" ? 'text-rose-500 dark:text-rose-400' :
          strength === "Fair" ? 'text-amber-500 dark:text-amber-400' :
          strength === "Good" ? 'text-sky-500 dark:text-sky-400' :
          'text-emerald-600 dark:text-emerald-400'
        }`}>
          {password.length === 0 ? "Strength" : strength}
        </span>
      </div>

      {/* Criteria Checklist (Hides automatically when password is Strong) */}
      <AnimatePresence>
        {(showAlways || strength !== "Strong") && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-0.5">
              <Requirement met={lengthCheck} text={`${minLength}+ Characters`} />
              <Requirement met={upperCheck} text="Uppercase Letter" />
              <Requirement met={lowerCheck} text="Lowercase Letter" />
              <Requirement met={numberCheck} text="Number (0-9)" />
              <Requirement met={specialCheck} text="Special Character" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

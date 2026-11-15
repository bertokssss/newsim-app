'use client';
import * as React from 'react';
import { useState } from 'react';
import { cn } from "@newsim/utils";

export interface NeuralInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  rightAction?: React.ReactNode;
  variant?: "black" | "blue" | "default";
}

const NeuralInput = React.forwardRef<HTMLInputElement, NeuralInputProps>(
  ({ className, type, label, error, rightAction, onFocus, onBlur, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
      <div
        className={cn(
          "neural-form-group relative w-full transition-transform duration-[400ms] ease-[cubic-bezier(0.2,1,0.3,1)] focus-within:translate-x-1",
          className
        )}
      >
        {label && (
          <label className="block font-mono text-[13px] tracking-[1.5px] uppercase font-bold mb-3 select-none text-slate-800 dark:text-slate-200 [.mercury-wrapper_&]:text-[#0B3D91]">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            type={type || "text"}
            ref={ref}
            className={cn(
              "w-full bg-transparent text-slate-900 dark:text-white [.mercury-wrapper_&]:text-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-500 [.mercury-wrapper_&]:placeholder:text-slate-500 text-base py-3 pr-10 pl-0 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium tracking-wide outline-none shadow-none appearance-none border-b-2 border-slate-300 dark:border-slate-700 [.mercury-wrapper_&]:border-[#0B3D91]/25 focus:border-sky-500 dark:focus:border-sky-400 [.mercury-wrapper_&]:focus:border-[#0B3D91]",
              error && "border-red-500/50 dark:border-red-500/50"
            )}
            style={{
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
            }}
            onFocus={(e) => {
              setIsFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              onBlur?.(e);
            }}
            {...props}
          />
          {/* Active bottom underline effect - Blue running line */}
          <div
            className={cn(
              "absolute bottom-0 left-0 h-[2px] transition-all duration-[600ms] rounded-r-full bg-sky-500 dark:bg-sky-400 [.mercury-wrapper_&]:bg-[#0B3D91]",
              isFocused 
                ? "w-full shadow-[0_0_15px_rgba(14,165,233,0.5)] ease-[cubic-bezier(0.2,1,0.3,1)]" 
                : "w-0 shadow-none ease-in-out"
            )}
          />
          {rightAction && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10">
              {rightAction}
            </div>
          )}
        </div>
        {error && (
          <p className="text-xs text-red-400 mt-2 font-mono tracking-wide">{error}</p>
        )}
      </div>
    );
  }
);
NeuralInput.displayName = "NeuralInput";

export { NeuralInput };
export default NeuralInput;

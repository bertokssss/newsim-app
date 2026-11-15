'use client';
import * as React from "react"
import { cn } from "@newsim/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  icon?: React.ReactNode
  error?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, icon, error, ...props }, ref) => {
    return (
      <div className="w-full relative space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            type={type}
            className={cn(
              "flex h-12 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm text-[var(--color-text-primary)] transition-colors placeholder:text-[var(--color-text-secondary)]/50 focus:outline-none focus:border-[var(--color-ocean-500)] focus:ring-1 focus:ring-[var(--color-ocean-500)] disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-red-500/50 focus:border-red-500 focus:ring-red-500",
              className
            )}
            ref={ref}
            {...props}
          />
          {icon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
              {icon}
            </div>
          )}
        </div>
        {error && (
          <p className="text-xs text-red-400 mt-1.5">{error}</p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }

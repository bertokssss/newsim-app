"use client";

import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@newsim/utils"

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <div className="relative flex items-center">
        <input
          type="checkbox"
          className={cn(
            "peer h-4 w-4 shrink-0 appearance-none rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] ring-offset-[var(--color-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 checked:bg-[var(--color-ocean-500)] checked:border-[var(--color-ocean-500)] transition-all cursor-pointer",
            className
          )}
          ref={ref}
          {...props}
        />
        <Check className="pointer-events-none absolute left-[1px] top-[1px] hidden h-3.5 w-3.5 text-white peer-checked:block" />
      </div>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }

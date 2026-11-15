'use client';
import * as React from "react"
import { motion, HTMLMotionProps } from "framer-motion"
import { Loader2 } from "lucide-react"
import { cn } from "@newsim/utils"

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: "primary" | "secondary" | "ghost" | "danger"
  size?: "default" | "sm" | "lg"
  isLoading?: boolean
  children?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", isLoading, children, disabled, ...props }, ref) => {
    
    const baseStyles = "relative inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none overflow-hidden cursor-pointer"
    
    const variants = {
      primary: "bg-sky-600 text-white hover:bg-sky-700 border border-sky-500/40 shadow-xs",
      secondary: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-2xs",
      ghost: "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white",
      danger: "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/60 border border-rose-200 dark:border-rose-900/80"
    }

    const sizes = {
      default: "h-10 px-4 py-2",
      sm: "h-8 px-3 text-xs",
      lg: "h-11 px-6 text-sm"
    }

    return (
      <motion.button
        ref={ref}
        whileHover={!disabled && !isLoading ? { scale: 1.01 } : {}}
        whileTap={!disabled && !isLoading ? { scale: 0.98 } : {}}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        <span className={cn("relative z-10 flex items-center justify-center gap-1.5", isLoading && "opacity-80")}>
          {children}
        </span>
      </motion.button>
    )
  }
)
Button.displayName = "Button"

export { Button }

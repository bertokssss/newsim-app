'use client';
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@newsim/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 font-mono",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-sky-600 text-white hover:bg-sky-700 shadow-xs",
        secondary:
          "border-transparent bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700",
        destructive:
          "border-transparent bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/25",
        outline: "text-slate-900 dark:text-[#F8FAFC] border-slate-200 dark:border-slate-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

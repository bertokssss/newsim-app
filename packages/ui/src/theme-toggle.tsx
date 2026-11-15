"use client"

import { Moon, Sun } from "lucide-react"
import { cn } from "@newsim/utils"
import { useTheme } from "./theme-provider"
import { useState, useEffect } from "react"

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Wait until mounted to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="w-16 h-8 opacity-0"></div>
  }

  const isDark = resolvedTheme === "dark"

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3BA7F2] focus-visible:ring-offset-2",
        isDark 
          ? "bg-[#0A1424] border border-[#1E385B] hover:border-[#3BA7F2]/50 shadow-inner" 
          : "bg-[#E8F6FF] border border-[#B2DFFC] hover:border-[#3BA7F2]/60 shadow-sm",
        className
      )}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {/* Sliding Knob */}
      <span
        className={cn(
          "pointer-events-none flex h-6 w-6 items-center justify-center rounded-full shadow-md transition-transform duration-300 ease-out",
          isDark
            ? "translate-x-7 bg-[#13243C] text-[#3BA7F2]"
            : "translate-x-0 bg-white text-amber-500"
        )}
      >
        {isDark ? (
          <Moon className="h-3.5 w-3.5 transition-transform duration-300" strokeWidth={2} />
        ) : (
          <Sun className="h-3.5 w-3.5 transition-transform duration-300" strokeWidth={2} />
        )}
      </span>

      {/* Background Icon Preview */}
      <span className="absolute inset-0 flex items-center justify-between px-1.5 pointer-events-none select-none">
        <Sun
          className={cn(
            "h-3 w-3 transition-opacity duration-200",
            isDark ? "opacity-30 text-slate-500" : "opacity-0"
          )}
        />
        <Moon
          className={cn(
            "h-3 w-3 transition-opacity duration-200",
            isDark ? "opacity-0" : "opacity-35 text-[#0B3D91]"
          )}
        />
      </span>
    </button>
  );
}

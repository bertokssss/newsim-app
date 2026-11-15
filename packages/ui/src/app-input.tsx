'use client';
import * as React from 'react'
import { useState } from 'react'
import { cn } from "@newsim/utils"

export interface AppInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  hideRightIconWhenEmptyAndBlurred?: boolean;
  error?: string;
}

const AppInput = React.forwardRef<HTMLInputElement, AppInputProps>(
  ({ 
    className, 
    type, 
    label, 
    icon, 
    iconLeft, 
    iconRight, 
    iconPosition = 'right', 
    hideRightIconWhenEmptyAndBlurred = true, 
    error, 
    onFocus, 
    onBlur, 
    style,
    ...props 
  }, ref) => {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [isHovering, setIsHovering] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const handleMouseMove = (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setMousePosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    };

    const hasLeftIcon = Boolean(iconLeft || (icon && iconPosition === 'left'));
    const hasRightIcon = Boolean(iconRight || (icon && iconPosition === 'right') || type === 'password');
    const leftIconElement = iconLeft || (iconPosition === 'left' ? icon : null);
    const rightIconElement = iconRight || (iconPosition === 'right' ? icon : null);

    const hasValue = props.value !== undefined && props.value !== null && String(props.value).length > 0;
    const shouldShowRightIcon = hideRightIconWhenEmptyAndBlurred ? (isFocused || hasValue) : true;

    return (
      <div className="w-full relative space-y-1.5 text-left">
        {label && (
          <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider pl-1">
            {label}
          </label>
        )}
        <div className="relative w-full flex items-center">
          {hasLeftIcon && (
            <div 
              className="absolute top-1/2 -translate-y-1/2 z-30 w-5 h-5 flex items-center justify-center text-slate-400 pointer-events-none transition-colors peer-focus:text-[var(--color-ocean-400)]"
              style={{ left: '24px' }}
            >
              {leftIconElement}
            </div>
          )}

          <input
            type={type}
            className={cn(
              "peer relative z-10 h-12 w-full rounded-xl border border-slate-200 dark:border-[#294052] bg-[var(--color-surface)]/80 backdrop-blur-md text-sm text-[var(--color-text-primary)] transition-all duration-200 ease-in-out placeholder:text-[var(--color-text-muted)] focus:outline-none focus:bg-[var(--color-bg)]/95 focus:border-[var(--color-ocean-400)]/80 focus:ring-2 focus:ring-[var(--color-ocean-400)]/20 disabled:cursor-not-allowed disabled:opacity-50 shadow-inner leading-normal",
              error && "border-red-500/50 focus:border-red-500 focus:ring-red-500/20",
              className
            )}
            style={{
              paddingLeft: hasLeftIcon ? '60px' : '20px',
              paddingRight: hasRightIcon ? '60px' : '20px',
              ...style,
            }}
            ref={ref}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
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

          {hasRightIcon && rightIconElement && (
            <div 
              className={cn(
                "absolute top-1/2 -translate-y-1/2 z-30 flex items-center justify-center transition-all duration-200",
                !shouldShowRightIcon && "opacity-0 pointer-events-none scale-90"
              )}
              style={{ right: '18px' }}
            >
              {rightIconElement}
            </div>
          )}

          {isHovering && !props.disabled && (
            <>
              <div
                className="absolute pointer-events-none top-0 left-0 right-0 h-[2px] z-20 rounded-t-xl overflow-hidden"
                style={{
                  background: `radial-gradient(50px circle at ${mousePosition.x}px 0px, var(--color-ocean-400) 0%, transparent 70%)`,
                }}
              />
              <div
                className="absolute pointer-events-none bottom-0 left-0 right-0 h-[2px] z-20 rounded-b-xl overflow-hidden"
                style={{
                  background: `radial-gradient(50px circle at ${mousePosition.x}px 2px, var(--color-ocean-400) 0%, transparent 70%)`,
                }}
              />
            </>
          )}
        </div>
        {error && (
          <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1 font-medium pl-1">{error}</p>
        )}
      </div>
    )
  }
)
AppInput.displayName = "AppInput"

export { AppInput }

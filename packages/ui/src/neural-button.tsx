'use client';
import React from 'react';
import { cn } from '@newsim/utils';

export interface NeuralButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
}

export const NeuralButton = React.forwardRef<HTMLButtonElement, NeuralButtonProps>(
  ({ className, children, isLoading, disabled, ...props }, ref) => {
    return (
      <div className="relative mt-8 w-full group">
        <button
          ref={ref}
          className={cn(
            "relative z-10 w-full bg-[#0B3D91] hover:bg-white text-white hover:text-[#0B3D91] rounded-lg border border-transparent hover:border-[#0B3D91]/20 py-4 px-10 text-[14px] font-[800] uppercase tracking-[2px] cursor-pointer transition-all duration-300 hover:tracking-[4px] hover:shadow-[0_8px_25px_rgba(11,61,145,0.2)] flex justify-center items-center",
            (disabled || isLoading) && "opacity-80 cursor-not-allowed hover:shadow-none hover:tracking-[2px]",
            className
          )}
          disabled={disabled || isLoading}
          {...props}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
              <span>PROCESSING...</span>
            </div>
          ) : (
            children
          )}
        </button>
      </div>
    );
  }
);
NeuralButton.displayName = 'NeuralButton';

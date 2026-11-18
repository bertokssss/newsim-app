'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, X } from 'lucide-react';
import { Button } from '../button';
import { acquireViewportScrollLock } from '../modal-shell';

export interface LogoutConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
  title?: string;
  message?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  portalName?: string;
  userName?: string;
}

export function LogoutConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  title = 'Confirm Sign Out',
  message,
  description,
  confirmText = 'Sign Out',
  cancelText = 'Cancel',
  portalName,
  userName,
}: LogoutConfirmationModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const contentMessage =
    message ||
    description ||
    'Are you sure you want to end your active session? You will need to log in again with your credentials to access this portal.';

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    },
    [isLoading, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      const releaseLock = acquireViewportScrollLock();
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        releaseLock();
      };
    }
  }, [isOpen, handleKeyDown]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => {
              if (!isLoading) onClose();
            }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm touch-none overscroll-none"
            aria-hidden="true"
          />

          {/* Modal Container */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-dialog-title"
            aria-describedby="logout-dialog-description"
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-md max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] overflow-y-auto overscroll-contain rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 p-5 sm:p-7 shadow-2xl z-10 text-slate-900 dark:text-slate-100 text-center"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              aria-label="Close dialog"
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer disabled:opacity-40"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Centered Icon Badge */}
            <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4 shadow-xs">
              <LogOut className="w-6 h-6" />
            </div>

            {/* Centered Title */}
            <h3
              id="logout-dialog-title"
              className="text-lg font-bold text-slate-900 dark:text-white tracking-tight"
            >
              {title}
            </h3>

            {/* Centered Subtitle / Context */}
            {(portalName || userName) && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                {portalName && <span>{portalName}</span>}
                {portalName && userName && <span className="opacity-60">•</span>}
                {userName && (
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {userName}
                  </span>
                )}
              </div>
            )}

            {/* Centered Message Box */}
            <div
              id="logout-dialog-description"
              className="text-sm font-normal text-slate-600 dark:text-slate-300 mt-4 mb-6 leading-relaxed bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 text-center"
            >
              {contentMessage}
            </div>

            {/* Centered Action Buttons (Grid / 2 Columns) */}
            <div className="grid grid-cols-2 gap-3 w-full">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={isLoading}
                className="w-full justify-center"
              >
                {cancelText}
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={onConfirm}
                isLoading={isLoading}
                className="w-full justify-center"
              >
                <LogOut className="w-4 h-4 mr-1.5" />
                <span>{confirmText}</span>
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

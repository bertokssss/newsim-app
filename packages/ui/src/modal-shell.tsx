'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@newsim/utils';

const MODAL_OVERLAY_SELECTOR = [
  '[role="dialog"][aria-modal="true"]',
  '.fixed.inset-0:not([data-ambient-bg="true"]):not(.pointer-events-none)',
].join(', ');

interface SavedScrollStyles {
  htmlOverflow: string;
  htmlOverscrollBehavior: string;
  bodyOverflow: string;
  bodyOverscrollBehavior: string;
  bodyPaddingRight: string;
}

let activeScrollLocks = 0;
let savedScrollStyles: SavedScrollStyles | null = null;

/**
 * Refcounted viewport scroll lock that freezes both `<html>` and `<body>`
 * while compensating for scrollbar width so centered layouts do not shift.
 */
export function acquireViewportScrollLock(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  const html = document.documentElement;
  const body = document.body;

  if (activeScrollLocks === 0) {
    savedScrollStyles = {
      htmlOverflow: html.style.overflow,
      htmlOverscrollBehavior: html.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyOverscrollBehavior: body.style.overscrollBehavior,
      bodyPaddingRight: body.style.paddingRight,
    };

    const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);
    const computedBodyPadRight = parseFloat(window.getComputedStyle(body).paddingRight) || 0;

    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${computedBodyPadRight + scrollbarWidth}px`;
    }
  }

  activeScrollLocks += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    activeScrollLocks = Math.max(0, activeScrollLocks - 1);

    if (activeScrollLocks === 0 && savedScrollStyles) {
      html.style.overflow = savedScrollStyles.htmlOverflow;
      html.style.overscrollBehavior = savedScrollStyles.htmlOverscrollBehavior;
      body.style.overflow = savedScrollStyles.bodyOverflow;
      body.style.overscrollBehavior = savedScrollStyles.bodyOverscrollBehavior;
      body.style.paddingRight = savedScrollStyles.bodyPaddingRight;
      savedScrollStyles = null;
    }
  };
}

function isVisibleOverlayElement(el: Element): boolean {
  if (
    el.hasAttribute('data-ambient-bg') ||
    el.getAttribute('aria-hidden') === 'true'
  ) {
    return false;
  }

  const style = window.getComputedStyle(el);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.pointerEvents !== 'none'
  );
}

/**
 * Tracks active modal dialogs and mobile sidebar drawers across portal layouts,
 * locking background scroll whenever any overlay is open and reporting whether
 * a non-sidebar modal should deactivate the desktop sidebar.
 */
export function useGlobalModalState(): boolean {
  const [overlayState, setOverlayState] = useState({
    hasActiveModal: false,
    hasMobileDrawer: false,
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const inspectOverlays = () => {
      const drawerNodes = Array.from(document.querySelectorAll('[data-sidebar-drawer="true"]'));
      const hasMobileDrawer = drawerNodes.some((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });

      const candidateNodes = Array.from(document.querySelectorAll(MODAL_OVERLAY_SELECTOR));
      const hasActiveModal = candidateNodes.some((el) => {
        if (el.hasAttribute('data-sidebar-drawer') || el.closest('[data-sidebar-drawer="true"]')) {
          return false;
        }
        return isVisibleOverlayElement(el);
      });

      setOverlayState((prev) =>
        prev.hasActiveModal === hasActiveModal && prev.hasMobileDrawer === hasMobileDrawer
          ? prev
          : { hasActiveModal, hasMobileDrawer }
      );
    };

    inspectOverlays();

    const observer = new MutationObserver(() => {
      inspectOverlays();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'role', 'aria-modal', 'aria-hidden', 'style', 'data-sidebar-drawer', 'hidden'],
    });

    window.addEventListener('resize', inspectOverlays);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', inspectOverlays);
    };
  }, []);

  const shouldLockScroll = overlayState.hasActiveModal || overlayState.hasMobileDrawer;

  useEffect(() => {
    if (!shouldLockScroll) return;
    return acquireViewportScrollLock();
  }, [shouldLockScroll]);

  return overlayState.hasActiveModal;
}

export interface ResponsiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  disableClose?: boolean;
  maxWidthClassName?: string;
  panelClassName?: string;
  backdropClassName?: string;
  containerClassName?: string;
  topAccentClassName?: string;
  ariaLabelledBy?: string;
  zIndexClassName?: string;
  children: React.ReactNode;
}

/**
 * Portal-rendered responsive modal shell that sits above portal sidebars/headers,
 * locks viewport scrolling, and constrains content height so long bodies scroll internally.
 */
export function ResponsiveModal({
  isOpen,
  onClose,
  disableClose = false,
  maxWidthClassName = 'max-w-lg',
  panelClassName,
  backdropClassName = 'bg-black/60 backdrop-blur-sm',
  containerClassName,
  topAccentClassName,
  ariaLabelledBy,
  zIndexClassName = 'z-[100]',
  children,
}: ResponsiveModalProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disableClose) {
        onClose();
      }
    },
    [disableClose, onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKeyDown);
    const releaseLock = acquireViewportScrollLock();
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      releaseLock();
    };
  }, [isOpen, handleKeyDown]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={ariaLabelledBy}
          className={cn(
            'fixed inset-0 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden',
            zIndexClassName,
            containerClassName
          )}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => {
              if (!disableClose) onClose();
            }}
            className={cn('fixed inset-0 touch-none overscroll-none', backdropClassName)}
            aria-hidden="true"
          />

          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.18 }}
            className={cn(
              'relative z-10 w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden',
              maxWidthClassName,
              panelClassName
            )}
          >
            {topAccentClassName && <div className={cn('w-full shrink-0', topAccentClassName)} />}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

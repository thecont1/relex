import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface MobileSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Max height of the sheet content area. Default: 85vh */
  maxHeight?: string;
}

/**
 * Generic bottom-sheet primitive used by the Filter, View, More, and Detail
 * sheets. CSS + React hooks only — no animation library.
 *
 * Features:
 * - Portaled to document.body so it overlays everything.
 * - Backdrop tap closes; Escape closes; swipe-down dismisses.
 * - max-height: 85vh; body scrolls internally.
 * - Sticky header with title + Close text button.
 * - Focus trap with restoration to previously-focused element.
 * - Body scroll lock while open.
 * - Exit animation: sheet stays mounted briefly after `open` goes false
 *   so the slide-down transform can animate.
 * - prefers-reduced-motion: transitions are instant (handled in mobile.css).
 */
export function MobileSheet({ open, onClose, title, children, footer, maxHeight = '85vh' }: MobileSheetProps) {
  const reducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(open);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Mount/unmount with exit animation delay
  useEffect(() => {
    if (open) {
      setVisible(true);
    } else {
      const timer = setTimeout(() => setVisible(false), reducedMotion ? 0 : 300);
      return () => clearTimeout(timer);
    }
  }, [open, reducedMotion]);

  // Escape to close (capture phase so it fires before any inner handlers)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  // Focus trap + restoration
  useEffect(() => {
    if (!open || !sheetRef.current) return;

    previouslyFocused.current = document.activeElement as HTMLElement;
    // Focus the close button after the sheet mounts
    requestAnimationFrame(() => closeBtnRef.current?.focus());

    const sheet = sheetRef.current;
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = sheet.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    sheet.addEventListener('keydown', handleTab);
    return () => {
      sheet.removeEventListener('keydown', handleTab);
      previouslyFocused.current?.focus();
    };
  }, [open]);

  // Swipe-down to dismiss
  const touchStartY = useRef(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const isSwiping = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = true;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping.current) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) {
      setSwipeOffset(delta);
    }
  };

  const onTouchEnd = () => {
    isSwiping.current = false;
    if (swipeOffset > 80) {
      onClose();
    }
    setSwipeOffset(0);
  };

  // Body scroll lock
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [visible]);

  if (!visible) return null;

  return createPortal(
    <>
      <div
        className={'mobile-sheet-backdrop' + (open ? ' open' : '')}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        className={'mobile-sheet' + (open ? ' open' : '')}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          maxHeight,
          transform: swipeOffset > 0 ? `translateY(${swipeOffset}px)` : undefined,
          transition: swipeOffset > 0 ? 'none' : undefined,
        }}
      >
        <div
          className="mobile-sheet__handle"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <span className="mobile-sheet__handle-bar" />
        </div>
        <div className="mobile-sheet__header">
          <h2 className="mobile-sheet__title">{title}</h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="mobile-sheet__close"
            onClick={onClose}
            aria-label={`Close ${title}`}
          >
            Close
          </button>
        </div>
        <div className="mobile-sheet__body">
          {children}
        </div>
        {footer && (
          <div className="mobile-sheet__footer">
            {footer}
          </div>
        )}
      </div>
    </>,
    document.body
  );
}

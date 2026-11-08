import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Names the dialog for screen readers, e.g. "Share a prayer". */
  label: string;
  children: ReactNode;
  /** Replaces the default padding/spacing of the panel. */
  className?: string;
}

/**
 * A panel that slides up from the bottom of the screen (a "bottom sheet").
 *
 * It behaves like a real dialog, which hand-made overlays in this app did not:
 *  - screen readers announce it (role="dialog", aria-modal, a label);
 *  - keyboard focus moves into it, Tab and Shift+Tab stay inside it, and Escape closes it;
 *  - the page behind it does not scroll;
 *  - focus goes back to whatever opened it when it closes;
 *  - it is drawn on document.body, so a transformed parent (like the tilting verse card) cannot
 *    trap or clip it.
 */
export default function Sheet({ open, onClose, label, children, className = 'p-4' }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus into the dialog (the panel itself, so nothing is highlighted unexpectedly).
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (event.key !== 'Tab') return;

    const panel = panelRef.current;
    if (!panel) return;
    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = document.activeElement;

    if (event.shiftKey && (active === first || active === panel)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" onKeyDown={onKeyDown}>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in cursor-default"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`relative w-full max-w-lg md:max-w-2xl bg-surface-950 border border-white/10 border-b-0 sm:border-b rounded-t-3xl sm:rounded-3xl max-h-[85dvh] overflow-y-auto overscroll-contain animate-slide-up focus:outline-none ${className}`}
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

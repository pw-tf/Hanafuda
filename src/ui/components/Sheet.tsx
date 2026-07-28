/**
 * Bottom sheet.
 *
 * Informational sheets close the way a mobile app expects: tap the backdrop,
 * or press Escape. Sheets that ask a question do not — dismissing the
 * koi-koi prompt or the round result by tapping slightly off-target would
 * skip a decision the player has to make, so those pass `dismissible={false}`
 * and can only be answered by their own buttons.
 */

import { useEffect, useRef, type ReactNode } from 'react';

export function Sheet({
  label,
  dismissible = true,
  onDismiss,
  className,
  children,
}: {
  label: string;
  /** False for sheets that require an explicit choice. */
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!dismissible || !onDismiss) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismissible, onDismiss]);

  /**
   * Whether the gesture began on the backdrop.
   *
   * Testing the click target alone is not enough. A press inside the panel
   * that releases outside it still fires one click, and the browser dispatches
   * it on the nearest common ancestor of the two — which is the backdrop. So a
   * flick-scroll of a long score guide that drifts off the panel would close
   * the sheet. Requiring the press to have landed on the backdrop as well
   * makes the gesture unambiguous.
   */
  const fromBackdrop = useRef(false);

  return (
    <div
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onPointerDown={(e) => {
        fromBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (!dismissible || !onDismiss) return;
        if (e.target === e.currentTarget && fromBackdrop.current) onDismiss();
      }}
    >
      <div className={`sheet__inner${className ? ` ${className}` : ''}`}>{children}</div>
    </div>
  );
}

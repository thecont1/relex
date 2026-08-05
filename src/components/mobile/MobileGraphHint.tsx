import { useState } from 'react';
import type { ViewMode } from '../../lib/types';

interface Props {
  view: ViewMode;
}

/**
 * One-shot text hint shown below the trigger row when the user is in a
 * graph view on mobile. Dismissible with a tap. Suppressed entirely when
 * view === 'accessible' or after dismissal.
 */
export function MobileGraphHint({ view }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || view === 'accessible') return null;

  return (
    <div
      className="mobile-graph-hint"
      onClick={() => setDismissed(true)}
      role="button"
      tabIndex={0}
      aria-label="Dismiss hint"
    >
      Tap a node for details · Pinch to zoom · Graph renders best on larger screens
    </div>
  );
}

interface Props {
  active: boolean;
  onToggle: () => void;
}

/**
 * Floating icon button that toggles "Focus Mode" — hides chrome and expands
 * the canvas. Persists at reduced opacity in the bottom-right corner so the
 * user can always escape focus mode.
 */
export function FocusModeToggle({ active, onToggle }: Props) {
  return (
    <button
      type="button"
      className="focus-mode-toggle"
      onClick={onToggle}
      aria-label={active ? 'Show controls' : 'Hide controls'}
      aria-pressed={active}
      title={active ? 'Show controls' : 'Hide controls'}
    >
      {active ? <ExpandIcon /> : <CollapseIcon />}
    </button>
  );
}

function CollapseIcon() {
  // Two arrows pointing inward — visually "minimize" the chrome.
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="14" y1="10" x2="21" y2="3" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

function ExpandIcon() {
  // Two arrows pointing outward — "expand the canvas / bring chrome back".
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="4 14 10 14 10 8" />
      <polyline points="20 10 14 10 14 16" />
      <line x1="14" y1="10" x2="21" y2="17" />
      <line x1="3" y1="7" x2="10" y2="14" />
    </svg>
  );
}
// Compact inline icon set used by the control panel and toolbar.
// All icons are SVG so they remain crisp and inherit currentColor.

import type { JSX } from 'react';

const baseProps = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const };

export function IconSearch(): JSX.Element {
  return (
    <svg {...baseProps}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function IconRefresh(): JSX.Element {
  return (
    <svg {...baseProps}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

export function IconDownload(): JSX.Element {
  return (
    <svg {...baseProps}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function IconReset(): JSX.Element {
  return (
    <svg {...baseProps}>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

export function IconClose(): JSX.Element {
  return (
    <svg {...baseProps}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function IconCircle(): JSX.Element {
  return (<svg {...baseProps}><circle cx="12" cy="12" r="9" /></svg>);
}
export function IconSquare(): JSX.Element {
  return (<svg {...baseProps}><rect x="3" y="3" width="18" height="18" rx="3" /></svg>);
}
export function IconHex(): JSX.Element {
  return (
    <svg {...baseProps}>
      <polygon points="12 2 21 7 21 17 12 22 3 17 3 7" />
    </svg>
  );
}
export function IconLink(): JSX.Element {
  return (<svg {...baseProps}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>);
}
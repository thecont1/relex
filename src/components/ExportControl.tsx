/**
 * ExportControl — a compact, accessible split-button for PNG/SVG export.
 *
 * Interaction pattern:
 *   - Primary button "Export" triggers the last-used format (default PNG),
 *     persisted to localStorage so the default sticks across sessions.
 *   - An attached chevron button opens a small menu listing the two explicit
 *     actions: "Export as PNG" and "Export as SVG". Selecting an item both
 *     runs that export and records it as the new default.
 *
 * The control is intentionally text-led (no icons) to match the rest of the
 * header action language (Reset / Refresh). A CSS caret stands in for the
 * disclosure affordance so it reads as typography, not a separate icon system.
 *
 * Accessibility:
 *   - Real <button> elements throughout.
 *   - Chevron uses aria-haspopup="menu" / aria-expanded / aria-controls.
 *   - Menu uses role="menu" with role="menuitem" entries; the active default
 *     is exposed via aria-checked plus a visible "current" text tag.
 *   - Full keyboard support: Enter/Space/ArrowDown open; ArrowUp/Down move;
 *     Escape closes and returns focus to the trigger; Tab closes on leave.
 *   - Visible focus ring via the global :focus-visible rule.
 *   - Outside-click closes the menu.
 *   - The menu is right-aligned to the control so it stays in-viewport given
 *     the actions cluster is right-aligned in the header.
 */
import { useEffect, useId, useRef, useState } from 'react';

export type ExportFormat = 'png' | 'svg';

interface ExportControlProps {
  onExportPng: () => void;
  onExportSvg: () => void;
}

const STORAGE_KEY = 'relexplorer.exportFormat';

function readStoredFormat(): ExportFormat {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'svg' ? 'svg' : 'png';
  } catch {
    return 'png';
  }
}

const ITEMS: ExportFormat[] = ['png', 'svg'];

export function ExportControl({ onExportPng, onExportSvg }: ExportControlProps) {
  const [format, setFormat] = useState<ExportFormat>(readStoredFormat);
  const [open, setOpen] = useState(false);

  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Persist the chosen default format across sessions.
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, format); } catch { /* ignore */ }
  }, [format]);

  // Close on outside pointer down.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Close on Escape anywhere while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const runExport = (f: ExportFormat) => {
    if (f === 'png') onExportPng(); else onExportSvg();
  };

  const selectFormat = (f: ExportFormat) => {
    setFormat(f);
    setOpen(false);
  };

  const focusItem = (i: number) => {
    const idx = (i + ITEMS.length) % ITEMS.length;
    itemRefs.current[idx]?.focus();
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      // Focus the first item after the menu mounts.
      requestAnimationFrame(() => focusItem(0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => focusItem(ITEMS.length - 1));
    }
  };

  const onItemKeyDown = (e: React.KeyboardEvent, i: number) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(i + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusItem(i - 1); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); triggerRef.current?.focus(); }
    else if (e.key === 'Tab') { setOpen(false); }
    else if (e.key === 'Home') { e.preventDefault(); focusItem(0); }
    else if (e.key === 'End') { e.preventDefault(); focusItem(ITEMS.length - 1); }
  };

  return (
    <div className="export-control" ref={rootRef}>
      <button
        type="button"
        className="export-control__primary"
        onClick={() => runExport(format)}
        aria-label={`Export current view as ${format.toUpperCase()}`}
        title={`Export as ${format.toUpperCase()}`}
      >
        Export
      </button>
      <button
        type="button"
        ref={triggerRef}
        className="export-control__chevron"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Select export format"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="export-control__caret" aria-hidden="true" />
      </button>
      {open && (
        <ul
          id={menuId}
          role="menu"
          className="export-control__menu"
          aria-label="Export format"
        >
          {ITEMS.map((f, i) => (
            <li key={f} role="none">
              <button
                type="button"
                role="menuitemradio"
                ref={(el) => { itemRefs.current[i] = el; }}
                className="export-control__menuitem"
                aria-checked={format === f}
                data-current={format === f}
                onClick={() => selectFormat(f)}
                onKeyDown={(e) => onItemKeyDown(e, i)}
              >
                <span className="export-control__menuitem-label">
                  {f.toUpperCase()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

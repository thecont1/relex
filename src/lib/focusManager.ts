// Focus management utilities for accessible drawer behavior.
// When the drawer opens, focus moves to its close button (a reliable landmark
// inside the drawer). When it closes, focus is restored to whatever had focus
// before (typically the node that was clicked).

let lastFocusedBeforeDrawer: HTMLElement | null = null;

export function rememberFocusBeforeDrawer(): void {
  if (typeof document === 'undefined') return;
  lastFocusedBeforeDrawer = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
}

export function focusDrawerCloseButton(closeButtonRef: HTMLElement | null): void {
  if (!closeButtonRef) return;
  // Defer to next tick so the drawer has had a chance to render.
  requestAnimationFrame(() => {
    closeButtonRef.focus();
  });
}

export function restoreFocusAfterDrawer(): void {
  if (!lastFocusedBeforeDrawer) return;
  const target = lastFocusedBeforeDrawer;
  requestAnimationFrame(() => {
    if (target && typeof target.focus === 'function' && document.contains(target)) {
      target.focus();
    }
    lastFocusedBeforeDrawer = null;
  });
}
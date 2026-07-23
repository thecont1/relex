// HighlightController — the shared, renderer-agnostic hover / focus / pin state
// machine used by BOTH the Flat (Cytoscape) and Globe (3d-force-graph) views so
// the interaction model is identical regardless of which renderer is active.
//
// RESPONSIBILITIES
// ----------------
//  - Immediate emphasis on hover-in / focus-in (no entry delay).
//  - Dwell-then-fade decay on hover-out / focus-out: hold the highlight for a
//    short dwell period, THEN ease back to rest. Never an instant snap.
//  - Cancellation: if a new node is hovered before an in-progress fade
//    completes, the fade is cancelled and the highlight transitions directly
//    into the new node's state. Exactly one transition ever runs at a time —
//    we cancel the outstanding rAF before starting another.
//  - Pinning: a click pins the ego-network highlight persistently, independent
//    of subsequent mouse movement, until it is explicitly cleared (empty-canvas
//    click, Escape, or re-click of the same node). While pinned, hover events
//    are ignored so the pinned story is stable.
//  - prefers-reduced-motion: the eased ramps are skipped (instant state change)
//    but the DWELL timing is preserved, so hover-out still holds before
//    clearing rather than snapping the instant the cursor leaves.
//
// The controller does not know anything about nodes, materials, or the DOM. It
// emits a normalized `HighlightState` (target id + 0..1 master intensity +
// pinned flag) via the `render` callback; each renderer maps that state onto its
// own visuals (Cytoscape classes / inline styles, or Three.js material opacity
// & emissive). This keeps the timing logic in exactly one place.

export interface HighlightTimings {
  /** Ramp-in duration for emphasis (ms). Spec: ~100-150ms ease-out. */
  enterMs: number;
  /** Hold duration after hover-out before the fade begins (ms). Spec: ~300-500ms. */
  dwellMs: number;
  /** Ramp-out duration once the dwell elapses (ms). Spec: ~400-600ms. */
  fadeMs: number;
}

export const DEFAULT_TIMINGS: HighlightTimings = {
  enterMs: 130,
  dwellMs: 380,
  fadeMs: 500
};

export interface HighlightState {
  /** The primary highlighted node id, or null when fully at rest. */
  nodeId: string | null;
  /** Master intensity 0..1. 1 = full emphasis, 0 = rest. */
  intensity: number;
  /** True when the current highlight is pinned (click), false for hover/focus. */
  pinned: boolean;
}

type Phase = 'idle' | 'enter' | 'active' | 'dwell' | 'fade';

const now = (): number =>
  typeof performance !== 'undefined' && performance.now
    ? performance.now()
    : Date.now();

// ease-out cubic — matches the app's --ease-out feel closely enough for
// intensity ramps and keeps enter snappy.
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export interface HighlightControllerOptions {
  render: (state: HighlightState) => void;
  timings?: Partial<HighlightTimings>;
  reducedMotion?: boolean;
}

export class HighlightController {
  private timings: HighlightTimings;
  private reduced: boolean;
  private render: (state: HighlightState) => void;

  private phase: Phase = 'idle';
  private targetId: string | null = null;
  private intensity = 0;
  private pinned = false;

  private rafId: number | null = null;
  private dwellTimer: ReturnType<typeof setTimeout> | null = null;
  private rampFrom = 0;
  private rampTo = 0;
  private rampStart = 0;
  private rampDur = 0;
  private destroyed = false;

  constructor(opts: HighlightControllerOptions) {
    this.render = opts.render;
    this.timings = { ...DEFAULT_TIMINGS, ...(opts.timings ?? {}) };
    this.reduced = opts.reducedMotion ?? false;
  }

  setReducedMotion(reduced: boolean): void {
    this.reduced = reduced;
  }

  setTimings(t: Partial<HighlightTimings>): void {
    this.timings = { ...this.timings, ...t };
  }

  isPinned(): boolean {
    return this.pinned;
  }

  pinnedId(): string | null {
    return this.pinned ? this.targetId : null;
  }

  currentId(): string | null {
    return this.targetId;
  }

  /** Current internal phase — exposed for diagnostics/tests. */
  getPhase(): Phase {
    return this.phase;
  }

  /** Hover-in or keyboard focus-in. Identical behavior for both. */
  hoverIn(nodeId: string): void {
    if (this.destroyed) return;
    // While pinned, hover is inert — the pinned ego network owns the view.
    if (this.pinned) return;
    this.clearDwell();
    this.targetId = nodeId;
    this.phase = 'enter';
    // Ramp from wherever we currently are (could be mid-fade) directly up to
    // full emphasis — this is the fade-cancel path.
    this.startRamp(1, this.reduced ? 0 : this.timings.enterMs);
  }

  /** Hover-out or keyboard focus-out. Begins the dwell-then-fade decay. */
  hoverOut(): void {
    if (this.destroyed) return;
    if (this.pinned) return;
    if (this.targetId === null) return;
    this.clearDwell();
    this.phase = 'dwell';
    // Hold current emphasis for the dwell period, then fade. Dwell timing is
    // preserved even under reduced motion.
    this.dwellTimer = setTimeout(() => {
      this.dwellTimer = null;
      this.phase = 'fade';
      this.startRamp(0, this.reduced ? 0 : this.timings.fadeMs);
    }, this.timings.dwellMs);
  }

  /**
   * Click a node. Toggles the pin: clicking the already-pinned node clears the
   * pin; clicking a different node (or an unpinned node) pins it.
   * Returns the resulting pinned id (null if this click cleared the pin).
   */
  togglePin(nodeId: string): string | null {
    if (this.destroyed) return null;
    if (this.pinned && this.targetId === nodeId) {
      this.unpin();
      return null;
    }
    this.pin(nodeId);
    return nodeId;
  }

  /** Pin a node's ego network persistently. */
  pin(nodeId: string): void {
    if (this.destroyed) return;
    this.clearDwell();
    this.cancelRamp();
    this.pinned = true;
    this.targetId = nodeId;
    this.phase = 'active';
    // Snap to full emphasis immediately (or ramp quickly). Pins are decisive.
    this.startRamp(1, this.reduced ? 0 : this.timings.enterMs);
  }

  /** Clear any pin and decay back to rest (respects dwell-free graceful fade). */
  unpin(): void {
    if (this.destroyed) return;
    if (!this.pinned) return;
    this.pinned = false;
    this.clearDwell();
    this.phase = 'fade';
    this.startRamp(0, this.reduced ? 0 : this.timings.fadeMs);
  }

  /**
   * Force an immediate return to rest with no dwell and no fade. Used when the
   * underlying data changes (filter/layer/sector/search) so a stale highlight
   * can't linger over a node that may no longer exist.
   */
  reset(): void {
    if (this.destroyed) return;
    this.clearDwell();
    this.cancelRamp();
    this.pinned = false;
    this.targetId = null;
    this.phase = 'idle';
    this.intensity = 0;
    this.emit();
  }

  destroy(): void {
    this.destroyed = true;
    this.clearDwell();
    this.cancelRamp();
  }

  // ---------- internals ----------

  private startRamp(to: number, durMs: number): void {
    this.cancelRamp();
    this.rampFrom = this.intensity;
    this.rampTo = to;
    this.rampDur = durMs;
    this.rampStart = now();

    if (durMs <= 0 || typeof requestAnimationFrame === 'undefined') {
      this.intensity = to;
      this.finishRamp();
      return;
    }
    const step = () => {
      if (this.destroyed) return;
      const t = Math.min(1, (now() - this.rampStart) / this.rampDur);
      const eased = easeOut(t);
      this.intensity = this.rampFrom + (this.rampTo - this.rampFrom) * eased;
      this.emit();
      if (t < 1) {
        this.rafId = requestAnimationFrame(step);
      } else {
        this.rafId = null;
        this.intensity = this.rampTo;
        this.finishRamp();
      }
    };
    this.rafId = requestAnimationFrame(step);
    // Emit the first frame synchronously so callers see immediate movement.
    this.emit();
  }

  private finishRamp(): void {
    if (this.rampTo === 0 && !this.pinned) {
      // Reached rest.
      this.targetId = null;
      this.phase = 'idle';
    } else if (this.rampTo === 1) {
      this.phase = 'active';
    }
    this.emit();
  }

  private cancelRamp(): void {
    if (this.rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafId);
    }
    this.rafId = null;
  }

  private clearDwell(): void {
    if (this.dwellTimer !== null) {
      clearTimeout(this.dwellTimer);
      this.dwellTimer = null;
    }
  }

  private emit(): void {
    this.render({
      nodeId: this.targetId,
      intensity: this.intensity,
      pinned: this.pinned
    });
  }
}

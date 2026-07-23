import type { RenderMode, ViewMode } from '../lib/types';

interface Props {
  /** Canvas rendering mode — 'flat' (Cytoscape 2D) or 'globe' (3d-force-graph). */
  renderMode: RenderMode;
  onRenderModeChange: (m: RenderMode) => void;
  /** Whether to show the canvas (visual) or the semantic listing (accessible). */
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
}

/**
 * Combined view switcher. Three segments:
 *   - Flat        → Cytoscape 2D canvas
 *   - Globe       → 3d-force-graph wireframe sphere canvas
 *   - Accessible  → semantic tables/cards, no canvas
 *
 * Each segment is an independent toggle button with `aria-pressed` so screen
 * readers understand what each does. Flat and Globe drive `renderMode`;
 * Accessible drives `view`. The three buttons share width so the strip is
 * visually balanced regardless of label length.
 */
export function ViewSwitcher({ renderMode, onRenderModeChange, view, onViewChange }: Props) {
  return (
    <div className="view-switcher" role="group" aria-label="View">
      <button
        type="button"
        className="view-switcher__btn"
        aria-pressed={view === 'visual' && renderMode === 'flat'}
        aria-label="Flat 2D network view"
        onClick={() => {
          onViewChange('visual');
          onRenderModeChange('flat');
        }}
      >
        Flat
      </button>
      <button
        type="button"
        className="view-switcher__btn"
        aria-pressed={view === 'visual' && renderMode === 'globe'}
        aria-label="3D wireframe globe view"
        onClick={() => {
          onViewChange('visual');
          onRenderModeChange('globe');
        }}
      >
        Globe
      </button>
      <button
        type="button"
        className="view-switcher__btn"
        aria-pressed={view === 'accessible'}
        aria-label="Accessible view (semantic listing, no canvas)"
        onClick={() => onViewChange('accessible')}
      >
        Accessible
      </button>
    </div>
  );
}
import { sectorColor } from '../lib/colorSystem';
import type { GraphFilters } from '../lib/types';

interface Props {
  sectors: string[];
  filters: GraphFilters;
  onToggleSector: (s: string) => void;
  onClearSectors: () => void;
}

/**
 * Clickable colored chips that double as sector legend and sector filter.
 * Each chip shows the sector's color swatch + label; clicking toggles
 * whether nodes of that sector are highlighted. Active sectors render with
 * a bright outline ring so the user can see at a glance what's filtered.
 *
 * The same chip strip appears in the AccessibleView as a non-interactive
 * legend; here it's a `<button>` so keyboard and screen-reader users can
 * operate it. `aria-pressed` communicates the toggle state.
 */
export function SectorFilter({ sectors, filters, onToggleSector, onClearSectors }: Props) {
  if (sectors.length === 0) return null;
  return (
    <div className="control-section" aria-labelledby="sector-filter-heading">
      <h2 id="sector-filter-heading">Sectors</h2>
      <div className="sector-chips">
        {sectors.map(s => {
          const c = sectorColor(s, sectors);
          const active = filters.activeSectors.has(s);
          return (
            <button
              key={s}
              type="button"
              className={'sector-chip' + (active ? ' is-active' : '')}
              onClick={() => onToggleSector(s)}
              aria-pressed={active}
              aria-label={`${active ? 'Clear' : 'Filter by'} sector ${s}`}
              style={{
                // Inline color so CSS doesn't need to know sector names.
                ['--chip-fill' as any]: c.fill,
                ['--chip-border' as any]: c.border
              }}
            >
              <span className="sector-chip__swatch" aria-hidden="true" />
              <span className="sector-chip__label">{s}</span>
            </button>
          );
        })}
      </div>
      {filters.activeSectors.size > 0 && (
        <button type="button" className="btn" onClick={onClearSectors}>
          Clear sector filter
        </button>
      )}
    </div>
  );
}
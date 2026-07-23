import { SearchBox } from './SearchBox';
import { SectorFilter } from './SectorFilter';
import { Legend } from './Legend';
import { ViewSwitcher } from './ViewSwitcher';
import type { GraphFilters, GraphModel, RenderMode, ViewMode } from '../lib/types';

interface Props {
  graph: GraphModel;
  filters: GraphFilters;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onSearchFocusNode: (id: string) => void;
  onClearSearch: () => void;
  onToggleSector: (s: string) => void;
  onClearSectors: () => void;
  renderMode: RenderMode;
  onRenderModeChange: (m: RenderMode) => void;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
}

/**
 * Sidebar hosts the secondary controls. The View switcher now lives here
 * (moved from the header) so all the "what am I looking at" choices sit
 * together. Order top-to-bottom:
 *
 *   1. View     — Flat | Globe | Accessible (rendering mode)
 *   2. Search   — faculty name filter
 *   3. Sectors  — clickable colored chips, double as the sector key
 *   4. Legend   — node shapes only (sectors are above)
 */
export function ControlPanel(props: Props) {
  return (
    <aside className="controls-aside" aria-label="Network controls">
      <div className="control-section" aria-labelledby="view-switcher-heading">
        <h2 id="view-switcher-heading">View</h2>
        <ViewSwitcher
          renderMode={props.renderMode}
          onRenderModeChange={props.onRenderModeChange}
          view={props.view}
          onViewChange={props.onViewChange}
        />
      </div>

      <SearchBox
        graph={props.graph}
        query={props.searchQuery}
        onQueryChange={props.onSearchQueryChange}
        onFocusNode={props.onSearchFocusNode}
        onClearSearch={props.onClearSearch}
      />

      <SectorFilter
        sectors={props.graph.sectors}
        filters={props.filters}
        onToggleSector={props.onToggleSector}
        onClearSectors={props.onClearSectors}
      />

      <Legend />
    </aside>
  );
}
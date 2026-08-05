import { useState } from 'react';
import { MobileSheet } from './MobileSheet';
import { sectorColor } from '../../lib/colorSystem';
import { Legend } from '../Legend';
import type { GraphFilters, GraphModel, RenderMode, ViewMode } from '../../lib/types';

export type SheetType = 'none' | 'filters' | 'view' | 'more';

interface Props {
  graph: GraphModel;
  filters: GraphFilters;
  onToggleSector: (s: string) => void;
  onClearSectors: () => void;
  onTogglePlatforms: () => void;
  onToggleVerticals: () => void;
  onToggleCollaborations: () => void;
  onToggleRelationships: () => void;
  onSoftReset: () => void;
  renderMode: RenderMode;
  onRenderModeChange: (m: RenderMode) => void;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  visibleNodeIds: Set<string>;
  visibleEdgeIds: Set<string>;
  refreshedAt: string | null;
  onRefresh: () => void;
  onReset: () => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  resetting: boolean;
  /** Which sheet is open — controlled by parent so MobileTopBar can open More */
  openSheet: SheetType;
  onOpenSheet: (s: SheetType) => void;
  onCloseSheet: () => void;
}

/**
 * Mobile controls: stats chip + trigger row (Filters / View / More) + three
 * bottom sheets. All sheets use the shared MobileSheet primitive.
 */
export function MobileControls(props: Props) {
  const { graph, filters, openSheet, onOpenSheet, onCloseSheet } = props;

  // Count active non-default filters for the badge
  const activeFilterCount =
    (filters.showPlatforms ? 0 : 1) +
    (filters.showVerticals ? 0 : 1) +
    (filters.showCollaborations ? 0 : 1) +
    (filters.showRelationships ? 0 : 1) +
    filters.activeSectors.size;

  // Stats chip
  const c = graph.counts;
  const statsLine = `${c.faculty} F · ${c.verticals} V · ${c.platforms} P · ${c.edges['faculty-faculty']} C`;
  const refreshedShort = props.refreshedAt
    ? new Date(props.refreshedAt).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '';
  const [statsExpanded, setStatsExpanded] = useState(false);

  return (
    <div className="mobile-controls">
      {/* Stats chip */}
      <div
        className="mobile-stats-chip"
        onClick={() => setStatsExpanded(e => !e)}
        role="button"
        tabIndex={0}
        aria-label="Network summary"
        aria-expanded={statsExpanded}
      >
        <span className="mobile-stats-chip__line">{statsLine}</span>
        {refreshedShort && <span className="mobile-stats-chip__refreshed">· Refreshed {refreshedShort}</span>}
        {statsExpanded && (
          <span className="mobile-stats-chip__expanded">
            Showing {props.visibleNodeIds.size}/{graph.nodes.length} nodes · {props.visibleEdgeIds.size}/{graph.edges.length} relationships
          </span>
        )}
      </div>

      {/* Trigger row */}
      <div className="mobile-controls-row">
        <button
          type="button"
          className="mobile-controls-row__btn"
          onClick={() => onOpenSheet('filters')}
          aria-label="Open filters"
        >
          Filters
          {activeFilterCount > 0 && <span className="mobile-controls-row__badge">{activeFilterCount}</span>}
        </button>
        <button
          type="button"
          className="mobile-controls-row__btn"
          onClick={() => onOpenSheet('view')}
          aria-label="Open view options"
        >
          View
        </button>
        <button
          type="button"
          className="mobile-controls-row__btn"
          onClick={() => onOpenSheet('more')}
          aria-label="Open more options"
        >
          More
        </button>
      </div>

      {/* ---- Filter sheet ---- */}
      <MobileSheet
        open={openSheet === 'filters'}
        onClose={onCloseSheet}
        title="Refine results"
        footer={
          <div className="mobile-sheet-actions">
            <button type="button" className="btn btn-primary" onClick={onCloseSheet}>
              Show {props.visibleNodeIds.size} results
            </button>
            <button type="button" className="btn" onClick={props.onSoftReset}>
              Reset
            </button>
          </div>
        }
      >
        <div className="mobile-filter-content">
          {/* Sector chips */}
          {graph.sectors.length > 0 && (
            <div className="mobile-filter-group">
              <h3 className="mobile-filter-group__title">Sectors</h3>
              <div className="mobile-filter-chips">
                {graph.sectors.map(s => {
                  const col = sectorColor(s, graph.sectors);
                  const active = filters.activeSectors.has(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      className={'mobile-filter-chip' + (active ? ' is-active' : '')}
                      onClick={() => props.onToggleSector(s)}
                      aria-pressed={active}
                      style={{
                        ['--chip-fill' as any]: col.fill,
                        ['--chip-border' as any]: col.border,
                      }}
                    >
                      <span className="mobile-filter-chip__swatch" aria-hidden="true" />
                      {s}
                    </button>
                  );
                })}
              </div>
              {filters.activeSectors.size > 0 && (
                <button type="button" className="btn mobile-filter-clear" onClick={props.onClearSectors}>
                  Clear sectors
                </button>
              )}
            </div>
          )}

          {/* Entity type toggles */}
          <div className="mobile-filter-group">
            <h3 className="mobile-filter-group__title">Entity Types</h3>
            <label className="mobile-toggle-row">
              <input type="checkbox" checked={filters.showPlatforms} onChange={props.onTogglePlatforms} />
              <span>Platforms</span>
            </label>
            <label className="mobile-toggle-row">
              <input type="checkbox" checked={filters.showVerticals} onChange={props.onToggleVerticals} />
              <span>Research Verticals</span>
            </label>
            <label className="mobile-toggle-row">
              <input type="checkbox" checked={filters.showCollaborations} onChange={props.onToggleCollaborations} />
              <span>Collaborations</span>
            </label>
            <label className="mobile-toggle-row">
              <input type="checkbox" checked={filters.showRelationships} onChange={props.onToggleRelationships} />
              <span>Relationship Lines</span>
            </label>
          </div>
        </div>
      </MobileSheet>

      {/* ---- View sheet ---- */}
      <MobileSheet
        open={openSheet === 'view'}
        onClose={onCloseSheet}
        title="View"
      >
        <div className="mobile-view-options">
          <button
            type="button"
            className={'mobile-view-option' + (props.view === 'accessible' ? ' is-active' : '')}
            onClick={() => { props.onViewChange('accessible'); onCloseSheet(); }}
            aria-pressed={props.view === 'accessible'}
          >
            <span>Accessible list</span>
            {props.view === 'accessible' && <span className="mobile-view-option__check">✓</span>}
          </button>
          <button
            type="button"
            className={'mobile-view-option' + (props.view === 'visual' && props.renderMode === 'flat' ? ' is-active' : '')}
            onClick={() => { props.onViewChange('visual'); props.onRenderModeChange('flat'); onCloseSheet(); }}
            aria-pressed={props.view === 'visual' && props.renderMode === 'flat'}
          >
            <span>Flat graph</span>
            {props.view === 'visual' && props.renderMode === 'flat' && <span className="mobile-view-option__check">✓</span>}
          </button>
          <button
            type="button"
            className={'mobile-view-option' + (props.view === 'visual' && props.renderMode === 'globe' ? ' is-active' : '')}
            onClick={() => { props.onViewChange('visual'); props.onRenderModeChange('globe'); onCloseSheet(); }}
            aria-pressed={props.view === 'visual' && props.renderMode === 'globe'}
          >
            <span>Globe</span>
            {props.view === 'visual' && props.renderMode === 'globe' && <span className="mobile-view-option__check">✓</span>}
          </button>
        </div>
        <p className="mobile-view-footer">
          {props.view === 'accessible' ? 'Accessible view is selected' : 'Graph view is selected'}
        </p>
      </MobileSheet>

      {/* ---- More sheet ---- */}
      <MobileSheet
        open={openSheet === 'more'}
        onClose={onCloseSheet}
        title="Options"
      >
        <div className="mobile-more-list">
          <button
            type="button"
            className="mobile-more-item"
            onClick={() => { props.onRefresh(); onCloseSheet(); }}
          >
            Refresh data
          </button>
          <button
            type="button"
            className="mobile-more-item"
            onClick={() => { props.onExportPng(); onCloseSheet(); }}
          >
            Export PNG
          </button>
          <button
            type="button"
            className="mobile-more-item"
            onClick={() => { props.onExportSvg(); onCloseSheet(); }}
          >
            Export SVG
          </button>
          <details className="mobile-more-item mobile-more-item--expandable">
            <summary>Legend: node types</summary>
            <div className="mobile-more-legend">
              <Legend />
            </div>
          </details>
          <button
            type="button"
            className="mobile-more-item"
            onClick={() => { props.onViewChange('accessible'); onCloseSheet(); }}
          >
            About this diagram
          </button>
          <button
            type="button"
            className="mobile-more-item mobile-more-item--danger"
            onClick={() => { props.onReset(); onCloseSheet(); }}
          >
            Reset
          </button>
        </div>
      </MobileSheet>
    </div>
  );
}

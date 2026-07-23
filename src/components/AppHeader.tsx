/**
 * Generic app header for the relexplorer network visualization.
 *
 * Reads all branding (title, logo, color accent) from the tenant config
 * (injected at build time), so the same component works for every tenant
 * without any hardcoded client-specific references.
 *
 * Layout:
 *   - Title (tenant-configurable, e.g. "CENTRE FOR NANOSCIENCE AND ENGINEERING") left.
 *   - Search input centred — the official app search. Faculty matches appear
 *     in a dropdown directly under the input.
 *   - Combined logo on the far right.
 *   - Second row: dataset stats (faculty, verticals, platforms, collaborations)
 *     replacing the old nav items so the header stays compact.
 */
import { useEffect, useRef, useState } from 'react';
import { animateCounter } from '../lib/motion';
import { searchFaculty } from '../lib/buildGraph';
import { tenantConfig } from '../tenant/config';
import type { GraphModel } from '../lib/types';

interface AppHeaderProps {
  refreshedAt: string | null;
  onReset: () => void;
  resetting: boolean;
  onRefresh: () => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  /** Sets the global search query (drives the faculty dropdown below). */
  onSearch: (query: string) => void;
  /** Current search query (controlled). */
  searchQuery: string;
  /** Select a faculty node — clears the query so the dropdown closes. */
  onSearchFocusNode: (id: string) => void;
  /** Clear the search query entirely (Esc / clear button). */
  onClearSearch: () => void;
  /** Dataset for stats + faculty search. */
  graph: GraphModel;
  /** IDs currently visible after filters/search (for the "Showing N / N" line). */
  visibleNodeIds: Set<string>;
  visibleEdgeIds: Set<string>;
}

export function AppHeader({
  refreshedAt,
  onReset,
  resetting,
  onRefresh,
  onExportPng,
  onExportSvg,
  onSearch,
  searchQuery,
  onSearchFocusNode,
  onClearSearch,
  graph,
  visibleNodeIds,
  visibleEdgeIds,
}: AppHeaderProps) {
  const [localValue, setLocalValue] = useState(searchQuery);

  // Keep the local input in sync if the parent clears the query externally
  // (e.g. the focus path, or Refresh).
  useEffect(() => { setLocalValue(searchQuery); }, [searchQuery]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(localValue.trim());
  };

  const matches = searchFaculty(graph, localValue).slice(0, 8);

  const selectMatch = (id: string) => {
    onSearchFocusNode(id);
    setLocalValue('');
  };

  const branding = tenantConfig.branding;

  return (
    <header className="app-header">
      <div className="app-header__top">
        <h1 className="app-header__title">
          {branding.title}
        </h1>

        <div className="app-header__search-wrap">
          <form
            className="app-header__search"
            role="search"
            onSubmit={submit}
          >
            <label className="sr-only" htmlFor="app-header-search">
              Search
            </label>
            <input
              id="app-header-search"
              type="search"
              value={localValue}
              onChange={(e) => { setLocalValue(e.target.value); onSearch(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  onClearSearch();
                  setLocalValue('');
                }
              }}
              placeholder="S E A R C H"
              autoComplete="off"
              role="combobox"
              aria-expanded={matches.length > 0}
              aria-controls="app-header-search-listbox"
              aria-autocomplete="list"
            />
            <button
              type="submit"
              className="app-header__search-btn"
              aria-label="Submit search"
            >
              {/* Magnifying glass SVG */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          </form>
          {matches.length > 0 && (
            <ul
              id="app-header-search-listbox"
              role="listbox"
              className="app-header__search-dropdown"
            >
              {matches.map((m) => (
                <li key={m.id} role="option" aria-selected="false">
                  <button
                    type="button"
                    className="app-header__search-option"
                    onClick={() => selectMatch(m.id)}
                  >
                    {m.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <img
          className="app-header__logo"
          src={branding.logo.src}
          alt={branding.logo.alt}
          draggable={false}
        />
      </div>

      <div className="app-header__nav" aria-label="Dataset summary">
        <DatasetStats
          graph={graph}
          visibleNodeIds={visibleNodeIds}
          visibleEdgeIds={visibleEdgeIds}
        />
        <div className="app-header__actions">
          <button
            type="button"
            className="app-header__action"
            onClick={onReset}
            disabled={resetting}
            aria-label="Re-fetch the workbook from disk"
            title="Re-fetch the workbook from disk"
          >
            {resetting ? 'Resetting…' : 'Reset'}
          </button>
          <button
            type="button"
            className="app-header__action"
            onClick={onRefresh}
            aria-label="Clear filters, search, and selection"
            title="Clear filters, search, and selection"
          >
            Refresh
          </button>
          <span className="app-header__action-label" aria-hidden="true">Export</span>
          <button
            type="button"
            className="app-header__action"
            onClick={onExportPng}
            aria-label="Export current view as PNG"
          >
            PNG
          </button>
          <button
            type="button"
            className="app-header__action"
            onClick={onExportSvg}
            aria-label="Export current view as SVG"
          >
            SVG
          </button>
          {refreshedAt && (
            <span className="app-header__refreshed" title={refreshedAt}>
              · refreshed {formatTime(refreshedAt)}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * Stats row that replaces the nav items in the second-level header row.
 * Same animated counters as the previous StatsBar component, but inline
 * here to avoid an extra row of chrome above the graph canvas.
 */
function DatasetStats({
  graph,
  visibleNodeIds,
  visibleEdgeIds,
}: {
  graph: GraphModel;
  visibleNodeIds: Set<string>;
  visibleEdgeIds: Set<string>;
}) {
  const faculty = useRef<HTMLSpanElement | null>(null);
  const verticals = useRef<HTMLSpanElement | null>(null);
  const platforms = useRef<HTMLSpanElement | null>(null);
  const collabs = useRef<HTMLSpanElement | null>(null);
  const visibleNodes = useRef<HTMLSpanElement | null>(null);
  const visibleEdges = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    animateCounter(faculty, graph.counts.faculty, false);
    animateCounter(platforms, graph.counts.platforms, false);
    animateCounter(verticals, graph.counts.verticals, false);
    animateCounter(collabs, graph.counts.edges['faculty-faculty'], false);
  }, [graph]);

  useEffect(() => {
    if (visibleNodes.current) visibleNodes.current.textContent = String(visibleNodeIds.size);
    if (visibleEdges.current) visibleEdges.current.textContent = String(visibleEdgeIds.size);
  }, [visibleNodeIds, visibleEdgeIds]);

  return (
    <div className="app-header__stats" aria-label="Network summary">
      <span className="app-header__stat"><strong ref={faculty}>0</strong> faculty</span>
      <span className="app-header__stat"><strong ref={verticals}>0</strong> verticals</span>
      <span className="app-header__stat"><strong ref={platforms}>0</strong> platforms</span>
      <span className="app-header__stat"><strong ref={collabs}>0</strong> collaborations</span>
      <span className="app-header__stat app-header__stat--muted">
        Showing <strong ref={visibleNodes}>0</strong> / {graph.nodes.length} nodes,
        {' '}<strong ref={visibleEdges}>0</strong> / {graph.edges.length} relationships
      </span>
    </div>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

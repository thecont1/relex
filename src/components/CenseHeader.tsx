/**
 * CeNSE-style header for the relexplorer intranet app.
 *
 * Visually mirrors the official CeNSE homepage header (cense.iisc.ac.in):
 *   - Title "CENTRE FOR NANOSCIENCE AND ENGINEERING" in red, all-caps, left.
 *   - Search input centred — this is now the **official** app search (the
 *     sidebar duplicate was removed). Faculty matches appear in a dropdown
 *     directly under the input.
 *   - Combined CeNSE + IISc logo (image-map on the live site) on the far
 *     right, scaled to 50% of its natural size to free vertical space.
 *   - The second-level row used to host 9 CeNSE nav items; those were
 *     removed and replaced with the dataset stats (faculty, verticals,
 *     platforms, collaborations) so the header stays compact and the
 *     network gets more viewport.
 */
import { useEffect, useRef, useState } from 'react';
import { animateCounter } from '../lib/motion';
import { searchFaculty } from '../lib/buildGraph';
import type { GraphModel } from '../lib/types';

interface CenseHeaderProps {
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

export function CenseHeader({
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
}: CenseHeaderProps) {
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

  return (
    <header className="cense-header">
      <div className="cense-header__top">
        <h1 className="cense-header__title">
          CENTRE FOR NANOSCIENCE AND ENGINEERING
        </h1>

        <div className="cense-header__search-wrap">
          <form
            className="cense-header__search"
            role="search"
            onSubmit={submit}
          >
            <label className="sr-only" htmlFor="cense-header-search">
              Search
            </label>
            <input
              id="cense-header-search"
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
              aria-controls="cense-header-search-listbox"
              aria-autocomplete="list"
            />
            <button
              type="submit"
              className="cense-header__search-btn"
              aria-label="Submit search"
            >
              {/* Magnifying glass SVG; matches the icon treatment on cense.iisc.ac.in */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          </form>

          {matches.length > 0 && (
            <ul
              id="cense-header-search-listbox"
              role="listbox"
              className="cense-header__search-dropdown"
            >
              {matches.map((m) => (
                <li key={m.id} role="option" aria-selected="false">
                  <button
                    type="button"
                    className="cense-header__search-option"
                    onClick={() => selectMatch(m.id)}
                  >
                    {m.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Combined CeNSE + IISc logo (315x100 natural). The two halves are
            clickable via the image map on the live site; here we render it
            as a single decorative graphic and scale to 50% so the header
            is more compact and the network gets more vertical room. */}
        <img
          className="cense-header__logo"
          src="/assets/cense/cense-iisc-logo.png"
          alt="CeNSE · IISc"
          draggable={false}
        />
      </div>

      <div className="cense-header__nav" aria-label="Dataset summary">
        <DatasetStats
          graph={graph}
          visibleNodeIds={visibleNodeIds}
          visibleEdgeIds={visibleEdgeIds}
        />

        <div className="cense-header__actions">
          <button
            type="button"
            className="cense-header__action"
            onClick={onReset}
            disabled={resetting}
            aria-label="Re-fetch the workbook from disk"
            title="Re-fetch the workbook from disk"
          >
            {resetting ? 'Resetting…' : 'Reset'}
          </button>
          <button
            type="button"
            className="cense-header__action"
            onClick={onRefresh}
            aria-label="Clear filters, search, and selection"
            title="Clear filters, search, and selection"
          >
            Refresh
          </button>
          <span className="cense-header__action-label" aria-hidden="true">Export</span>
          <button
            type="button"
            className="cense-header__action"
            onClick={onExportPng}
            aria-label="Export current view as PNG"
          >
            PNG
          </button>
          <button
            type="button"
            className="cense-header__action"
            onClick={onExportSvg}
            aria-label="Export current view as SVG"
          >
            SVG
          </button>
          {refreshedAt && (
            <span className="cense-header__refreshed" title={refreshedAt}>
              · refreshed {formatTime(refreshedAt)}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * Stats row that replaces the 9 CeNSE nav items in the second-level header
 * row. Same animated counters as the previous `StatsBar` component, but
 * inline here to avoid an extra row of chrome above the graph canvas.
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
    // animateCounter accepts the ref + target value; useReducedMotion is
    // read inside the helper itself so we don't need to thread it here.
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
    <div className="cense-header__stats" aria-label="Network summary">
      <span className="cense-header__stat"><strong ref={faculty}>0</strong> faculty</span>
      <span className="cense-header__stat"><strong ref={verticals}>0</strong> verticals</span>
      <span className="cense-header__stat"><strong ref={platforms}>0</strong> platforms</span>
      <span className="cense-header__stat"><strong ref={collabs}>0</strong> collaborations</span>
      <span className="cense-header__stat cense-header__stat--muted">
        Showing <strong ref={visibleNodes}>0</strong> / {graph.nodes.length} nodes,
        {' '}<strong ref={visibleEdges}>0</strong> / {graph.edges.length} relationships
      </span>
    </div>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}
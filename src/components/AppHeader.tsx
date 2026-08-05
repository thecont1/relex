/**
 * Generic app header for the relexplorer network visualization.
 *
 * Reads all branding (title, logo, color accent) from the tenant config
 * (injected at build time), so the same component works for every tenant
 * without any hardcoded client-specific references.
 *
 * Layout:
 *   - Tenant-configurable institutional title on the left.
 *   - Search input centred — the official app search. Faculty matches appear
 *     in a dropdown directly under the input.
 *   - Combined logo on the far right.
 *   - Second row: dataset stats (faculty, verticals, platforms, collaborations)
 *     replacing the old nav items so the header stays compact.
 */
import { useEffect, useState } from 'react';
import { searchFaculty } from '../lib/buildGraph';
import { tenantConfig, resolveAssetUrl } from '../tenant/config';
import { ExportControl } from './ExportControl';
import type { GraphModel } from '../lib/types';

interface AppHeaderProps {
  onReset: () => void;
  resetting: boolean;
  onRefresh: () => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  exportEnabled: boolean;
  /** Reason shown when export is disabled (tooltip / aria). */
  exportDisabledReason?: string;
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
}

export function AppHeader({
  onReset,
  resetting,
  onRefresh,
  onExportPng,
  onExportSvg,
  exportEnabled,
  exportDisabledReason,
  onSearch,
  searchQuery,
  onSearchFocusNode,
  onClearSearch,
  graph,
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
        <img
          className="app-header__logo"
          src={resolveAssetUrl(branding.logo.src)}
          alt={branding.logo.alt}
          draggable={false}
        />
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
      </div>

      <div className="app-header__nav" aria-label="Dataset actions">
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
          <ExportControl
            onExportPng={onExportPng}
            onExportSvg={onExportSvg}
            disabled={!exportEnabled}
            disabledReason={exportDisabledReason}
          />
        </div>
      </div>
    </header>
  );
}

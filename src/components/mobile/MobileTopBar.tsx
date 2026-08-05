import { useEffect, useState } from 'react';
import { searchFaculty } from '../../lib/buildGraph';
import { tenantConfig } from '../../tenant/config';
import type { GraphModel } from '../../lib/types';

interface Props {
  graph: GraphModel;
  searchQuery: string;
  onSearch: (q: string) => void;
  onSearchFocusNode: (id: string) => void;
  onClearSearch: () => void;
  onMore: () => void;
}

/** Mobile top bar: tenant logo + institutional wordmark, menu, and search. */
export function MobileTopBar({ graph, searchQuery, onSearch, onSearchFocusNode, onClearSearch, onMore }: Props) {
  const [localValue, setLocalValue] = useState(searchQuery);

  useEffect(() => { setLocalValue(searchQuery); }, [searchQuery]);

  const matches = searchFaculty(graph, localValue).slice(0, 6);

  const selectMatch = (id: string) => {
    onSearchFocusNode(id);
    setLocalValue('');
  };

  const branding = tenantConfig.branding;

  return (
    <header className="mobile-top-bar">
      <div className="mobile-top-bar__row">
        <div className="mobile-top-bar__brand">
          {branding.logo.src && (
            <img
              className="mobile-top-bar__logo"
              src={branding.logo.src}
              alt={branding.logo.alt}
              draggable={false}
            />
          )}
          <h1
            className="mobile-top-bar__wordmark"
            style={{ color: branding.colorAccent }}
          >
            {branding.title.toLocaleUpperCase()}
          </h1>
        </div>
        <button
          type="button"
          className="mobile-top-bar__menu"
          onClick={onMore}
          aria-label="Open menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>
      <div className="mobile-top-bar__search-wrap">
        <input
          type="search"
          className="mobile-top-bar__search-input"
          placeholder="Search faculty…"
          value={localValue}
          onChange={(e) => { setLocalValue(e.target.value); onSearch(e.target.value); }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { onClearSearch(); setLocalValue(''); }
            if (e.key === 'Enter' && matches.length > 0) {
              e.preventDefault();
              selectMatch(matches[0].id);
            }
          }}
          autoComplete="off"
          role="combobox"
          aria-expanded={matches.length > 0}
          aria-autocomplete="list"
          aria-controls="mobile-search-results"
        />
        {matches.length > 0 && (
          <ul id="mobile-search-results" className="mobile-top-bar__search-dropdown" role="listbox">
            {matches.map(m => (
              <li key={m.id} role="option" aria-selected="false">
                <button
                  type="button"
                  className="mobile-top-bar__search-option"
                  onClick={() => selectMatch(m.id)}
                >
                  {m.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}

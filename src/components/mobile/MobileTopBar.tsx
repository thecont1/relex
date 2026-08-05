import { useEffect, useId, useState } from 'react';
import { searchEntities } from '../../lib/buildGraph';
import { tenantConfig, resolveAssetUrl } from '../../tenant/config';
import type { GraphModel, NodeType } from '../../lib/types';

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
  const [activeIndex, setActiveIndex] = useState(0);
  const listboxId = useId();

  useEffect(() => { setLocalValue(searchQuery); }, [searchQuery]);

  const matches = searchEntities(graph, localValue).slice(0, 6);
  const activeMatch = matches[activeIndex] ?? matches[0];

  const selectMatch = (id: string) => {
    onSearchFocusNode(id);
    onSearch('');
    setLocalValue('');
    setActiveIndex(0);
  };

  const branding = tenantConfig.branding;

  return (
    <header className="mobile-top-bar">
      <div className="mobile-top-bar__row">
        <div className="mobile-top-bar__brand">
          {branding.logo.src && (
            <img
              className="mobile-top-bar__logo"
              src={resolveAssetUrl(branding.logo.src)}
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
          placeholder="Search faculty, verticals, platforms…"
          value={localValue}
          onChange={(e) => { setLocalValue(e.target.value); setActiveIndex(0); onSearch(e.target.value); }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onClearSearch();
              setLocalValue('');
              setActiveIndex(0);
            } else if (e.key === 'ArrowDown' && matches.length > 0) {
              e.preventDefault();
              setActiveIndex(index => (index + 1) % matches.length);
            } else if (e.key === 'ArrowUp' && matches.length > 0) {
              e.preventDefault();
              setActiveIndex(index => (index - 1 + matches.length) % matches.length);
            } else if (e.key === 'Enter' && activeMatch) {
              e.preventDefault();
              selectMatch(activeMatch.id);
            }
          }}
          autoComplete="off"
          role="combobox"
          aria-expanded={matches.length > 0}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeMatch ? `${listboxId}-option-${activeMatch.id}` : undefined}
        />
        {matches.length > 0 && (
          <ul id={listboxId} className="mobile-top-bar__search-dropdown" role="listbox">
            {matches.map((match, index) => (
              <li
                key={match.id}
                id={`${listboxId}-option-${match.id}`}
                role="option"
                aria-selected={index === activeIndex}
                className="mobile-top-bar__search-option"
                onClick={() => selectMatch(match.id)}
              >
                <span>{match.label}</span>
                <span className="mobile-top-bar__search-type">{entityTypeLabel(match.type)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}

function entityTypeLabel(type: NodeType): string {
  if (type === 'faculty') return 'Faculty';
  if (type === 'platform') return 'Platform';
  return 'Research vertical';
}

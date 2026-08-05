import { useEffect, useState } from 'react';
import { searchFaculty } from '../../lib/buildGraph';
import type { GraphModel, ThemeMode } from '../../lib/types';

interface Props {
  graph: GraphModel;
  searchQuery: string;
  onSearch: (q: string) => void;
  onSearchFocusNode: (id: string) => void;
  onClearSearch: () => void;
  onMore: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

/**
 * Mobile top bar: wordmark + search input + More trigger.
 * Sticky at top with backdrop blur. No icons — all text labels.
 *
 * Search uses the same searchFaculty pipeline as the desktop AppHeader.
 * Results appear as a dropdown under the input. Selecting a result on
 * mobile is handled by the parent (switches to accessible view + opens detail).
 */
export function MobileTopBar({ graph, searchQuery, onSearch, onSearchFocusNode, onClearSearch, onMore, theme, onToggleTheme }: Props) {
  const [localValue, setLocalValue] = useState(searchQuery);

  useEffect(() => { setLocalValue(searchQuery); }, [searchQuery]);

  const matches = searchFaculty(graph, localValue).slice(0, 6);

  const selectMatch = (id: string) => {
    onSearchFocusNode(id);
    setLocalValue('');
  };

  return (
    <header className="mobile-top-bar">
      <div className="mobile-top-bar__row">
        <span className="mobile-top-bar__wordmark">CeNSE Ecosystem</span>
        <div className="mobile-top-bar__actions">
          <button
            type="button"
            className="mobile-top-bar__theme"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <button
            type="button"
            className="mobile-top-bar__more"
            onClick={onMore}
            aria-label="More options"
          >
            More
          </button>
        </div>
      </div>
      <div className="mobile-top-bar__search-wrap">
        <input
          type="search"
          className="mobile-top-bar__search-input"
          placeholder="Search faculty, verticals, platforms…"
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
        />
        {matches.length > 0 && (
          <ul className="mobile-top-bar__search-dropdown" role="listbox">
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

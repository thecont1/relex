import { useId } from 'react';
import { searchFaculty } from '../lib/buildGraph';
import type { GraphModel } from '../lib/types';

interface Props {
  graph: GraphModel;
  query: string;
  onQueryChange: (q: string) => void;
  onFocusNode: (nodeId: string) => void;
  onClearSearch: () => void;
}

export function SearchBox({ graph, query, onQueryChange, onFocusNode, onClearSearch }: Props) {
  const inputId = useId();
  const listboxId = useId();
  const matches = searchFaculty(graph, query).slice(0, 8);

  const selectMatch = (m: { id: string; label: string } | undefined) => {
    if (!m) return;
    onFocusNode(m.id);
    // Clear the query after selection so the selected result does not remain
    // stuck below the input as an exact-match suggestion.
    onQueryChange('');
  };

  return (
    <div className="control-section" role="search">
      <label htmlFor={inputId} style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
        Search faculty
      </label>
      <div style={{ position: 'relative' }}>
        <input
          id={inputId}
          className="input"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="Start typing a name…"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && matches.length > 0) {
              e.preventDefault();
              selectMatch(matches[0]);
            } else if (e.key === 'Escape') {
              onClearSearch();
            }
          }}
          role="combobox"
          aria-expanded={matches.length > 0}
          aria-controls={listboxId}
          aria-autocomplete="list"
        />
        {matches.length > 0 && (
          <ul
            id={listboxId}
            role="listbox"
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              background: 'var(--surface-2)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--r-sm)',
              listStyle: 'none',
              padding: 4,
              margin: 0,
              maxHeight: 220,
              overflowY: 'auto',
              zIndex: 4,
              boxShadow: 'var(--shadow-2)'
            }}
          >
            {matches.map(m => (
              <li key={m.id} role="option" aria-selected="false">
                <button
                  type="button"
                  className="btn"
                  style={{ width: '100%', justifyContent: 'flex-start', border: 'none', background: 'transparent' }}
                  onClick={() => selectMatch(m)}
                >
                  {m.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {query && (
        <button type="button" className="btn" onClick={onClearSearch}>
          Clear search
        </button>
      )}
    </div>
  );
}
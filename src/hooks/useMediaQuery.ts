import { useEffect, useState } from 'react';

/**
 * Reactive media query hook. Returns `true` when the query matches.
 *
 * Used as the React gate for mobile rendering. The CSS gate is the
 * `body.ui-mobile` class toggled by App.tsx based on this hook's result.
 *
 * The initial value is computed synchronously from `window.matchMedia`
 * so it is available on first render (no flash of desktop content).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    // Sync immediately in case the query changed between init and effect.
    setMatches(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

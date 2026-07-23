// useWorkbookData — fetches, parses, validates, normalizes the workbook and
// returns a state machine describing the load lifecycle.

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadWorkbook } from '../lib/loadWorkbook';
import { validateWorkbook } from '../lib/validateWorkbook';
import { buildGraph } from '../lib/buildGraph';
import type { GraphModel, WorkbookIssue } from '../lib/types';

export type LoadState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ready'; graph: GraphModel; issues: WorkbookIssue[]; refreshedAt: string }
  | { phase: 'error'; message: string };

export function useWorkbookData(): {
  state: LoadState;
  refresh: () => void;
} {
  const [state, setState] = useState<LoadState>({ phase: 'idle' });
  const tokenRef = useRef(0);

  const load = useCallback(async () => {
    const token = ++tokenRef.current;
    setState({ phase: 'loading' });
    try {
      const raw = await loadWorkbook();
      if (tokenRef.current !== token) return; // a newer load superseded us
      const { data, validation } = validateWorkbook(raw);
      if (!validation.ok) {
        setState({
          phase: 'error',
          message: validation.issues
            .filter(i => i.severity === 'error')
            .map(i => i.message)
            .join(' ')
        });
        return;
      }
      const graph = buildGraph(data);
      setState({
        phase: 'ready',
        graph,
        issues: validation.issues,
        refreshedAt: new Date().toISOString()
      });
    } catch (e) {
      if (tokenRef.current !== token) return;
      setState({ phase: 'error', message: (e as Error).message || 'Unknown error' });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { state, refresh: load };
}
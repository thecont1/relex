// useGraphState — central UI state for the visual graph (filters, drawer, search, view mode).
// Kept separate from the rendering layer (Cytoscape or 3d-force-graph) so the same state
// can drive the accessible view's filters and any future renderer.

import { useCallback, useMemo, useState } from 'react';
import type {
  DrawerState,
  GraphFilters,
  GraphModel,
  RenderMode,
  SearchState,
  ViewMode
} from '../lib/types';

/**
 * Synchronous boot-time check for whether the device should default to
 * the mobile/accessible view. Called inside useState's initializer so
 * the initial render is correct without a flash of the visual graph.
 *
 * Returns true when `(pointer: coarse)` OR `(max-width: 900px)` matches.
 */
function isCoarseOrNarrow(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(pointer: coarse), (max-width: 900px)').matches;
}

export interface GraphStateApi {
  filters: GraphFilters;
  drawer: DrawerState;
  search: SearchState;
  view: ViewMode;
  renderMode: RenderMode;
  focusMode: boolean;

  togglePlatforms: () => void;
  toggleVerticals: () => void;
  toggleCollaborations: () => void;
  toggleRelationships: () => void;
  toggleSector: (s: string) => void;
  clearSectors: () => void;
  /** Direct functional updater for filters — used by mobile filter chips. */
  setFilters: (updater: (prev: GraphFilters) => GraphFilters) => void;

  setSearchQuery: (q: string) => void;
  setSearchFocus: (id: string | null) => void;
  clearSearch: () => void;

  openDrawer: (nodeId: string) => void;
  closeDrawer: () => void;

  setView: (v: ViewMode) => void;
  setRenderMode: (m: RenderMode) => void;
  toggleFocusMode: () => void;
  softReset: () => void;
  resetAll: () => void;
  /** @deprecated prefer softReset; kept as an alias for now */
  /** Resets filters/search/drawer without re-fetching the workbook. */

  /** The set of node IDs currently visible given filters + search focus. */
  visibleNodeIds: Set<string>;
  /** The set of edge IDs currently visible given filters. */
  visibleEdgeIds: Set<string>;
}

export function useGraphState(graph: GraphModel | null): GraphStateApi {
  const [filters, setFilters] = useState<GraphFilters>({
    showPlatforms: true,             // default: platforms visible so the user sees the full ecosystem on first load
    showVerticals: true,
    showCollaborations: true,
    showRelationships: true,          // default: relationship lines visible (toggle in sidebar)
    activeSectors: new Set()
  });
  const [drawer, setDrawer] = useState<DrawerState>({ open: false, nodeId: null });
  const [search, setSearch] = useState<SearchState>({ query: '', focusId: null });
  const [view, setView] = useState<ViewMode>(() => isCoarseOrNarrow() ? 'accessible' : 'visual');
  const [renderMode, setRenderMode] = useState<RenderMode>('flat');
  const [focusMode, setFocusMode] = useState(false);

  const togglePlatforms = useCallback(() =>
    setFilters(f => ({ ...f, showPlatforms: !f.showPlatforms })), []);
  const toggleVerticals = useCallback(() =>
    setFilters(f => ({ ...f, showVerticals: !f.showVerticals })), []);
  const toggleCollaborations = useCallback(() =>
    setFilters(f => ({ ...f, showCollaborations: !f.showCollaborations })), []);
  const toggleRelationships = useCallback(() =>
    setFilters(f => ({ ...f, showRelationships: !f.showRelationships })), []);
  const toggleSector = useCallback((sector: string) =>
    setFilters(f => {
      const next = new Set(f.activeSectors);
      if (next.has(sector)) next.delete(sector); else next.add(sector);
      return { ...f, activeSectors: next };
    }), []);
  const clearSectors = useCallback(() =>
    setFilters(f => ({ ...f, activeSectors: new Set() })), []);

  const setSearchQuery = useCallback((q: string) =>
    setSearch(s => ({ ...s, query: q })), []);
  const setSearchFocus = useCallback((id: string | null) =>
    setSearch(s => ({ ...s, focusId: id })), []);
  const clearSearch = useCallback(() =>
    setSearch({ query: '', focusId: null }), []);

  const openDrawer = useCallback((nodeId: string) =>
    setDrawer({ open: true, nodeId }), []);
  const closeDrawer = useCallback(() =>
    setDrawer({ open: false, nodeId: null }), []);

  const toggleFocusMode = useCallback(() => setFocusMode(f => !f), []);

  /**
   * Soft reset: clears filters, search, focus, and the drawer. Does NOT
   * re-fetch the workbook — the loaded data stays in memory. The Refresh
   * button is wired to this action.
   */
  const softReset = useCallback(() => {
    setFilters({
      showPlatforms: true,
      showVerticals: true,
      showCollaborations: true,
      showRelationships: true,
      activeSectors: new Set()
    });
    setSearch({ query: '', focusId: null });
    setDrawer({ open: false, nodeId: null });
  }, []);

  /** @deprecated kept for backwards-compat with existing call sites. Use softReset. */
  const resetAll = softReset;

  // ---------- compute visible ids from current filters ----------
  const visibleNodeIds = useMemo<Set<string>>(() => {
    const out = new Set<string>();
    if (!graph) return out;
    for (const n of graph.nodes) {
      // Always show faculty.
      if (n.type !== 'faculty') {
        if (n.type === 'platform' && !filters.showPlatforms) continue;
        if (n.type === 'vertical' && !filters.showVerticals) continue;
      }
      if (filters.activeSectors.size > 0) {
        // For nodes with a category (platform/vertical), require membership.
        if (n.category && !filters.activeSectors.has(n.category)) continue;
        // Faculty inherit sector visibility from their connected category nodes;
        // if none of the active sectors match any of their connections, hide them.
        if (!n.category) {
          const connectedSectors = new Set<string>();
          for (const e of graph.edges) {
            if (e.source === n.id) {
              const t = graph.nodes.find(x => x.id === e.target);
              if (t?.category) connectedSectors.add(t.category);
            } else if (e.target === n.id) {
              const s = graph.nodes.find(x => x.id === e.source);
              if (s?.category) connectedSectors.add(s.category);
            }
          }
          let anyMatch = false;
          for (const s of Array.from(connectedSectors)) if (filters.activeSectors.has(s)) { anyMatch = true; break; }
          if (!anyMatch) continue;
        }
      }
      out.add(n.id);
    }
    return out;
  }, [graph, filters]);

  const visibleEdgeIds = useMemo<Set<string>>(() => {
    const out = new Set<string>();
    if (!graph) return out;
    for (const e of graph.edges) {
      if (e.type === 'faculty-faculty' && !filters.showCollaborations) continue;
      if (e.type === 'faculty-platform' && !filters.showPlatforms) continue;
      if (e.type === 'faculty-vertical' && !filters.showVerticals) continue;
      if (!visibleNodeIds.has(e.source) || !visibleNodeIds.has(e.target)) continue;
      out.add(e.id);
    }
    return out;
  }, [graph, filters, visibleNodeIds]);

  return {
    filters, drawer, search, view, renderMode, focusMode,
    togglePlatforms, toggleVerticals, toggleCollaborations, toggleRelationships, toggleSector, clearSectors,
    setFilters,
    setSearchQuery, setSearchFocus, clearSearch,
    openDrawer, closeDrawer,
    setView, setRenderMode, toggleFocusMode, softReset, resetAll,
    visibleNodeIds, visibleEdgeIds
  };
}
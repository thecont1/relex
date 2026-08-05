import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkbookData } from '../hooks/useWorkbookData';
import { useGraphState } from '../hooks/useGraphState';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { GraphCanvas, type GraphCanvasHandle } from '../components/GraphCanvas';
import { GlobeCanvas, type GlobeCanvasHandle } from '../components/GlobeCanvas';
import { ControlPanel } from '../components/ControlPanel';
import { DetailDrawer } from '../components/DetailDrawer';
import { AccessibleView } from '../components/AccessibleView';
import { ErrorBanner, WarningBanner } from '../components/WarningBanner';
import { FocusModeToggle } from '../components/FocusModeToggle';
import { AppHeader } from '../components/AppHeader';
import { StatsBar } from '../components/StatsBar';
import { MobileTopBar } from '../components/mobile/MobileTopBar';
import { MobileControls, type SheetType } from '../components/mobile/MobileControls';
import { MobileDetailDrawer } from '../components/mobile/MobileDetailDrawer';
import { MobileGraphHint } from '../components/mobile/MobileGraphHint';
import { exportPng, exportSvg } from '../lib/exportGraph';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { fadeIn } from '../lib/motion';
import { tenantConfig } from '../tenant/config';
import type { GraphModel, ThemeMode } from '../lib/types';

const SCALE_MODEL_BASE = 1.3;
const NETWORK_SCALE_MIN = 0.6;
const NETWORK_SCALE_MAX = 1.5;
const NETWORK_SCALE_STEP = 0.1;

/**
 * Stub graph model used in the error state. The header still renders
 * (so the user can hit Reset to retry the workbook fetch), but the
 * dataset is empty so the stats row reads zero and the search dropdown
 * never shows matches.
 */
const emptyGraphModel: GraphModel = {
  nodes: [],
  edges: [],
  sectors: [],
  counts: {
    faculty: 0,
    platforms: 0,
    verticals: 0,
    edges: { 'faculty-faculty': 0, 'faculty-platform': 0, 'faculty-vertical': 0 },
  },
};

export function App() {
  const { state, refresh } = useWorkbookData();
  const reducedMotion = useReducedMotion();

  // Graph state can only be constructed once we have a graph.
  // When data isn't ready, useGraphState returns stable no-op handlers.
  const graph = state.phase === 'ready' ? state.graph : null;
  const gs = useGraphState(graph);

  const shellRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<GraphCanvasHandle | null>(null);
  const globeRef = useRef<GlobeCanvasHandle | null>(null);
  // Track a manual reset (re-fetch) so the button shows a busy state while
  // the workbook is reloading. The flag is dropped automatically once the
  // load completes.
  const [resetting, setResetting] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('dark');
  // highlightNodeId drives an external pin+highlight in the graph when a node
  // is selected from the detail drawer (sidebar). Mirrors the click-on-node
  // visual so the graph always reflects the currently-open detail.
  const [highlightNodeId, setHighlightNodeId] = useState<string | null>(null);
  // Display fraction: 1.0 === 100% (the size the user calibrated). Multiplied
  // by SCALE_MODEL_BASE before it reaches the renderers.
  const [networkScale, setNetworkScale] = useState(1);
  const modelScale = networkScale * SCALE_MODEL_BASE;

  const isMobile = useMediaQuery('(pointer: coarse), (max-width: 900px)');
  const [mobileSheet, setMobileSheet] = useState<SheetType>('none');

  const increaseNetworkScale = useCallback(() => {
    setNetworkScale(v => Math.min(NETWORK_SCALE_MAX, roundScale(v + NETWORK_SCALE_STEP)));
  }, []);
  const decreaseNetworkScale = useCallback(() => {
    setNetworkScale(v => Math.max(NETWORK_SCALE_MIN, roundScale(v - NETWORK_SCALE_STEP)));
  }, []);

  // Drop the resetting flag once the load completes.
  useEffect(() => {
    if (resetting && state.phase !== 'loading') {
      setResetting(false);
    }
  }, [resetting, state.phase]);

  // Clear highlight when the graph data changes (e.g. after a workbook re-fetch)
  // so a stale pin can't linger over a node that may no longer exist.
  useEffect(() => {
    setHighlightNodeId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase === 'ready' ? state.graph : null]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [theme]);

  // Mobile body class — the CSS gate for all mobile-specific overrides.
  useEffect(() => {
    document.body.classList.toggle('ui-mobile', isMobile);
    return () => document.body.classList.remove('ui-mobile');
  }, [isMobile]);

  // Reset = full re-fetch. Equivalent to a browser page refresh: tears down
  // everything, re-loads the xlsx, rebuilds the graph from scratch, and
  // re-runs the band layout. In a browser page refresh the React state is
  // implicitly cleared because the app re-mounts; in this SPA we clear it
  // explicitly here so the behavior is observably equivalent.
  const handleReset = useCallback(() => {
    setResetting(true);
    setHighlightNodeId(null);
    setLiveMessage('Resetting workbook…');
    gs.softReset();
    refresh();
  }, [gs, refresh]);

  // Refresh = soft reset. Clears filters, search query, search focus,
  // and the detail drawer — but keeps the loaded workbook data intact.
  // Useful when the user has applied a bunch of filter state and wants a
  // clean view of the current data.
  const handleSoftReset = useCallback(() => {
    gs.softReset();
    setHighlightNodeId(null);
    setLiveMessage('Filters and selection cleared.');
  }, [gs]);

  const [liveMessage, setLiveMessage] = useState<string>('');
  const lastIssueCountRef = useRef<number>(0);

  // Announce warning count changes to assistive tech.
  useEffect(() => {
    if (state.phase !== 'ready') return;
    const warnings = state.issues.filter(i => i.severity === 'warning').length;
    if (warnings !== lastIssueCountRef.current) {
      lastIssueCountRef.current = warnings;
      setLiveMessage(warnings > 0
        ? `Loaded workbook with ${warnings} data quality warning${warnings === 1 ? '' : 's'}.`
        : 'Loaded workbook successfully.');
    }
  }, [state]);

  // Initial fade-in. Run only once on mount.
  useEffect(() => {
    if (!shellRef.current || reducedMotion) return;
    fadeIn(shellRef.current, reducedMotion);
  }, [reducedMotion]);

  // Sync focus-mode body class with state. GSAP drives the fade animation;
  // the class is what actually hides the chrome. Reduced-motion snaps state
  // instantly with no animation.
  useEffect(() => {
    const body = document.body;
    if (gs.focusMode) {
      body.classList.add('focus-mode');
    } else {
      body.classList.remove('focus-mode');
    }
  }, [gs.focusMode, reducedMotion]);

  const onExportPng = useCallback(() => {
    const cy = canvasRef.current?.getCy();
    if (!cy) return;
    exportPng(cy, filenameStamp(tenantConfig.features.exportFilenameBase, 'png'));
    setLiveMessage('Exported PNG.');
  }, []);

  const onExportSvg = useCallback(() => {
    const cy = canvasRef.current?.getCy();
    if (!cy) return;
    exportSvg(cy, filenameStamp(tenantConfig.features.exportFilenameBase, 'svg'));
    setLiveMessage('Exported SVG.');
  }, []);

  // ---- Render branches ----

  if (state.phase === 'idle' || state.phase === 'loading') {
    return (
      <div className="state-message" ref={shellRef}>
        <div className="spinner" aria-hidden="true" />
        <p>Loading workbook…</p>
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="app-shell" ref={shellRef}>
        <AppHeader
          onReset={handleReset}
          resetting={false}
          onRefresh={handleSoftReset}
          onExportPng={() => {}}
          onExportSvg={() => {}}
          searchQuery=""
          onSearch={() => {}}
          onSearchFocusNode={() => {}}
          onClearSearch={() => {}}
          graph={emptyGraphModel}
        />
        <main className="app-body" style={{ gridTemplateColumns: '1fr' }}>
          <div style={{ padding: 'var(--sp-5)' }}>
            <ErrorBanner message={state.message} />
          </div>
        </main>
      </div>
    );
  }

  // Ready state — mobile branch
  if (isMobile) {
    return (
      <div className="app-shell" data-theme={theme} ref={shellRef}>
        <a className="skip-link" href="#main">Skip to main content</a>
        <MobileTopBar
          graph={state.graph}
          searchQuery={gs.search.query}
          onSearch={(q) => { gs.setSearchQuery(q); if (q) gs.setSearchFocus(null); }}
          onSearchFocusNode={(id) => {
            gs.setSearchFocus(id);
            gs.setView('accessible');
            gs.openDrawer(id);
            setHighlightNodeId(id);
            setLiveMessage(`Focused ${state.graph.nodes.find(n => n.id === id)?.label ?? 'faculty member'}.`);
          }}
          onClearSearch={() => { gs.clearSearch(); setHighlightNodeId(null); }}
          onMore={() => setMobileSheet('more')}
        />
        <MobileControls
          graph={state.graph}
          filters={gs.filters}
          onToggleSector={gs.toggleSector}
          onClearSectors={gs.clearSectors}
          onTogglePlatforms={gs.togglePlatforms}
          onToggleVerticals={gs.toggleVerticals}
          onToggleCollaborations={gs.toggleCollaborations}
          onToggleRelationships={gs.toggleRelationships}
          onSoftReset={gs.softReset}
          renderMode={gs.renderMode}
          onRenderModeChange={gs.setRenderMode}
          view={gs.view}
          onViewChange={gs.setView}
          visibleNodeIds={gs.visibleNodeIds}
          visibleEdgeIds={gs.visibleEdgeIds}
          refreshedAt={state.refreshedAt}
          onRefresh={handleSoftReset}
          onReset={handleReset}
          onExportPng={onExportPng}
          onExportSvg={onExportSvg}
          resetting={resetting}
          openSheet={mobileSheet}
          onOpenSheet={setMobileSheet}
          onCloseSheet={() => setMobileSheet('none')}
          theme={theme}
          onToggleTheme={() => {
            const next = theme === 'dark' ? 'light' : 'dark';
            setTheme(next);
            setLiveMessage(`Switched to ${next} mode.`);
          }}
        />
        <MobileGraphHint view={gs.view} />
        <main className="app-body" id="main" style={{ gridTemplateColumns: '1fr' }}>
          <section className={'stage' + (gs.view === 'visual' ? ' stage--visual' : '')} aria-label={gs.view === 'visual' ? 'Visual graph' : 'Accessible view'}>
            {state.issues.length > 0 && (
              <div style={{ padding: 'var(--sp-3) var(--sp-5) 0' }}>
                <WarningBanner issues={state.issues} />
              </div>
            )}
            {gs.view === 'visual' ? (
              <div className="cy-stage">
                {gs.renderMode === 'globe' ? (
                  <GlobeCanvas
                    ref={globeRef}
                    graph={state.graph}
                    filters={gs.filters}
                    searchFocusId={gs.search.focusId}
                    highlightNodeId={highlightNodeId}
                    theme={theme}
                    networkScale={modelScale}
                    onNodeClick={(id) => { gs.openDrawer(id); setHighlightNodeId(id); }}
                  />
                ) : (
                  <GraphCanvas
                    ref={canvasRef}
                    graph={state.graph}
                    filters={gs.filters}
                    searchFocusId={gs.search.focusId}
                    highlightNodeId={highlightNodeId}
                    theme={theme}
                    networkScale={modelScale}
                    onNodeClick={(id) => { gs.openDrawer(id); setHighlightNodeId(id); }}
                  />
                )}
              </div>
            ) : (
              <AccessibleView
                graph={state.graph}
                filters={gs.filters}
                onSelectNode={(id) => { gs.openDrawer(id); setHighlightNodeId(id); }}
                compact
              />
            )}
          </section>
        </main>
        <MobileDetailDrawer
          graph={state.graph}
          nodeId={gs.drawer.nodeId}
          open={gs.drawer.open}
          onClose={() => { gs.closeDrawer(); setHighlightNodeId(null); setLiveMessage('Closed detail drawer.'); }}
          onSelectNode={(id) => { gs.openDrawer(id); setHighlightNodeId(id); }}
        />
        <div className="live-region" role="status" aria-live="polite" aria-atomic="true">
          {liveMessage}
        </div>
      </div>
    );
  }

  // Ready state — desktop branch
  return (
    <div className="app-shell" data-theme={theme} ref={shellRef}>
      <a className="skip-link" href="#main">Skip to main content</a>
      <AppHeader
        onReset={handleReset}
        resetting={resetting}
        onRefresh={handleSoftReset}
        onExportPng={onExportPng}
        onExportSvg={onExportSvg}
        searchQuery={gs.search.query}
        onSearch={(q) => {
          gs.setSearchQuery(q);
          if (q) gs.setSearchFocus(null);
        }}
        onSearchFocusNode={(id) => {
          gs.setSearchFocus(id);
          setHighlightNodeId(id);
          setLiveMessage(`Focused ${state.graph.nodes.find(n => n.id === id)?.label ?? 'faculty member'}.`);
        }}
        onClearSearch={() => { gs.clearSearch(); setHighlightNodeId(null); }}
        graph={state.graph}
      />
      <StatsBar
        graph={state.graph}
        visibleNodeIds={gs.visibleNodeIds}
        visibleEdgeIds={gs.visibleEdgeIds}
        refreshedAt={state.refreshedAt}
      />
      <main className="app-body" id="main">
        <ControlPanel
          graph={state.graph}
          filters={gs.filters}
          onToggleSector={gs.toggleSector}
          onClearSectors={gs.clearSectors}
          renderMode={gs.renderMode}
          onRenderModeChange={gs.setRenderMode}
          view={gs.view}
          onViewChange={gs.setView}
        />

        <section className="stage" aria-label={gs.view === 'visual' ? 'Visual graph' : 'Accessible view'}>
          {state.issues.length > 0 && (
            <div style={{ padding: 'var(--sp-3) var(--sp-5) 0' }}>
              <WarningBanner issues={state.issues} />
            </div>
          )}

          {gs.view === 'visual' ? (
            <>
              <div className="cy-stage">
                {gs.renderMode === 'globe' ? (
                  <GlobeCanvas
                    ref={globeRef}
                    graph={state.graph}
                    filters={gs.filters}
                    searchFocusId={gs.search.focusId}
                    highlightNodeId={highlightNodeId}
                    theme={theme}
                    networkScale={modelScale}
                    onNodeClick={(id) => { gs.openDrawer(id); setHighlightNodeId(id); }}
                  />
                ) : (
                  <GraphCanvas
                    ref={canvasRef}
                    graph={state.graph}
                    filters={gs.filters}
                    searchFocusId={gs.search.focusId}
                    highlightNodeId={highlightNodeId}
                    theme={theme}
                    networkScale={modelScale}
                    onNodeClick={(id) => { gs.openDrawer(id); setHighlightNodeId(id); }}
                  />
                )}
                <DetailDrawer
                  graph={state.graph}
                  nodeId={gs.drawer.nodeId}
                  open={gs.drawer.open}
                  onClose={() => { gs.closeDrawer(); setHighlightNodeId(null); setLiveMessage('Closed detail drawer.'); }}
                  onSelectNode={(id) => {
                    gs.openDrawer(id);
                    setHighlightNodeId(id);
                  }}
                />
              </div>
            </>
          ) : (
            <AccessibleView
              graph={state.graph}
              filters={gs.filters}
              onSelectNode={(id) => { gs.openDrawer(id); setHighlightNodeId(id); }}
            />
          )}
        </section>
      </main>

      {/* Bottom-left control dock: Show/Hide (focus mode), zoom, and theme
          toggle live together in the bottom-left corner. Zoom + theme are only
          meaningful in the visual view, so they are gated on it; the Show/Hide
          toggle is always present so the user can always escape focus mode. */}
      <div className="corner-dock">
        <FocusModeToggle
          active={gs.focusMode}
          onToggle={() => {
            const next = !gs.focusMode;
            gs.toggleFocusMode();
            setLiveMessage(next ? 'Focus mode on.' : 'Showing controls.');
          }}
        />
        {gs.view === 'visual' && (
          <>
            <NetworkScaleControls
              value={networkScale}
              onIncrease={increaseNetworkScale}
              onDecrease={decreaseNetworkScale}
            />
            <ThemeToggle
              theme={theme}
              onToggle={() => {
                const next = theme === 'dark' ? 'light' : 'dark';
                setTheme(next);
                setLiveMessage(`Switched to ${next} mode.`);
              }}
            />
          </>
        )}
      </div>

      <div className="live-region" role="status" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </div>
    </div>
  );
}

function NetworkScaleControls({
  value,
  onIncrease,
  onDecrease
}: {
  value: number;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  const pct = Math.round(value * 100);
  const atMin = value <= NETWORK_SCALE_MIN + 0.001;
  const atMax = value >= NETWORK_SCALE_MAX - 0.001;
  return (
    <div className="network-scale-controls" aria-label="Network element size controls">
      <button
        type="button"
        className="btn network-scale-controls__btn"
        onClick={onDecrease}
        disabled={atMin}
        aria-label="Make network elements smaller"
        title="Make network elements smaller"
      >
        −
      </button>
      <span className="network-scale-controls__value" aria-live="polite">{pct}%</span>
      <button
        type="button"
        className="btn network-scale-controls__btn"
        onClick={onIncrease}
        disabled={atMax}
        aria-label="Make network elements larger"
        title="Make network elements larger"
      >
        +
      </button>
    </div>
  );
}

function roundScale(v: number): number {
  return Math.round(v * 100) / 100;
}

function ThemeToggle({
  theme,
  onToggle
}: {
  theme: ThemeMode;
  onToggle: () => void;
}) {
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="corner-dock__btn theme-toggle"
      onClick={onToggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  // Shown in dark mode: clicking switches to light.
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.9" y1="4.9" x2="7" y2="7" />
      <line x1="17" y1="17" x2="19.1" y2="19.1" />
      <line x1="4.9" y1="19.1" x2="7" y2="17" />
      <line x1="17" y1="7" x2="19.1" y2="4.9" />
    </svg>
  );
}

function MoonIcon() {
  // Shown in light mode: clicking switches to dark.
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function filenameStamp(base: string, ext: string): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  return `${base}-${yyyy}${mm}${dd}-${hh}${mi}.${ext}`;
}

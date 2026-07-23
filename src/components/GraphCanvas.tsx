// GraphCanvas — Cytoscape render and behavior.
//
// DEFAULT VIEW CHOICE & JUSTIFICATION
// -----------------------------------
// First load shows: faculty (circles) + research verticals (hexagons) +
// faculty–faculty collaborations (edges). Platforms (rounded squares) are
// off by default but a single toggle reveals them.
// (See README.md for full rationale.)
//
// LAYOUT STRATEGY — ASPECT-AWARE BAND
// -----------------------------------
// The container is a tight rectangle (wide-and-short on a desktop, but can be
// narrow-and-tall when the sidebar wraps or on a smaller window). Pure radial
// force layouts assume a square and spill off the edges. We instead organise
// nodes into horizontal bands that read top-to-bottom in a wide container and
// rotate the bands left-to-right in a tall container:
//
//   WIDE container (aspect >= 1):                TALL container (aspect < 1):
//     ┌───────────────────────────────┐             ┌───┐ ┌───┐ ┌───┐ ┌───┐
//     │ VERTICALS (top band)          │             │ V │ │ V │ │ V │ │ V │
//     ├───────────────────────────────┤             ├───┤ ├───┤ ├───┤ ├───┤
//     │ FACULTY (middle band)         │             │ F │ │ A │ │ C │ │ U │
//     ├───────────────────────────────┤             ├───┤ ├───┤ ├───┤ ├───┤
//     │ PLATFORMS (bottom band)       │             │ P │ │ L │ │ A │ │ T │
//     └───────────────────────────────┘             └───┘ └───┘ └───┘ └───┘
//
// Verticals and platforms are pinned to fixed anchor positions on the band
// rows/columns; faculty settle under fcose in the middle band. This guarantees
// all nodes are visible without scrolling/zooming on first load (we fit to the
// container after layout) and edges cross less because the band structure
// keeps affiliation edges short.
//
// VISUAL HIERARCHY
// ----------------
// Faculty nodes are classified by degree centrality into "hub" (top quartile)
// and "peripheral" (lower degree). Hubs render larger and brighter; peripheral
// nodes smaller and dimmer at rest. Labels are revealed progressively — hubs
// and all verticals/platforms are always labeled; peripheral faculty show
// their label only when zoomed in past a threshold (auto-applied via a CSS
// compound selector managed in JS).
//
// Collaboration edges are curved (unbundled-bezier) and rendered at higher
// opacity; affiliation edges render at lower opacity so the eye reads the
// collaboration network as the primary story without affiliation noise
// competing for attention.

import { useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import cytoscapeSvg from 'cytoscape-svg';
import { sectorColor } from '../lib/colorSystem';
import { HighlightController, type HighlightState } from '../lib/highlightController';
import { computeEgoNetwork } from '../lib/egoNetwork';
import {
  computeBaseDiameter,
  degreeMultiplier,
  boxesOverlap,
  separationVector,
  computeStandardizedShapeSize,
  type Box,
  type InlineLabelSize
} from '../lib/dynamicLayout';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type {
  EdgeType,
  GraphFilters,
  GraphModel,
  ThemeMode
} from '../lib/types';

if (!(cytoscape as any).__fcoseRegistered) {
  cytoscape.use(fcose);
  (cytoscape as any).__fcoseRegistered = true;
}
if (!(cytoscape as any).__svgRegistered) {
  cytoscape.use(cytoscapeSvg);
  (cytoscape as any).__svgRegistered = true;
}

export interface GraphCanvasHandle {
  relayout: () => void;
  fit: () => void;
  resetView: () => void;
  getCy: () => cytoscape.Core | null;
}

interface Props {
  graph: GraphModel;
  filters: GraphFilters;
  searchFocusId: string | null;
  /** External highlight/pin target (e.g. from the detail drawer). When this
   * changes to a new node id, the graph pins and highlights that node's ego
   * network — the same visual as clicking the node directly. Does not clear
   * the pin when set to null (use searchFocusId for that). */
  highlightNodeId: string | null;
  theme: ThemeMode;
  networkScale: number;
  onNodeClick: (nodeId: string) => void;
}

interface ContainerMetrics {
  width: number;
  height: number;
  /** width / height. > 1 = wider than tall, < 1 = taller than wide. */
  aspect: number;
  /** Pinned positions for verticals (anchor band). */
  verticalAnchors: { id: string; pos: { x: number; y: number } }[];
  /** Pinned positions for platforms (anchor band). */
  platformAnchors: { id: string; pos: { x: number; y: number } }[];
}

export const GraphCanvas = forwardRef<GraphCanvasHandle, Props>(function GraphCanvas(
  { graph, filters, searchFocusId, highlightNodeId, theme, networkScale, onNodeClick },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const clickHandlerRef = useRef(onNodeClick);
  clickHandlerRef.current = onNodeClick;

  // Latest graph held in a ref so the persistent HighlightController render
  // callback (created once at mount) always resolves ego networks against the
  // current data instead of a captured stale closure.
  const graphRef = useRef(graph);
  graphRef.current = graph;

  const reduced = useReducedMotion();
  const controllerRef = useRef<HighlightController | null>(null);
  // Roving keyboard focus index into the currently-visible node list.
  const focusIdRef = useRef<string | null>(null);
  // Track whether the active pin originated from search so clearing search only
  // clears its own pin, never a user's click-pin.
  const searchPinRef = useRef(false);

  const [metrics, setMetrics] = useState<ContainerMetrics | null>(null);

  const elements = useMemo(() => buildElements(graph), [graph]);
  const stylesheet = useMemo(() => buildStylesheet(graph, filters, theme, networkScale), [graph, filters, theme, networkScale]);

  // ---------- measure container (debounced resize) ----------
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      setMetrics(computeMetrics(rect.width, rect.height, graphRef.current));
    };
    // Initial measure is immediate; subsequent resizes are debounced ~180ms so
    // the fit-and-scale pass doesn't thrash during a drag-resize.
    measure();
    const onResize = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(measure, 180);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(node);
    return () => {
      if (timer) clearTimeout(timer);
      ro.disconnect();
    };
  }, [graph]);

  // ---------- mount cytoscape once ----------
  useEffect(() => {
    if (!containerRef.current) return;
    const host = containerRef.current;
    const cy = cytoscape({
      container: host,
      elements: elements(),
      style: stylesheet(),
      layout: { name: 'preset' } as any,
      // Lowered from 0.25: with inline-label anchors the model-space graph is
      // larger, and a narrow/tall container needs to zoom further out to fit
      // the whole graph without clipping at the container edges.
      minZoom: 0.1,
      maxZoom: 3,
      autoungrabify: false
    });
    cyRef.current = cy;
    cy.scratch('_graph', graphRef.current);
    cy.scratch('_networkScale', networkScale);

    if (typeof window !== 'undefined') {
      (window as unknown as { __cy?: cytoscape.Core }).__cy = cy;
    }

    // The single source of truth for hover/focus/pin decay, shared in spirit
    // with the Globe view (same controller class). The render callback maps the
    // normalized highlight state onto Cytoscape visuals.
    const controller = new HighlightController({
      reducedMotion: reduced,
      render: (state: HighlightState) => {
        const c = cyRef.current;
        if (!c) return;
        if (!state.nodeId || state.intensity <= 0.001) {
          clearHighlight(c);
          recomputeDegreeClasses(c, graphRef.current);
          applyZoomClass(c);
          return;
        }
        applyHighlight(c, graphRef.current, state, getVisibleMask(c));
      }
    });
    controllerRef.current = controller;

    const setCursor = (v: string) => { host.style.cursor = v; };

    // Click = toggle a persistent pin AND open the drawer (spec: both happen
    // together). Pin is independent of subsequent mouse movement.
    cy.on('tap', 'node', (evt) => {
      const id = evt.target.id();
      searchPinRef.current = false;
      controller.togglePin(id);
      clickHandlerRef.current(id);
    });
    // Tapping empty canvas clears any pin.
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        searchPinRef.current = false;
        controller.unpin();
      }
    });
    cy.on('mouseover', 'node', (evt) => {
      setCursor('pointer');
      controller.hoverIn(evt.target.id());
    });
    cy.on('mouseout', 'node', () => {
      setCursor('');
      controller.hoverOut();
    });
    cy.on('zoom', () => applyZoomClass(cy));
    cy.on('wheel', () => markUserZoomed());
    cy.on('pinch', () => markUserZoomed());

    // ---------- keyboard accessibility: roving focus over visible nodes ----------
    // Cytoscape renders to a single canvas (no per-node DOM), so we implement
    // an in-canvas roving focus: Tab/Arrows move a virtual focus between visible
    // nodes and drive the SAME highlight controller as mouse hover; Enter/Space
    // pins + opens the drawer; Escape clears.
    host.tabIndex = 0;
    const visibleNodeIdsSorted = (): string[] =>
      cy.nodes()
        .filter((n) => n.style('display') !== 'none' && !n.id().startsWith('__anchor__'))
        .sort((a, b) => a.data('label').localeCompare(b.data('label')))
        .map((n) => n.id());

    const moveFocus = (dir: 1 | -1) => {
      const ids = visibleNodeIdsSorted();
      if (ids.length === 0) return;
      const cur = focusIdRef.current;
      let idx = cur ? ids.indexOf(cur) : -1;
      idx = (idx + dir + ids.length) % ids.length;
      const nextId = ids[idx];
      focusIdRef.current = nextId;
      // Keyboard focus produces the identical highlight/decay behavior as hover.
      controller.hoverIn(nextId);
      const node = cy.getElementById(nextId);
      if (node.nonempty()) {
        cy.animate({ center: { eles: node }, duration: reduced ? 0 : 240, easing: 'ease-out' } as any);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          moveFocus(1);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          moveFocus(-1);
          break;
        case 'Tab':
          // Move to the first node on entry; let subsequent Tab escape the
          // canvas naturally once a node is focused so keyboard users aren't
          // trapped.
          if (!focusIdRef.current) {
            e.preventDefault();
            moveFocus(1);
          }
          break;
        case 'Enter':
        case ' ': {
          const id = focusIdRef.current;
          if (id) {
            e.preventDefault();
            searchPinRef.current = false;
            controller.togglePin(id);
            clickHandlerRef.current(id);
          }
          break;
        }
        case 'Escape':
          e.preventDefault();
          searchPinRef.current = false;
          focusIdRef.current = null;
          controller.unpin();
          break;
      }
    };
    host.addEventListener('keydown', onKeyDown);
    const onBlur = () => {
      focusIdRef.current = null;
      if (!controller.isPinned()) controller.hoverOut();
    };
    host.addEventListener('blur', onBlur);

    return () => {
      host.removeEventListener('keydown', onKeyDown);
      host.removeEventListener('blur', onBlur);
      controller.destroy();
      controllerRef.current = null;
      cy.destroy();
      cyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the controller's reduced-motion setting live.
  useEffect(() => {
    controllerRef.current?.setReducedMotion(reduced);
  }, [reduced]);

  // ---------- react to data changes ----------
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    controllerRef.current?.reset();
    focusIdRef.current = null;
    searchPinRef.current = false;
    cy.batch(() => {
      cy.elements().remove();
      cy.add(elements());
    });
    cy.scratch('_graph', graph);
    cy.scratch('_networkScale', networkScale);
    resetLabelDisclosure();
    runLayout(cy, metrics);
    recomputeDegreeClasses(cy, graph);
    applyZoomClass(cy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  // ---------- react to metrics changes (initial / resize) ----------
  // On resize we re-run the fit-and-scale pass (which re-derives node sizes from
  // the new available area and reflows), and only re-run the full band layout
  // when the aspect ratio crosses the wide/tall boundary (bands rotate).
  const prevAspectWideRef = useRef<boolean | null>(null);
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !metrics) return;
    const nowWide = metrics.aspect >= 1;
    const prevWide = prevAspectWideRef.current;
    prevAspectWideRef.current = nowWide;
    controllerRef.current?.reset();
    if (prevWide === null || prevWide !== nowWide) {
      // First layout, or the container flipped orientation → full relayout.
      resetLabelDisclosure();
      runLayout(cy, metrics);
    } else {
      // Same orientation, just a size change → cheap fit-and-scale reflow.
      applyDynamicScale(cy, metrics);
    }
    recomputeDegreeClasses(cy, graph);
    applyZoomClass(cy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics]);

  // ---------- react to theme / network-scale changes ----------
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.scratch('_networkScale', networkScale);
    cy.style().fromJson(stylesheet()).update();
    cy.edges().forEach(e => { e.removeScratch('_bw'); });
    applyDynamicScale(cy, metrics);
    recomputeDegreeClasses(cy, graph);
    applyZoomClass(cy);
  }, [theme, networkScale, stylesheet, graph, metrics]);

  // ---------- react to filter changes ----------
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    controllerRef.current?.reset();
    focusIdRef.current = null;
    cy.style().fromJson(stylesheet()).update();
    const wasPlatformsVisible = cy.nodes('.platform').some(n => n.style('display') !== 'none');
    applyVisibility(cy, graph, filters);
    const nowPlatformsVisible = filters.showPlatforms;
    // When platforms enter the visible set, re-run the band layout so they
    // settle into the bottom band instead of wherever fcose put them when
    // they were hidden. Otherwise a re-scale/reflow is enough — and it is
    // required so node sizes track the new visible count.
    if (!wasPlatformsVisible && nowPlatformsVisible) {
      runLayout(cy, metrics);
    } else {
      applyDynamicScale(cy, metrics);
    }
    recomputeDegreeClasses(cy, graph);
    applyZoomClass(cy);
  }, [filters, stylesheet, graph, metrics]);

  // ---------- react to search focus ----------
  useEffect(() => {
    const cy = cyRef.current;
    const controller = controllerRef.current;
    if (!cy || !controller) return;
    if (!searchFocusId) {
      // Only clear a pin that WE set from search — never stomp a click-pin.
      if (searchPinRef.current) {
        searchPinRef.current = false;
        controller.unpin();
      }
      return;
    }
    const node = cy.getElementById(searchFocusId);
    if (node.empty()) return;
    searchPinRef.current = true;
    controller.pin(searchFocusId);
    // Search selection should highlight/pin the result only. Do not centre or
    // zoom the viewport here: users reported that the camera move pushes parts
    // of the network outside the visible frame.
    fitToContainer(cy, metrics);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchFocusId, graph, metrics]);

  // ---------- react to external highlight (e.g. drawer selection) ----------
  // When a node is selected from the detail drawer, we pin+highlight it in
  // the graph — the same visual as clicking the node directly. We only act
  // when the id actually changes to avoid re-pinning on every render.
  const prevHighlightRef = useRef<string | null>(null);
  useEffect(() => {
    const cy = cyRef.current;
    const controller = controllerRef.current;
    if (!cy || !controller) return;
    if (highlightNodeId && highlightNodeId !== prevHighlightRef.current) {
      const node = cy.getElementById(highlightNodeId);
      if (node.nonempty()) {
        controller.pin(highlightNodeId);
      }
    }
    prevHighlightRef.current = highlightNodeId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightNodeId, graph]);

  // ---------- imperative handle ----------
  useImperativeHandle(ref, () => ({
    relayout: () => { if (cyRef.current) runLayout(cyRef.current, metrics); },
    fit: () => { if (cyRef.current) fitToContainer(cyRef.current, metrics); },
    resetView: () => {
      const cy = cyRef.current;
      if (!cy) return;
      cy.animate({ zoom: 1, pan: { x: 0, y: 0 } } as any, { duration: 320 });
    },
    getCy: () => cyRef.current
  }));

  return (
    <div
      ref={containerRef}
      className="cy-host"
      role="application"
      aria-label="Network graph. Use arrow keys to move between nodes, Enter to open details, Escape to clear. Use the Accessible View for an equivalent textual listing."
    />
  );
});

// ---------- container measurement ----------

function computeMetrics(width: number, height: number, graph: GraphModel): ContainerMetrics {
  const aspect = width / height;
  const padding = 60;
  const innerW = Math.max(width - padding * 2, 200);
  const innerH = Math.max(height - padding * 2, 200);

  const verticals = graph.nodes.filter(n => n.type === 'vertical');
  const platforms = graph.nodes.filter(n => n.type === 'platform');

  const distributeAxis = (count: number, axisLen: number): number[] => {
    if (count === 0) return [];
    if (count === 1) return [axisLen / 2];
    const step = axisLen / (count + 1);
    return Array.from({ length: count }, (_, i) => step * (i + 1));
  };

  const wide = aspect >= 1;
  const vAnchors: { id: string; pos: { x: number; y: number } }[] = [];
  const pAnchors: { id: string; pos: { x: number; y: number } }[] = [];

  if (wide) {
    const vx = distributeAxis(verticals.length, innerW);
    verticals.forEach((n, i) => {
      vAnchors.push({ id: n.id, pos: { x: padding + vx[i], y: padding + innerH * 0.18 } });
    });
    const px = distributeAxis(platforms.length, innerW);
    platforms.forEach((n, i) => {
      pAnchors.push({ id: n.id, pos: { x: padding + px[i], y: padding + innerH - innerH * 0.18 } });
    });
  } else {
    // Tall container: bands become vertical columns.
    const vy = distributeAxis(verticals.length, innerH);
    verticals.forEach((n, i) => {
      vAnchors.push({ id: n.id, pos: { x: padding + innerW * 0.18, y: padding + vy[i] } });
    });
    const py = distributeAxis(platforms.length, innerH);
    platforms.forEach((n, i) => {
      pAnchors.push({ id: n.id, pos: { x: padding + innerW * 0.82, y: padding + py[i] } });
    });
  }

  return { width, height, aspect, verticalAnchors: vAnchors, platformAnchors: pAnchors };
}

// ---------- elements ----------

function buildElements(graph: GraphModel): () => cytoscape.ElementDefinition[] {
  return () => {
    const nodes: cytoscape.ElementDefinition[] = graph.nodes.map(n => ({
      group: 'nodes' as const,
      data: {
        id: n.id,
        label: n.label,
        type: n.type,
        category: n.category ?? '',
        degree: n.degree
      },
      classes: `${n.type} sector-${slug(n.category)}`
    }));
    const edges: cytoscape.ElementDefinition[] = graph.edges.map(e => ({
      group: 'edges' as const,
      data: {
        id: e.id,
        source: e.source,
        target: e.target,
        kind: e.type,
        weight: e.weight,
        projects: e.projects.join('; '),
        projectCount: e.projectCount
      },
      classes: `${e.type} sector-${slug(e.sector)}`
    }));
    return [...nodes, ...edges];
  };
}

// ---------- stylesheet ----------

// Inline-label design for verticals/platforms: the label renders INSIDE the
// shape (centered, wrapped up to 2 lines) instead of as an external caption.
// The font used for that inline text (model px). Kept in one place so the
// measurement pass and the stylesheet agree.
const INLINE_LABEL_FONT = 24;

// A hexagon (Cytoscape `hexagon`: points at top & bottom, flat left/right) is
// only full-width across its vertical middle. Constrain wrapped text to that
// central band and keep generous horizontal padding so text never touches the
// angled edges.
const HEX_BAND_FRACTION = 0.42;     // full-width height band of the hexagon
const HEX_USABLE_WIDTH = 0.60;      // horizontal usable fraction (taper safety)
const HEX_PADDING = 18;

// A rounded rectangle is nearly full-width top-to-bottom; text can use most of
// the interior with modest padding.
const RECT_BAND_FRACTION = 0.68;
const RECT_USABLE_WIDTH = 0.84;
const RECT_PADDING = 16;

export interface InlineShapeSizes {
  vertical: InlineLabelSize;
  platform: InlineLabelSize;
}

// Cache the standardized sizes per graph instance so the (cheap but non-trivial)
// measurement pass runs once per dataset rather than on every scale/reflow.
const inlineSizeCache = new WeakMap<GraphModel, InlineShapeSizes>();

/** Canvas-2d text measurer shared across calls. */
let _measureCanvas: HTMLCanvasElement | null = null;
function measureTextWidth(text: string, fontSize: number): number {
  if (typeof document === 'undefined') {
    // SSR/test fallback: rough average glyph width.
    return text.length * fontSize * 0.55;
  }
  if (!_measureCanvas) _measureCanvas = document.createElement('canvas');
  const ctx = _measureCanvas.getContext('2d');
  if (!ctx) return text.length * fontSize * 0.55;
  // Match the inline-label stylesheet (`font-weight: 600`) exactly; otherwise
  // the worst-case label is under-measured and can wrap to 3 lines in pixels.
  ctx.font = `600 ${fontSize}px Inter, sans-serif`;
  return ctx.measureText(text).width;
}

/**
 * Compute (once per graph) the standardized inline-label shape size for each of
 * verticals and platforms. All verticals get one size; all platforms get one
 * size (they may differ). Sized to the worst-case longest label on <= 2 lines.
 */
function computeInlineShapeSizes(graph: GraphModel): InlineShapeSizes {
  const cached = inlineSizeCache.get(graph);
  if (cached) return cached;

  const verticalLabels = graph.nodes.filter(n => n.type === 'vertical').map(n => n.label);
  const platformLabels = graph.nodes.filter(n => n.type === 'platform').map(n => n.label);

  const vertical = computeStandardizedShapeSize({
    labels: verticalLabels,
    fontSize: INLINE_LABEL_FONT,
    maxLines: 2,
    measure: measureTextWidth,
    widthBandFraction: HEX_BAND_FRACTION,
    usableWidthFraction: HEX_USABLE_WIDTH,
    padding: HEX_PADDING,
    minWidth: 90,
    maxWidth: 360,
    minHeight: 92,
    maxHeight: 300
  });

  const platform = computeStandardizedShapeSize({
    labels: platformLabels,
    fontSize: INLINE_LABEL_FONT,
    maxLines: 2,
    measure: measureTextWidth,
    widthBandFraction: RECT_BAND_FRACTION,
    usableWidthFraction: RECT_USABLE_WIDTH,
    padding: RECT_PADDING,
    minWidth: 96,
    maxWidth: 380,
    minHeight: 64,
    maxHeight: 200
  });

  const sizes = { vertical, platform };
  inlineSizeCache.set(graph, sizes);
  return sizes;
}

/** Fallback inline size used before the graph model is available on the cy. */
function fallbackInlineSize(): InlineLabelSize {
  return { width: 120, height: 88, textMaxWidth: 96 };
}

function boundedNetworkScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  // Display range is 60%..150% (App.tsx), multiplied by the 1.25 model base,
  // so the model-space envelope is [0.75, 1.875].
  return Math.max(0.75, Math.min(1.875, scale));
}

function roundStylePx(v: number): number {
  return Math.round(v * 10) / 10;
}

function scaleInlineSize(size: InlineLabelSize, scale: number): InlineLabelSize {
  return {
    width: roundStylePx(size.width * scale),
    height: roundStylePx(size.height * scale),
    textMaxWidth: roundStylePx(size.textMaxWidth * scale)
  };
}

/** Darken a #rrggbb hex toward black by fraction f in [0,1]. */
function darkenHex(hex: string, f: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.round(((n >> 16) & 0xff) * (1 - f));
  const g = Math.round(((n >> 8) & 0xff) * (1 - f));
  const b = Math.round((n & 0xff) * (1 - f));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function flatTheme(theme: ThemeMode) {
  if (theme === 'light') {
    return {
      background: '#f8fafc',
      label: '#0f172a',
      // Coloured faculty circles: a saturated blue reads clearly on the light
      // canvas (the old #ffffff fill was invisible against #f8fafc).
      facultyFill: '#3b82f6',
      facultyBorder: '#1d4ed8',
      // Relationship lines: the previous tuning (very dark saturated colours +
      // 0.9 opacity + 4x width) read as "too hard" on white. Soften to warmer,
      // mid-saturation colours at moderate opacity/width so they stay legible
      // without dominating the canvas.
      edge: '#64748b',
      collabEdge: '#d97706',
      platformEdge: '#0891b2',
      verticalEdge: '#8b5cf6',
      edgeOpacity: 0.6,
      affiliationOpacity: 0.45,
      edgeWidthBoost: 3
    };
  }
  return {
    background: '#0b0d10',
    label: '#f4ede0',
    facultyFill: '#f4ede0',
    facultyBorder: '#d6cdb8',
    // Relationship lines: restored to the original delicate dark-mode look —
    // amber collab strokes with quiet dashed/dotted affiliation lines in muted
    // sector tints. User preferred this over the strengthened pass.
    edge: '#5a6473',
    collabEdge: '#f0b860',
    platformEdge: '#5fb8d1',
    verticalEdge: '#b58cd6',
    edgeOpacity: 0.55,
    affiliationOpacity: 0.35,
    edgeWidthBoost: 1
  };
}

function buildStylesheet(
  graph: GraphModel,
  _filters: GraphFilters,
  themeMode: ThemeMode,
  networkScale: number
): () => cytoscape.StylesheetStyle[] {
  return () => {
    const { vertical: verticalSize, platform: platformSize } = computeInlineShapeSizes(graph);
    const theme = flatTheme(themeMode);
    const scale = boundedNetworkScale(networkScale);
    const sc = (v: number) => roundStylePx(v * scale);
    // Edge widths also get a per-theme boost so relationship lines read on the
    // light canvas without changing the dark-mode look (boost === 1 in dark).
    const scEdge = (v: number) => roundStylePx(v * scale * theme.edgeWidthBoost);

    // Sector fills are bright pastels; inline labels sit ON those fills, so use
    // the palette's dark text color for contrast (faculty have no sector class,
    // so they keep the external-label treatment untouched).
    const sectorStyles = graph.sectors.map<{ selector: string; style: cytoscape.Css.Node }>(s => {
      const c = sectorColor(s, graph.sectors);
      return {
        selector: `node.sector-${slug(s)}`,
        style: {
          'background-color': c.fill,
          'border-color': c.border,
          'border-width': 2,
          'color': c.text
        }
      };
    });

    const baseNodeStyle: cytoscape.Css.Node = {
      'label': 'data(label)',
      'color': theme.label,
      'font-family': 'Inter, sans-serif',
      'font-size': sc(22),
      'font-weight': 500,
      'text-valign': 'bottom',
      'text-halign': 'center',
      'text-margin-y': 8,
      'text-outline-color': theme.background,
      'text-outline-width': 3,
      // The graph auto-fits to a low zoom (~0.4), so model font sizes are scaled
      // down heavily on screen. A cull threshold of 10 hid every label at rest
      // (a 17px model font rendered at ~6.8px < 10 and was dropped). Lower the
      // threshold so the enlarged labels actually render at the fit zoom.
      'min-zoomed-font-size': 5,
      'text-events': 'yes'
    };

    return [
      // ---------- base nodes ----------
      {
        selector: 'node',
        style: {
          ...baseNodeStyle,
          'width': sc(44),
          'height': sc(44),
          'background-color': theme.facultyFill,
          'border-color': theme.facultyBorder,
          'border-width': 1
        } as cytoscape.Css.Node
      },

      // ---------- faculty ----------
      {
        selector: 'node.faculty',
        style: {
          'shape': 'ellipse',
          'background-color': theme.facultyFill,
          'border-color': theme.facultyBorder,
          'border-width': 2,
          'width': `mapData(degree, 0, 14, ${sc(70)}, ${sc(130)})`,
          'height': `mapData(degree, 0, 14, ${sc(70)}, ${sc(130)})`
        } as cytoscape.Css.Node
      },

      // ---------- hubs (top quartile) ----------
      {
        selector: 'node.faculty.hub',
        style: {
          'border-width': 3,
          'border-color': '#ffd166',
          'opacity': 1,
          'text-opacity': 1,
          'font-size': sc(27),
          'font-weight': 600,
          'z-index': 100
        } as cytoscape.Css.Node
      },

      // ---------- peripheral faculty: smaller + dimmer, label hidden by default ----------
      {
        selector: 'node.faculty.peripheral',
        style: {
          'opacity': 0.55,
          'text-opacity': 0,
          'font-size': sc(21),
          'z-index': 1
        } as cytoscape.Css.Node
      },

      // Progressive label disclosure: when zoomed in or hovered, reveal peripheral labels.
      {
        selector: 'node.faculty.peripheral.reveal-labels',
        style: {
          'text-opacity': 0.85,
          'opacity': 0.85
        } as cytoscape.Css.Node
      },

      // ---------- platform (rounded square, inline label) ----------
      // Label renders INSIDE the shape: centered H+V, wrapped to <= 2 lines.
      // No external caption. Standardized size (all platforms identical) is
      // applied by the dynamic-scale pass; the width/height here are a sane
      // fallback used before the first scale.
      {
        selector: 'node.platform',
        style: {
          'shape': 'round-rectangle',
          'background-color': '#5fb8d1',
          'border-color': '#a8e0ee',
          'border-width': 2,
          'width': sc(platformSize.width),
          'height': sc(platformSize.height),
          'font-size': sc(INLINE_LABEL_FONT),
          'font-weight': 600,
          'opacity': 1,
          'text-opacity': 1,
          // Slightly dim the bright pastel fill so the enlarged anchors read as
          // structural "stage" and don't compete with the bright faculty hubs.
          'background-blacken': 0.24,
          'text-valign': 'center',
          'text-halign': 'center',
          'text-margin-y': 0,
          'text-wrap': 'wrap',
          'text-max-width': `${sc(platformSize.textMaxWidth)}px`,
          'text-outline-width': 0,
          'z-index': 50
        } as cytoscape.Css.Node
      },

      // ---------- vertical (hexagon, inline label) ----------
      // Label renders INSIDE the hexagon: centered H+V, wrapped to <= 2 lines,
      // constrained to the widest central band so text never crosses the angled
      // top/bottom edges (generous internal padding baked into the size math).
      {
        selector: 'node.vertical',
        style: {
          'shape': 'hexagon',
          'background-color': '#b58cd6',
          'border-color': '#d3b6ec',
          'border-width': 2,
          'width': sc(verticalSize.width),
          'height': sc(verticalSize.height),
          'font-size': sc(INLINE_LABEL_FONT),
          'font-weight': 600,
          'opacity': 1,
          'text-opacity': 1,
          // Match the platform dimming so the anchor ring reads as a quiet stage.
          'background-blacken': 0.24,
          'text-valign': 'center',
          'text-halign': 'center',
          'text-margin-y': 0,
          'text-wrap': 'wrap',
          'text-max-width': `${sc(verticalSize.textMaxWidth)}px`,
          'text-outline-width': 0,
          'z-index': 60
        } as cytoscape.Css.Node
      },

      // Sector overlays
      ...sectorStyles,

      // ---------- dim state ----------
      {
        selector: 'node.dim, edge.dim',
        style: {
          'opacity': 0.12,
          'text-opacity': 0.12,
          'events': 'no'
        } as cytoscape.Css.Node & cytoscape.Css.Edge
      },

      // ---------- focused ----------
      {
        selector: 'node.focused',
        style: {
          'border-color': '#ffd166',
          'border-width': 4,
          'z-index': 999
        } as cytoscape.Css.Node
      },

      // ---------- edges ----------
      {
        selector: 'edge',
        style: {
          'curve-style': 'bezier',
          'width': scEdge(1.4),
          'opacity': theme.edgeOpacity,
          'line-color': theme.edge,
          'target-arrow-color': theme.edge,
          'arrow-scale': 0.8
        } as cytoscape.Css.Edge
      },

      // Affiliation edges — quieter at rest. Solid in light mode (dashed/dotted
      // at thin widths reads as "barely visible" on white).
      {
        selector: 'edge.faculty-platform',
        style: {
          'curve-style': 'bezier',
          'line-style': themeMode === 'light' ? 'solid' : 'dashed',
          'line-dash-pattern': [4, 4],
          'width': scEdge(1.2),
          'opacity': theme.affiliationOpacity,
          'line-color': theme.platformEdge
        } as cytoscape.Css.Edge
      },
      {
        selector: 'edge.faculty-vertical',
        style: {
          'curve-style': 'bezier',
          'line-style': themeMode === 'light' ? 'solid' : 'dotted',
          'width': scEdge(1.4),
          'opacity': Math.min(1, theme.affiliationOpacity + 0.06),
          'line-color': theme.verticalEdge
        } as cytoscape.Css.Edge
      },

      // Collaboration edges — the primary story at rest.
      {
        selector: 'edge.faculty-faculty',
        style: {
          'curve-style': 'unbundled-bezier',
          'control-point-step-size': 50,
          'line-color': theme.collabEdge,
          'width': `mapData(weight, 1, 4, ${scEdge(1.6)}, ${scEdge(3.4)})`,
          'opacity': Math.min(1, theme.edgeOpacity + 0.3),
          'z-index': 10
        } as cytoscape.Css.Edge
      },

      // Sector tints for affiliation edges. Light mode darkens the pale
      // pastel `fill` a touch for contrast; dark mode keeps the original
      // bright fills (matching the original delicate dark-mode look).
      ...graph.sectors.map(s => {
        const c = sectorColor(s, graph.sectors);
        return {
          selector: `edge.sector-${slug(s)}`,
          style: {
            'line-color': themeMode === 'light' ? darkenHex(c.fill, 0.15) : c.fill
          } as cytoscape.Css.Edge
        };
      })
    ];
  };
}

// ---------- degree class assignment ----------

/**
 * Top 5 by degree centrality are "hubs"; the rest are "peripheral". The hard
 * cap (rather than top quartile) avoids the case where degree ties inflate
 * the hub group to half the network — which would defeat the hierarchy.
 */
function recomputeDegreeClasses(cy: cytoscape.Core, graph: GraphModel) {
  const faculty = graph.nodes.filter(n => n.type === 'faculty');
  if (faculty.length === 0) return;
  const sorted = [...faculty].sort((a, b) => b.degree - a.degree);
  const hubCount = Math.min(5, sorted.length);
  const hubIds = new Set(sorted.slice(0, hubCount).map(n => n.id));
  cy.batch(() => {
    cy.nodes('.faculty').forEach(n => {
      n.removeClass('hub peripheral');
      if (hubIds.has(n.id())) n.addClass('hub');
      else n.addClass('peripheral');
    });
  });
}

/**
 * Progressive label disclosure — peripheral faculty reveal their labels only
 * after the user explicitly zooms in past a threshold (e.g. mouse wheel past
 * zoom 1.4). Auto-fit zoom does NOT trigger reveal: at the initial framing,
 * the canvas is already at "fit to viewport" which can be high, but we want
 * peripheral nodes to stay quiet so hubs anchor the visual hierarchy.
 *
 * Implementation: maintain a `userZoomed` flag flipped to true by wheel/pinch
 * events. `applyZoomClass` only reveals labels when userZoomed && zoom >= 1.4.
 */
let userZoomed = false;

function markUserZoomed() { userZoomed = true; }

function applyZoomClass(cy: cytoscape.Core) {
  const z = cy.zoom();
  const reveal = userZoomed && z >= 1.4;
  cy.batch(() => {
    cy.nodes('.peripheral').forEach(n => {
      if (reveal) n.addClass('reveal-labels');
      else n.removeClass('reveal-labels');
    });
  });
}

/** Reset to initial-state label policy (e.g. on relayout). */
function resetLabelDisclosure() { userZoomed = false; }

// ---------- visibility ----------

function applyVisibility(cy: cytoscape.Core, graph: GraphModel, filters: GraphFilters) {
  cy.batch(() => {
    cy.elements().style('display', 'none');
    const visibleNodes: string[] = [];
    const visibleEdges: string[] = [];

    for (const n of graph.nodes) {
      if (n.type === 'platform' && !filters.showPlatforms) continue;
      if (n.type === 'vertical' && !filters.showVerticals) continue;
      if (filters.activeSectors.size > 0) {
        if (n.category && !filters.activeSectors.has(n.category)) continue;
        // Faculty inherit sector visibility from their platform/vertical links;
        // unrelated faculty must leave the visible set so the fit-and-scale
        // pass uses the true visible count and ego masks don't include hidden
        // sector context.
        if (!n.category && !hasActiveFacultySector(graph, n.id, filters)) continue;
      }
      visibleNodes.push(n.id);
    }
    cy.nodes().filter(n => visibleNodes.includes(n.id())).style('display', 'element');

    for (const e of graph.edges) {
      if (e.type === 'faculty-faculty' && !filters.showCollaborations) continue;
      if (e.type === 'faculty-platform' && !filters.showPlatforms) continue;
      if (e.type === 'faculty-vertical' && !filters.showVerticals) continue;
      if (!filters.showRelationships) continue;
      if (filters.activeSectors.size > 0) {
        const srcSector = graph.nodes.find(n => n.id === e.source)?.category;
        const tgtSector = graph.nodes.find(n => n.id === e.target)?.category;
        const matches = (srcSector && filters.activeSectors.has(srcSector)) ||
                        (tgtSector && filters.activeSectors.has(tgtSector)) ||
                        (e.type === 'faculty-faculty' && (hasActiveFacultySector(graph, e.source, filters) || hasActiveFacultySector(graph, e.target, filters)));
        if (!matches) continue;
      }
      const srcVisible = visibleNodes.includes(e.source);
      const tgtVisible = visibleNodes.includes(e.target);
      if (!srcVisible || !tgtVisible) continue;
      visibleEdges.push(e.id);
    }
    cy.edges().filter(e => visibleEdges.includes(e.id())).style('display', 'element');
  });
}

function hasActiveFacultySector(graph: GraphModel, facultyId: string, filters: GraphFilters): boolean {
  for (const e of graph.edges) {
    if (e.source === facultyId) {
      const t = graph.nodes.find(n => n.id === e.target);
      if (t?.category && filters.activeSectors.has(t.category)) return true;
    } else if (e.target === facultyId) {
      const s = graph.nodes.find(n => n.id === e.source);
      if (s?.category && filters.activeSectors.has(s.category)) return true;
    }
  }
  return false;
}

// ---------- highlight (hover / focus / pin) ----------
//
// Driven by the shared HighlightController. The controller emits a normalized
// {nodeId, intensity, pinned} state on every animation frame; we map that onto
// Cytoscape inline styles here so the eased dwell-then-fade and fade-cancel
// behavior is animated by the controller (not Cytoscape's own animator), and is
// identical to the Globe view which uses the same controller.

const DIM_OPACITY = 0.14;          // "low but non-zero" for dimmed context
const PRIMARY_SCALE = 1.18;        // hovered node grows to full emphasis
const NEIGHBOR_SCALE = 1.06;       // neighbors grow subtly (secondary tier)
const EGO_EDGE_OPACITY = 0.95;
const NEIGHBOR_OPACITY = 0.92;

interface BaseSize { w: number; h: number; }

/** Authoritative (unhovered) size for a node — set by the dynamic-scale pass. */
function nodeBase(n: cytoscape.NodeSingular): BaseSize {
  const s = n.scratch('_dl') as BaseSize | undefined;
  if (s && s.w > 0 && s.h > 0) return s;
  return { w: n.width(), h: n.height() };
}

function restNodeOpacity(n: cytoscape.NodeSingular): number {
  return n.hasClass('peripheral') ? 0.55 : 1;
}
function restNodeTextOpacity(n: cytoscape.NodeSingular): number {
  if (n.hasClass('peripheral')) return n.hasClass('reveal-labels') ? 0.85 : 0;
  return 1;
}
function restEdgeOpacity(e: cytoscape.EdgeSingular): number {
  if (e.hasClass('faculty-faculty')) return 0.85;
  if (e.hasClass('faculty-vertical')) return 0.38;
  if (e.hasClass('faculty-platform')) return 0.32;
  return 0.55;
}

/**
 * Rest (unhighlighted) edge width. Cached in a scratch the first time we see the
 * edge so the per-frame highlight ramp scales from a stable base rather than
 * compounding on the already-scaled width of the previous frame.
 */
function restEdgeWidth(e: cytoscape.EdgeSingular): number {
  const cached = e.scratch('_bw') as number | undefined;
  if (typeof cached === 'number' && cached > 0) return cached;
  const scale = boundedNetworkScale(Number(e.cy().scratch('_networkScale')) || 1);
  // Derive from the resting stylesheet: faculty-faculty maps weight→width,
  // affiliations are fixed. Fall back to the current style read once.
  let w: number;
  if (e.hasClass('faculty-faculty')) {
    const weight = Number(e.data('weight')) || 1;
    const t = Math.min(Math.max(weight, 1), 4);
    w = (1.6 + ((t - 1) / 3) * (3.4 - 1.6)) * scale;
  } else if (e.hasClass('faculty-vertical')) {
    w = 1.4 * scale;
  } else if (e.hasClass('faculty-platform')) {
    w = 1.2 * scale;
  } else {
    w = parseFloat(String(e.style('width'))) || 1.4;
  }
  e.scratch('_bw', w);
  return w;
}

/** The set of currently-visible node/edge ids, for masking the ego network so
 *  hidden neighbors (filtered out) are never emphasized. */
function getVisibleMask(cy: cytoscape.Core): { nodes: Set<string>; edges: Set<string> } {
  const nodes = new Set<string>();
  const edges = new Set<string>();
  cy.nodes().forEach(n => {
    if (n.id().startsWith('__anchor__')) return;
    if (n.style('display') !== 'none') nodes.add(n.id());
  });
  cy.edges().forEach(e => {
    if (e.style('display') !== 'none') edges.add(e.id());
  });
  return { nodes, edges };
}

/**
 * Apply the ego-network highlight at the given master intensity (0..1). For a
 * faculty node this lights up connected verticals, platforms AND collaborating
 * faculty simultaneously (cross-type), because computeEgoNetwork walks every
 * edge type at once. Everything outside the ego network dims to a low but
 * non-zero opacity so spatial context is retained.
 */
function applyHighlight(
  cy: cytoscape.Core,
  graph: GraphModel,
  state: HighlightState,
  mask: { nodes: Set<string>; edges: Set<string> }
) {
  const nodeId = state.nodeId;
  if (!nodeId) return;
  const k = Math.max(0, Math.min(1, state.intensity));
  const ego = computeEgoNetwork(graph, nodeId, mask);
  const neighborIds = ego.neighborIds;
  const egoEdgeIds = ego.edgeIds;

  cy.batch(() => {
    cy.nodes().forEach(n => {
      if (n.id().startsWith('__anchor__') || n.style('display') === 'none') return;
      const id = n.id();
      const base = nodeBase(n);
      const isPrimary = id === nodeId;
      const isNeighbor = neighborIds.has(id);

      if (isPrimary || isNeighbor) {
        const scaleTarget = isPrimary ? PRIMARY_SCALE : NEIGHBOR_SCALE;
        const scale = 1 + (scaleTarget - 1) * k;
        const opTarget = isPrimary ? 1 : NEIGHBOR_OPACITY;
        const restOp = restNodeOpacity(n);
        const restTx = restNodeTextOpacity(n);
        n.style({
          'width': base.w * scale,
          'height': base.h * scale,
          'opacity': restOp + (opTarget - restOp) * k,
          // Labels for the hovered node and its neighbors become visible even if
          // normally hidden at rest.
          'text-opacity': restTx + (1 - restTx) * k,
          'z-index': isPrimary ? 9999 : 500,
          'border-width': (isPrimary ? 4 : 3),
          ...(isPrimary ? { 'border-color': '#ffd166' } : {})
        } as cytoscape.Css.Node);
      } else {
        const restOp = restNodeOpacity(n);
        const restTx = restNodeTextOpacity(n);
        n.style({
          'width': base.w,
          'height': base.h,
          'opacity': restOp + (Math.min(restOp, DIM_OPACITY) - restOp) * k,
          'text-opacity': restTx + (Math.min(restTx, DIM_OPACITY) - restTx) * k,
          'z-index': 1
        } as cytoscape.Css.Node);
      }
    });

    cy.edges().forEach(e => {
      if (e.style('display') === 'none') return;
      const restOp = restEdgeOpacity(e);
      if (egoEdgeIds.has(e.id())) {
        const restW = restEdgeWidth(e);
        e.style({
          'opacity': restOp + (EGO_EDGE_OPACITY - restOp) * k,
          'width': restW * (1 + 0.9 * k),
          'z-index': 400
        } as cytoscape.Css.Edge);
      } else {
        e.style({
          'opacity': restOp + (Math.min(restOp, DIM_OPACITY) - restOp) * k,
          'z-index': 1
        } as cytoscape.Css.Edge);
      }
    });
  });
}

/** Return all elements to their rest visuals, preserving dynamic-scale sizes. */
function clearHighlight(cy: cytoscape.Core) {
  cy.batch(() => {
    cy.nodes().forEach(n => {
      if (n.id().startsWith('__anchor__')) return;
      const base = nodeBase(n);
      n.style({ 'width': base.w, 'height': base.h } as cytoscape.Css.Node);
      n.removeStyle('opacity text-opacity z-index border-width border-color');
    });
    cy.edges().forEach(e => {
      e.removeStyle('opacity width z-index line-color');
    });
  });
}

// ---------- dynamic space-aware sizing (Part A) ----------

/**
 * Fit-and-scale pass. Runs after the force layout settles and whenever the
 * visible node count changes (layer toggle, sector filter, search, resize).
 *
 * 1. Verticals/platforms take their STANDARDIZED inline-label size (one size per
 *    type, computed once from the longest label) — they are fixed structural
 *    anchors, not sized per-node.
 * 2. Faculty base diameter is derived from availableCanvasArea / FACULTY count
 *    (not total count), so freeing the external-label space lets faculty grow to
 *    fill it. Degree-centrality multiplier stacks on top for hubs.
 * 3. Resolve label collisions by nudging conflicting nodes apart.
 * 4. Zoom/pan so the full labelled bounding box fills the container.
 */
function applyDynamicScale(cy: cytoscape.Core, metrics: ContainerMetrics | null) {
  if (!metrics || metrics.width === 0) {
    fitToContainer(cy, metrics);
    return;
  }
  const visible = cy.nodes().filter(n =>
    !n.id().startsWith('__anchor__') && n.style('display') !== 'none'
  );
  const count = visible.length;
  if (count === 0) {
    fitToContainer(cy, metrics);
    return;
  }

  // Container bounds minus the required 40-60px padding. Use the lower end of
  // that range here because live pixels showed the Flat view had room to grow.
  const padding = 42;
  const availW = Math.max(metrics.width - padding * 2, 120);
  const availH = Math.max(metrics.height - padding * 2, 120);
  const availableArea = availW * availH;

  // Standardized inline-label sizes for verticals/platforms (fixed per type).
  // The graph model is stashed on a cy scratch when elements are (re)built.
  const graphModel = cy.scratch('_graph') as GraphModel | undefined;
  const inlineBase = graphModel
    ? computeInlineShapeSizes(graphModel)
    : { vertical: fallbackInlineSize(), platform: fallbackInlineSize() };
  const networkScale = boundedNetworkScale(Number(cy.scratch('_networkScale')) || 1);
  const inline = {
    vertical: scaleInlineSize(inlineBase.vertical, networkScale),
    platform: scaleInlineSize(inlineBase.platform, networkScale)
  };

  // Faculty grow into the space freed by inlining vertical/platform labels:
  // budget the faculty base against the FACULTY count, but reserve the area the
  // fixed vertical/platform footprints consume so faculty don't overrun them.
  const visibleFacultyCount = visible.filter(n => n.data('type') === 'faculty').length;
  const visibleVerticals = visible.filter(n => n.data('type') === 'vertical').length;
  const visiblePlatforms = visible.filter(n => n.data('type') === 'platform').length;
  const anchorArea =
    visibleVerticals * inline.vertical.width * inline.vertical.height +
    visiblePlatforms * inline.platform.width * inline.platform.height;
  const facultyArea = Math.max(availableArea - anchorArea, availableArea * 0.4);

  const base = computeBaseDiameter({
    availableArea: facultyArea,
    visibleNodeCount: Math.max(visibleFacultyCount, 1),
    minDiameter: 18,
    maxDiameter: 92,
    fillFactor: 0.72
  });
  const scaledPositions = scalePositionsToFitVisibleBounds(cy, metrics, visible);

  cy.batch(() => {
    if (scaledPositions) {
      visible.forEach(n => {
        const p = scaledPositions.get(n.id());
        if (p) n.position(p);
      });
    }

    visible.forEach(n => {
      const type = n.data('type') as string;
      if (type === 'vertical') {
        // Fixed standardized size; label is inline so no external footprint.
        const w = inline.vertical.width;
        const h = inline.vertical.height;
        n.style({ 'width': w, 'height': h } as cytoscape.Css.Node);
        n.scratch('_dl', { w, h } as BaseSize);
        return;
      }
      if (type === 'platform') {
        const w = inline.platform.width;
        const h = inline.platform.height;
        n.style({ 'width': w, 'height': h } as cytoscape.Css.Node);
        n.scratch('_dl', { w, h } as BaseSize);
        return;
      }
      // Faculty: circle sized by area budget × degree centrality.
      const degree = Number(n.data('degree')) || 0;
      const d = base * degreeMultiplier(degree) * networkScale;
      const w = d;
      const h = d;
      n.style({ 'width': w, 'height': h } as cytoscape.Css.Node);
      n.scratch('_dl', { w, h } as BaseSize);
    });
  });

  resolveFacultyCircleOverlaps(cy);
  resolveLabelCollisions(cy);
  // Label nudging can move faculty nodes after the first body pass; run one
  // final circle-only separation so the visible faculty circles remain clear.
  resolveFacultyCircleOverlaps(cy);
  containVisibleGraph(cy, metrics);
  fitToContainer(cy, metrics);
}

/**
 * Separate faculty circle bodies after dynamic sizing. This is deliberately
 * restricted to faculty nodes: the goal is to remove circle-on-circle collisions
 * in the dense central band without forcing platforms/verticals into a rigid
 * grid or sacrificing the network's organic topology.
 */
function resolveFacultyCircleOverlaps(cy: cytoscape.Core) {
  const faculty = cy.nodes('.faculty').filter(n =>
    n.style('display') !== 'none' && !n.id().startsWith('__anchor__')
  );
  if (faculty.length < 2) return;

  const TARGET_GAP = 22;
  const MAX_ITERS = 48;
  for (let iter = 0; iter < MAX_ITERS; iter++) {
    const nodes = faculty.map((node: cytoscape.NodeSingular) => ({
      node,
      pos: { ...node.position() },
      r: Math.max(Number(node.width()) || 0, Number(node.height()) || 0) / 2
    }));
    let moved = false;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.pos.x - a.pos.x;
        let dy = b.pos.y - a.pos.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.001) {
          const angle = ((i * 97 + j * 53) % 360) * Math.PI / 180;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          dist = 1;
        }
        const desired = a.r + b.r + TARGET_GAP;
        if (dist >= desired) continue;

        const push = (desired - dist) / 2;
        const ux = dx / dist;
        const uy = dy / dist;
        a.pos.x -= ux * push;
        a.pos.y -= uy * push;
        b.pos.x += ux * push;
        b.pos.y += uy * push;
        moved = true;
      }
    }

    if (!moved) break;
    cy.batch(() => {
      nodes.forEach(n => n.node.position(n.pos));
    });
  }
}

/**
 * Lightweight label-collision resolution. Detects overlapping label bounding
 * boxes among currently-visible nodes and nudges conflicting node positions
 * apart by the minimum distance needed to clear the overlap — no full relayout.
 * A few bounded iterations converge quickly for this graph size (~50-70 nodes).
 */
function scalePositionsToFitVisibleBounds(
  _cy: cytoscape.Core,
  metrics: ContainerMetrics,
  visible: cytoscape.CollectionReturnValue
): Map<string, { x: number; y: number }> | null {
  if (visible.length < 2) return null;

  const padding = 42;
  const availW = Math.max(metrics.width - padding * 2, 120);
  const availH = Math.max(metrics.height - padding * 2, 120);
  const bb = visible.boundingBox({ includeLabels: true, includeOverlays: false });
  if (!isFinite(bb.w) || !isFinite(bb.h) || bb.w <= 0 || bb.h <= 0) return null;

  const fitScale = Math.min(availW / bb.w, availH / bb.h);
  if (!isFinite(fitScale) || fitScale <= 1) return null;

  // Stop scaling before the closest visible pair gets cramped below a safe
  // threshold. This keeps the second pass from turning a compact force layout
  // into a visually-colliding blow-up on tiny rectangles.
  let minPairDistance = Infinity;
  const positions = visible.map((n: cytoscape.NodeSingular) => n.position());
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const dx = positions[i].x - positions[j].x;
      const dy = positions[i].y - positions[j].y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0 && d < minPairDistance) minPairDistance = d;
    }
  }
  const safeSpacing = 48;
  const spacingScale = isFinite(minPairDistance) && minPairDistance > 0
    ? Math.max(1, minPairDistance / safeSpacing)
    : fitScale;
  const scale = Math.min(fitScale, spacingScale);
  if (scale <= 1.01) return null;

  const cx = bb.x1 + bb.w / 2;
  const cy = bb.y1 + bb.h / 2;
  const targetCx = metrics.width / 2;
  const targetCy = metrics.height / 2;
  const out = new Map<string, { x: number; y: number }>();
  visible.forEach(n => {
    const p = n.position();
    out.set(n.id(), {
      x: targetCx + (p.x - cx) * scale,
      y: targetCy + (p.y - cy) * scale
    });
  });
  return out;
}

function containVisibleGraph(cy: cytoscape.Core, metrics: ContainerMetrics) {
  const visible = cy.nodes().filter(n =>
    !n.id().startsWith('__anchor__') && n.style('display') !== 'none'
  );
  if (visible.length === 0) return;
  const padding = 42;
  const bb = visible.boundingBox({ includeLabels: true, includeOverlays: false });
  if (!isFinite(bb.w) || !isFinite(bb.h) || bb.w <= 0 || bb.h <= 0) return;

  let dx = 0;
  let dy = 0;
  if (bb.x1 < padding) dx = padding - bb.x1;
  else if (bb.x2 > metrics.width - padding) dx = metrics.width - padding - bb.x2;
  if (bb.y1 < padding) dy = padding - bb.y1;
  else if (bb.y2 > metrics.height - padding) dy = metrics.height - padding - bb.y2;
  if (dx === 0 && dy === 0) return;

  cy.batch(() => {
    visible.forEach(n => {
      const p = n.position();
      n.position({ x: p.x + dx, y: p.y + dy });
    });
  });
}

function resolveLabelCollisions(cy: cytoscape.Core) {
  const nodes = cy.nodes().filter(n =>
    !n.id().startsWith('__anchor__') && n.style('display') !== 'none'
  );
  const n = nodes.length;
  if (n < 2) return;

  const GAP = 10;
  const MAX_ITERS = 6;
  for (let iter = 0; iter < MAX_ITERS; iter++) {
    // Fresh boxes each pass (positions shift between passes).
    const boxes: { node: cytoscape.NodeSingular; box: Box; pos: { x: number; y: number } }[] =
      nodes.map((node: cytoscape.NodeSingular) => {
        const bb = node.boundingBox({ includeLabels: true, includeOverlays: false });
        return {
          node,
          box: { x1: bb.x1, y1: bb.y1, x2: bb.x2, y2: bb.y2 },
          pos: { ...node.position() }
        };
      });

    let moved = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (!boxesOverlap(a.box, b.box, GAP)) continue;
        const sep = separationVector(a.box, b.box, GAP);
        // Split the correction between the two nodes.
        const hx = sep.dx / 2;
        const hy = sep.dy / 2;
        b.pos.x += hx; b.pos.y += hy;
        a.pos.x -= hx; a.pos.y -= hy;
        moved = true;
      }
    }
    if (!moved) break;
    cy.batch(() => {
      boxes.forEach(b => b.node.position(b.pos));
    });
  }
}

// ---------- layout ----------

/**
 * Aspect-aware fcose layout with band alignment.
 *
 * 1. Run fcose to get the natural relative positions of all nodes based on
 *    edge weights and repulsion. fcose alone doesn't respect a rectangular
 *    canvas — it produces a roughly circular blob that may spill off the
 *    edges.
 *
 * 2. After fcose settles, compute the centroid y-position of each band group
 *    (verticals, faculty, platforms) and translate each group so its centroid
 *    aligns with the target band y. This preserves fcose's organic
 *    relationships inside each band while ensuring the bands actually sit
 *    where we want them: top → middle → bottom in a wide canvas.
 *
 * 3. fitToContainer handles the zoom/pan so the full graph fills the canvas
 *    without scrolling.
 */
function runLayout(cy: cytoscape.Core, metrics: ContainerMetrics | null) {
  if (!metrics) {
    cy.layout({ name: 'fcose', animate: true, animationDuration: 600, fit: true, padding: 40 } as any).run();
    return;
  }

  const fcoseLayout = cy.layout({
    name: 'fcose',
    quality: 'default',
    randomize: true,
    animate: true,
    animationDuration: 600,
    nodeSeparation: 90,
    idealEdgeLength: (edge: any) => {
      const kind = edge.data('kind') as EdgeType;
      if (kind === 'faculty-faculty') return 80;
      if (kind === 'faculty-vertical') return 55;
      return 55;
    },
    nodeRepulsion: () => 7500,
    gravity: 0.22,
    packComponents: false,
    fit: false,
    padding: 30
  } as any);

  fcoseLayout.one('layoutstop', () => {
    alignBands(cy, metrics);
    // Second pass: space-aware fit-and-scale (node sizes + label collision +
    // fill-the-container zoom). This is what makes nodes grow/shrink to use the
    // available canvas rather than just camera-fitting a fixed-size graph.
    applyDynamicScale(cy, metrics);
  });

  fcoseLayout.run();
}

/**
 * Corner / column layout after fcose settles.
 *
 *   WIDE container (aspect >= 1): verticals form a left column, platforms
 *     form a right column, faculty stay in the middle. This frees the
 *     central band for the faculty network to expand as more faculty are
 *     added over time, and keeps verticals/platforms as anchors at the
 *     canvas edges — a logical "themes on the left, infrastructure on the
 *     right" arrangement.
 *
 *   TALL container (aspect < 1): keep the existing top/bottom band layout
 *     so a tall side-by-side laptop view doesn't regress.
 *
 * The wide case uses direct snap-then-distribute (one slot per node along
 * the column). The tall case still uses the Bézier arcs that hug the
 * corners.
 */
function alignBands(cy: cytoscape.Core, metrics: ContainerMetrics) {
  const verticals = cy.nodes('.vertical');
  const platforms = cy.nodes('.platform');
  const faculty = cy.nodes('.faculty');

  if (faculty.length === 0) return;

  // Anchor the arcs to the faculty's actual bounding box in model space.
  // fcose may have spread faculty asymmetrically, so we use the true
  // min/max — not a centred assumption.
  let fMinX = Infinity, fMaxX = -Infinity, fMinY = Infinity, fMaxY = -Infinity;
  faculty.forEach(n => {
    const p = n.position();
    if (p.x < fMinX) fMinX = p.x;
    if (p.x > fMaxX) fMaxX = p.x;
    if (p.y < fMinY) fMinY = p.y;
    if (p.y > fMaxY) fMaxY = p.y;
  });
  if (!isFinite(fMinX) || !isFinite(fMaxX)) return;

  const fxMin = fMinX;
  const fxMax = fMaxX;
  const fyMid = (fMinY + fMaxY) / 2;

  // Arc radius = roughly the distance from the faculty's left/top edges to
  // the top-left corner of the model-space canvas. We use a fraction of
  // the faculty spread so the arc scales with the data, not the viewport.
  //
  // Verticals/platforms now carry their labels INSIDE larger shapes, so push
  // the arcs further out than before (freed external-label space is reallocated
  // to the faculty band in the middle). The push also accounts for the shape's
  // own half-footprint so the bigger anchors clear the faculty cluster instead
  // of overlapping it.
  const spread = Math.max(fxMax - fxMin, fMaxY - fMinY);
  let anchorHalf = 0;
  verticals.forEach(n => { anchorHalf = Math.max(anchorHalf, n.height() / 2, n.width() / 2); });
  platforms.forEach(n => { anchorHalf = Math.max(anchorHalf, n.height() / 2, n.width() / 2); });
  const radius = spread * 1.02 + anchorHalf;

  const wide = metrics.aspect >= 1;

  // Bézier + unit-interval distribute helpers (used by the tall branch).
  const bezier = (t: number, p0x: number, p0y: number, p1x: number, p1y: number, p2x: number, p2y: number) => {
    const u = 1 - t;
    return {
      x: u * u * p0x + 2 * u * t * p1x + t * t * p2x,
      y: u * u * p0y + 2 * u * t * p1y + t * t * p2y
    };
  };
  const distribute = (count: number) => {
    if (count === 0) return [] as number[];
    if (count === 1) return [0.5];
    const step = 1 / (count - 1);
    return Array.from({ length: count }, (_, i) => i * step);
  };

  cy.batch(() => {
    if (wide) {
      // Light curve: verticals trace a gentle concave arc along the left
      // edge, platforms mirror on the right. Bulge is small (15% of the
      // faculty spread) so the centre stays clear for faculty growth —
      // the curve is aesthetic, not architectural.
      const bulge = (fxMax - fxMin) * 0.15;

      // Verticals: top-of-left-edge → bottom-of-left-edge with a small
      // outward bow (control point pulled further left than the endpoints).
      const vT = distribute(verticals.length);
      const vP0x = fxMin - radius, vP0y = fMinY;
      const vP1x = fxMin - radius - bulge, vP1y = (fMinY + fMaxY) / 2;
      const vP2x = fxMin - radius, vP2y = fMaxY;
      verticals.forEach((n, i) => {
        const p = bezier(vT[i], vP0x, vP0y, vP1x, vP1y, vP2x, vP2y);
        n.position(p);
      });

      // Platforms: top-of-right-edge → bottom-of-right-edge with the
      // mirror bow.
      const pT = distribute(platforms.length);
      const pP0x = fxMax + radius, pP0y = fMinY;
      const pP1x = fxMax + radius + bulge, pP1y = (fMinY + fMaxY) / 2;
      const pP2x = fxMax + radius, pP2y = fMaxY;
      platforms.forEach((n, i) => {
        const p = bezier(pT[i], pP0x, pP0y, pP1x, pP1y, pP2x, pP2y);
        n.position(p);
      });
    } else {
      // Tall container: rotate arcs 90° (verticals on left, platforms on right).
      const vT = distribute(verticals.length);
      const vP0x = (fxMin + fxMax) / 2, vP0y = fyMid - radius;
      const vP1x = fxMin - radius, vP1y = fyMid - radius;
      const vP2x = fxMin - radius, vP2y = fyMid;
      verticals.forEach((n, i) => {
        const p = bezier(vT[i], vP0x, vP0y, vP1x, vP1y, vP2x, vP2y);
        n.position(p);
      });

      const pT = distribute(platforms.length);
      const pP0x = fxMax + radius, pP0y = fyMid;
      const pP1x = fxMax + radius, pP1y = fMaxY + radius;
      const pP2x = (fxMin + fxMax) / 2, pP2y = fMaxY + radius;
      platforms.forEach((n, i) => {
        const p = bezier(pT[i], pP0x, pP0y, pP1x, pP1y, pP2x, pP2y);
        n.position(p);
      });
    }
    return undefined;
  });
}

/**
 * Fit the visible (and not-anchor) graph elements to the container.
 *
 * We use Cytoscape's `boundingBox({ includeLabels: true })` so the full
 * rendered extent — including text labels, which extend further than the
 * node shapes — is included in the framing calculation. This is what makes
 * the initial framing actually fill the rectangle instead of leaving
 * awkward whitespace on the side with longer labels.
 */
function fitToContainer(cy: cytoscape.Core, metrics: ContainerMetrics | null) {
  if (!metrics || metrics.width === 0) {
    cy.fit(undefined, 40);
    return;
  }
  const nodes = cy.nodes().filter(n => {
    if (n.id().startsWith('__anchor__')) return false;
    if (n.style('display') === 'none') return false;
    return true;
  });
  if (nodes.length === 0) {
    cy.fit(undefined, 40);
    return;
  }
  // Full visual bounding box including labels.
  const bb = nodes.boundingBox({ includeLabels: true, includeOverlays: false });
  const gw = bb.w;
  const gh = bb.h;
  if (gw <= 0 || gh <= 0) {
    cy.fit(undefined, 40);
    return;
  }
  const padding = 28;
  const desiredZoom = Math.min(
    (metrics.width - padding * 2) / gw,
    (metrics.height - padding * 2) / gh
  );
  // Cap zoom so the initial framing doesn't blow up peripheral labels and
  // keeps nodes a comfortable size in a presentation context.
  const zoom = Math.min(desiredZoom, 1.15);
  cy.zoom(zoom);
  cy.pan({
    x: metrics.width / 2 - ((bb.x1 + bb.w / 2) * zoom),
    y: metrics.height / 2 - ((bb.y1 + bb.h / 2) * zoom)
  });
}

function slug(s: string | null | undefined): string {
  if (!s) return 'none';
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'none';
}
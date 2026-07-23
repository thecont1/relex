// GlobeCanvas — 3d-force-graph (Three.js/WebGL) rendering of the same GraphModel.
//
// SHARED EVERYTHING EXCEPT RENDERING
// -----------------------------------
// This component is the rendering-layer swap-in for GraphCanvas (which uses
// Cytoscape.js). Both consume the same `graph: GraphModel` prop, the same
// `filters: GraphFilters`, the same `searchFocusId`, and call back via the
// same `onNodeClick(id)`. The graph data is loaded once in App.tsx via the
// shared `loadWorkbook` / `validateWorkbook` / `buildGraph` pipeline — neither
// renderer re-parses the workbook.
//
// VISUAL LANGUAGE STAYS CONSISTENT WITH FLAT MODE
// -----------------------------------------------
// - Faculty: spheres sized by degree centrality (cream fill)
// - Platforms: rounded-cube meshes (cyan/amber/purple by sector)
// - Verticals: hexagonal-prism meshes (cyan/amber/purple by sector)
// - Collaboration edges: arcs across the sphere (`linkCurvature`)
// - Affiliation edges: straight lines (no curvature)
// - Idle: slow auto-rotation of the camera around the y-axis; pauses when the
//   user interacts, resumes after a few seconds of inactivity.
// - Click a node: animate camera to centre on it (GSAP). Reduced-motion: instant
//   snap instead.

import { useEffect, useImperativeHandle, useMemo, useRef, forwardRef } from 'react';
import ForceGraph3D from '3d-force-graph';
import * as THREE from 'three';
import { sectorColor, TYPE_TINT } from '../lib/colorSystem';
import { HighlightController, type HighlightState } from '../lib/highlightController';
import { computeEgoNetwork } from '../lib/egoNetwork';
import { computeBaseDiameter, degreeMultiplier } from '../lib/dynamicLayout';
import type {
  EdgeType,
  GraphFilters,
  GraphModel,
  GraphNode,
  ThemeMode
} from '../lib/types';
import { useReducedMotion } from '../hooks/useReducedMotion';

export interface GlobeCanvasHandle {
  /** Re-fit the camera to the visible graph. */
  fit: () => void;
  /** Return the underlying ForceGraph instance for diagnostics/tests. */
  getGraph: () => any;
}

interface Props {
  graph: GraphModel;
  filters: GraphFilters;
  searchFocusId: string | null;
  theme: ThemeMode;
  networkScale: number;
  onNodeClick: (nodeId: string) => void;
}

/** Sphere radius used for both node distribution and the wireframe shell. */
const SPHERE_RADIUS = 300;

export const GlobeCanvas = forwardRef<GlobeCanvasHandle, Props>(function GlobeCanvas(
  { graph, filters, searchFocusId, theme, networkScale, onNodeClick },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fgRef = useRef<any>(null);
  const wireframeRef = useRef<THREE.LineSegments | null>(null);
  const controllerRef = useRef<HighlightController | null>(null);
  const graphRef = useRef(graph);
  graphRef.current = graph;
  // Live ego-network state read by the link accessors so link emphasis tracks
  // the current hover/pin target without rebuilding the whole graph each frame.
  const egoRef = useRef<{ nodeId: string | null; neighborIds: Set<string>; edgeIds: Set<string>; intensity: number }>({
    nodeId: null,
    neighborIds: new Set(),
    edgeIds: new Set(),
    intensity: 0
  });
  const linkKeyRef = useRef<string>('');
  const focusIdRef = useRef<string | null>(null);
  const searchPinRef = useRef(false);
  const onNodeClickRef = useRef(onNodeClick);
  onNodeClickRef.current = onNodeClick;
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const themeRef = useRef(theme);
  themeRef.current = theme;

  // Build the data arrays from the shared GraphModel. We re-run this whenever
  // the graph or filter set changes, but keep the ForceGraph instance mounted
  // so the camera, lights, and wireframe shell persist.
  const visibleIds = useMemo(() => computeVisibleIds(graph, filters), [graph, filters]);

  // ---------- mount ForceGraph once ----------
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();

    const fg = new ForceGraph3D(container, { controlType: 'orbit' })
      .width(rect.width)
      .height(rect.height)
      .backgroundColor(globeTheme(themeRef.current).background)
      .showNavInfo(false)
      // No built-in bloom; we keep things readable on a dark background.
      .nodeRelSize(4)
      .nodeLabel((n: any) => n.label)
      // We own the node meshes so hover/pin can drive material opacity, emissive
      // and scale per-frame (the Three.js equivalent of the Flat view's inline
      // styles). Sprites carry the label so it can brighten with the ego network.
      .nodeThreeObject((n: any) => buildNodeObject(n, themeRef.current))
      .linkColor((l: any) => resolveLinkColor(l, egoRef.current))
      .linkOpacity(0.9)
      .linkWidth((l: any) => resolveLinkWidth(l, egoRef.current))
      .linkCurvature((l: any) => l.__curvature)
      .linkDirectionalParticles((l: any) => (l.__kind === 'faculty-faculty' ? 2 : 0))
      .linkDirectionalParticleWidth((l: any) => (l.__kind === 'faculty-faculty' ? 1.4 : 0))
      .linkDirectionalParticleSpeed((l: any) => (l.__kind === 'faculty-faculty' ? 0.006 : 0))
      .cooldownTicks(0)         // freeze Fibonacci-sphere starting positions
      .warmupTicks(0)
      .onNodeHover((n: any) => {
        container.style.cursor = n ? 'pointer' : '';
        const controller = controllerRef.current;
        if (!controller) return;
        if (n) controller.hoverIn(n.id);
        else controller.hoverOut();
      })
      .onNodeClick((n: any) => {
        // Click pins the ego network AND opens the drawer (both together).
        searchPinRef.current = false;
        controllerRef.current?.togglePin(n.id);
        onNodeClickRef.current(n.id);
      })
      .onBackgroundClick(() => {
        // Clicking empty space clears the pin.
        searchPinRef.current = false;
        controllerRef.current?.unpin();
      });
    fgRef.current = fg;

    // Expose for diagnostics/acceptance tests. Cheap, harmless in prod.
    if (typeof window !== 'undefined') {
      (window as unknown as { __fg?: any }).__fg = fg;
    }

    // ---------- highlight controller (shared with Flat view) ----------
    const controller = new HighlightController({
      reducedMotion: reduced,
      render: (state: HighlightState) => {
        applyGlobeHighlight(fgRef.current, graphRef.current, state, egoRef, linkKeyRef);
      }
    });
    controllerRef.current = controller;

    // ---------- wireframe sphere shell ----------
    const sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 24, 18);
    // EdgesGeometry extracts the unique edges of the sphere mesh — produces a
    // clean latitude/longitude wireframe rather than the dense triangle mesh
    // wireframe that WireframeGeometry would emit.
    const edgesGeo = new THREE.EdgesGeometry(sphereGeo);
    const wire = new THREE.LineSegments(
      edgesGeo,
      new THREE.LineBasicMaterial({
        color: globeTheme(themeRef.current).wireframe,
        transparent: true,
        opacity: 0.35,
        depthWrite: false
      })
    );
    fg.scene().add(wire);
    wireframeRef.current = wire;

    // ---------- lighting ----------
    fg.scene().add(new THREE.AmbientLight(0xffffff, 0.5));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(SPHERE_RADIUS, SPHERE_RADIUS * 0.5, SPHERE_RADIUS);
    fg.scene().add(dir);

    // ---------- auto-rotation (idle) ----------
    // Auto-rotation is suspended while a node is hovered/pinned so the
    // storytelling ego view stays legible.
    let lastInteractionAt = Date.now();
    const onUserInteract = () => { lastInteractionAt = Date.now(); };
    container.addEventListener('pointerdown', onUserInteract);
    container.addEventListener('wheel', onUserInteract);

    let rafHandle = 0;
    const tick = () => {
      const idleMs = Date.now() - lastInteractionAt;
      const highlightActive = !!controllerRef.current?.currentId();
      if (!reducedRef.current && !highlightActive && idleMs > 1500) {
        const cam = fg.camera();
        // Slow orbit: rotate the camera around the y-axis.
        const angle = 0.0006;
        const x = cam.position.x * Math.cos(angle) - cam.position.z * Math.sin(angle);
        const z = cam.position.x * Math.sin(angle) + cam.position.z * Math.cos(angle);
        cam.position.set(x, cam.position.y, z);
        cam.lookAt(0, 0, 0);
      }
      // When idle, keep rest labels front-facing only. This avoids the x-ray
      // effect where back-hemisphere labels print through the globe while still
      // keeping hovered/pinned ego labels fully visible via applyGlobeHighlight.
      if (!highlightActive) updateRestGlobeLabels(fg);
      rafHandle = requestAnimationFrame(tick);
    };
    rafHandle = requestAnimationFrame(tick);

    // ---------- keyboard accessibility: roving focus over visible nodes ----------
    // Same behavior contract as the Flat view: arrow keys move a virtual focus
    // through visible nodes driving the SAME controller as hover; Enter/Space
    // pins + opens the drawer; Escape clears.
    container.tabIndex = 0;
    const visibleNodeIdsSorted = (): string[] =>
      (fg.graphData().nodes as any[])
        .slice()
        .sort((a, b) => String(a.label).localeCompare(String(b.label)))
        .map((n) => n.id);

    const moveFocus = (delta: 1 | -1) => {
      const ids = visibleNodeIdsSorted();
      if (ids.length === 0) return;
      const cur = focusIdRef.current;
      let idx = cur ? ids.indexOf(cur) : -1;
      idx = (idx + delta + ids.length) % ids.length;
      const nextId = ids[idx];
      focusIdRef.current = nextId;
      controller.hoverIn(nextId);
      const node = (fg.graphData().nodes as any[]).find((n) => n.id === nextId);
      if (node) flyToNode(fg, node, reducedRef.current);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault(); moveFocus(1); break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault(); moveFocus(-1); break;
        case 'Tab':
          if (!focusIdRef.current) { e.preventDefault(); moveFocus(1); }
          break;
        case 'Enter':
        case ' ': {
          const id = focusIdRef.current;
          if (id) {
            e.preventDefault();
            searchPinRef.current = false;
            controller.togglePin(id);
            onNodeClickRef.current(id);
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
    container.addEventListener('keydown', onKeyDown);
    const onBlur = () => {
      focusIdRef.current = null;
      if (!controller.isPinned()) controller.hoverOut();
    };
    container.addEventListener('blur', onBlur);

    // ---------- resize observer (debounced) ----------
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const r = container.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          fg.width(r.width).height(r.height);
          // Re-fit so the visible graph keeps filling the new viewport.
          fitCameraToGraph(fg);
        }
      }, 180);
    });
    ro.observe(container);

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      cancelAnimationFrame(rafHandle);
      ro.disconnect();
      container.removeEventListener('pointerdown', onUserInteract);
      container.removeEventListener('wheel', onUserInteract);
      container.removeEventListener('keydown', onKeyDown);
      container.removeEventListener('blur', onBlur);
      controller.destroy();
      controllerRef.current = null;
      try { fg._destructor(); } catch { /* noop */ }
      fgRef.current = null;
      wireframeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the controller's reduced-motion setting live.
  useEffect(() => {
    controllerRef.current?.setReducedMotion(reduced);
  }, [reduced]);

  // ---------- push filtered data into ForceGraph ----------
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    controllerRef.current?.reset();
    focusIdRef.current = null;
    searchPinRef.current = false;
    egoRef.current = { nodeId: null, neighborIds: new Set(), edgeIds: new Set(), intensity: 0 };
    const themeValues = globeTheme(theme);
    fg.backgroundColor(themeValues.background);
    fg.nodeThreeObject((n: any) => buildNodeObject(n, theme));
    if (wireframeRef.current) {
      const mat = wireframeRef.current.material as THREE.LineBasicMaterial;
      mat.color.set(themeValues.wireframe);
    }
    const { nodes, links } = buildFgData(graph, visibleIds, networkScale, theme);
    fg.graphData({ nodes, links });
    // Re-fit the camera after data/scale/theme changes so all visible nodes stay framed.
    fitCameraToGraph(fg);
  }, [graph, visibleIds, theme, networkScale]);

  // ---------- search focus: pin the ego network + fly camera ----------
  useEffect(() => {
    const fg = fgRef.current;
    const controller = controllerRef.current;
    if (!fg || !controller) return;
    if (!searchFocusId) {
      if (searchPinRef.current) {
        searchPinRef.current = false;
        controller.unpin();
      }
      return;
    }
    const focusNode = fg.graphData().nodes.find((n: any) => n.id === searchFocusId);
    if (!focusNode) return;
    searchPinRef.current = true;
    controller.pin(searchFocusId);
    // Search result selection should not fly/zoom the camera; keep the full
    // network framed and only pin/highlight the selected ego network.
    fitCameraToGraph(fg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchFocusId, graph]);

  useImperativeHandle(ref, () => ({
    fit: () => fitCameraToGraph(fgRef.current),
    getGraph: () => fgRef.current
  }));

  return (
    <div
      ref={containerRef}
      className="globe-host"
      role="application"
      aria-label="CeNSE ecosystem network globe (3D). Use arrow keys to move between nodes, Enter to open details, Escape to clear. Use the Accessible View for an equivalent textual listing."
    />
  );
});

// ---------- helpers ----------

interface VisibleSet {
  nodes: Set<string>;
  edges: Set<string>;
}

function computeVisibleIds(graph: GraphModel, filters: GraphFilters): VisibleSet {
  const nodes = new Set<string>();
  const edges = new Set<string>();
  for (const n of graph.nodes) {
    if (n.type === 'platform' && !filters.showPlatforms) continue;
    if (n.type === 'vertical' && !filters.showVerticals) continue;
    if (filters.activeSectors.size > 0) {
      if (n.category && !filters.activeSectors.has(n.category)) {
        if (n.type !== 'faculty') continue;
      }
    }
    nodes.add(n.id);
  }
  for (const e of graph.edges) {
    if (e.type === 'faculty-faculty' && !filters.showCollaborations) continue;
    if (e.type === 'faculty-platform' && !filters.showPlatforms) continue;
    if (e.type === 'faculty-vertical' && !filters.showVerticals) continue;
    if (filters.activeSectors.size > 0) {
      const srcSector = graph.nodes.find(n => n.id === e.source)?.category;
      const tgtSector = graph.nodes.find(n => n.id === e.target)?.category;
      const matches = (srcSector && filters.activeSectors.has(srcSector)) ||
                      (tgtSector && filters.activeSectors.has(tgtSector)) ||
                      (e.type === 'faculty-faculty');
      if (!matches) continue;
    }
    if (!nodes.has(e.source) || !nodes.has(e.target)) continue;
    edges.add(e.id);
  }
  return { nodes, edges };
}

/**
 * Convert the shared GraphModel into the node/link arrays 3d-force-graph
 * expects. Each node carries three fields we attach but don't ship externally:
 * `__color` (sector-tinted fill), `__size` (degree-based value), and
 * `__kind` for downstream filtering.
 *
 * Position strategy: distribute nodes pseudo-randomly on a sphere using a
 * Fibonacci lattice, perturbed by a small angular offset derived from the
 * node's id hash. This gives an even starting distribution that the
 * 3d-force-graph force simulation can then relax — we don't try to lay out
 * the globe deterministically because the spatial position is just the
 * starting point for the force-directed clustering.
 */
function buildFgData(graph: GraphModel, visible: VisibleSet, networkScale: number, theme: ThemeMode) {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const nodes: any[] = [];
  const nodeById = new Map<string, any>();
  const themeBg = globeTheme(theme).background;

  const visibleCount = visible.nodes.size;
  // Part A (Globe): base node radius as a function of available "canvas" area
  // per visible node. We use the projected disc area of the globe as the area
  // proxy, so a sparse (heavily-filtered) view yields bigger nodes and a dense
  // view smaller ones — the same area/count principle as the Flat view, tuned
  // to globe world units and clamped so nodes stay legible without caricature.
  const areaProxy = Math.PI * SPHERE_RADIUS * SPHERE_RADIUS;
  const baseDiameter = computeBaseDiameter({
    availableArea: areaProxy,
    visibleNodeCount: visibleCount,
    minDiameter: 6,
    maxDiameter: 22,
    fillFactor: 0.28
  });
  const baseRadius = (baseDiameter / 2) * boundedNetworkScale(networkScale);

  const visibleGraphNodes = graph.nodes
    .filter(n => visible.nodes.has(n.id))
    // Stable hash order, not source order: the source workbook groups node
    // types, which otherwise puts all faculty in one globe hemisphere and all
    // platforms/verticals in another.
    .sort((a, b) => hashString(a.id) - hashString(b.id));

  for (let i = 0; i < visibleGraphNodes.length; i++) {
    const n = visibleGraphNodes[i];
    // Fibonacci lattice on a unit sphere. The hash-sorted index gives an even
    // type mix around the shell while remaining deterministic across reloads.
    const y = 1 - (i / Math.max(1, visibleGraphNodes.length - 1)) * 2; // [-1, 1]
    const r = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i + (hashString(n.id) % 997) * 0.0007;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    const radius = nodeRadius(n, baseRadius);
    const color = nodeColor(n, graph);
    const fgNode = {
      id: n.id,
      label: n.label,
      type: n.type,
      category: n.category,
      degree: n.degree,
      x: x * SPHERE_RADIUS,
      y: y * SPHERE_RADIUS,
      z: z * SPHERE_RADIUS,
      // These private fields are read back by the mesh builder / accessors.
      __color: color,
      __radius: radius,
      __kind: n.type
    };
    nodes.push(fgNode);
    nodeById.set(n.id, fgNode);
  }

  const links: any[] = [];
  for (const e of graph.edges) {
    if (!visible.edges.has(e.id)) continue;
    const src = nodeById.get(e.source);
    const tgt = nodeById.get(e.target);
    if (!src || !tgt) continue;
    const isCollab = e.type === 'faculty-faculty';
    const color = edgeColor(e, graph, theme);
    // Light mode needs thicker, more opaque relationship lines to read against
    // the pale globe; dark mode keeps its original delicate widths.
    const lightBoost = theme === 'light' ? 1.3 : 1;
    links.push({
      __id: e.id,
      source: src,
      target: tgt,
      __color: color,
      __width: (isCollab ? Math.min(2.4, 0.8 + e.weight * 0.4) : 0.6) * boundedNetworkScale(networkScale) * lightBoost,
      __curvature: isCollab ? 0.25 : 0,
      __themeBg: themeBg,
      __kind: e.type
    });
  }
  return { nodes, links };
}

function nodeColor(n: GraphNode, graph: GraphModel): string {
  if (n.category) {
    const c = sectorColor(n.category, graph.sectors);
    return c.fill;
  }
  return TYPE_TINT[n.type];
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Node radius (globe world units) = space-aware base radius × per-type/degree
 * multiplier. Faculty carry the degree-centrality multiplier on top of the
 * base, exactly as in the Flat view; verticals/platforms get a modest bump.
 */
function nodeRadius(n: GraphNode, baseRadius: number): number {
  if (n.type === 'faculty') {
    return baseRadius * degreeMultiplier(n.degree, { maxMult: 1.45 });
  }
  if (n.type === 'vertical') return baseRadius * 0.95;
  if (n.type === 'platform') return baseRadius * 0.85;
  return baseRadius;
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

function edgeColor(e: { type: EdgeType; sector: string | null }, graph: GraphModel, theme: ThemeMode): string {
  if (theme === 'light') {
    // Softened palette: heavy darkening read as "too hard" on the pale globe.
    // Warmer collab amber + lightly-darkened sector fills stay legible without
    // dominating.
    if (e.type === 'faculty-faculty') return '#d97706';
    if (e.sector) {
      const c = sectorColor(e.sector, graph.sectors);
      return darkenHex(c.fill, 0.15);
    }
    return '#64748b';
  }
  // Dark mode: original palette — warm amber collab, sector-fill affiliation
  // tints, slate fallback.
  if (e.type === 'faculty-faculty') return '#f0b860';
  if (e.sector) {
    const c = sectorColor(e.sector, graph.sectors);
    return c.fill;
  }
  return '#5a6473';
}

// ---------- node meshes + hover/pin highlight (Part B, Globe) ----------
//
// We build each node as a Group containing a sphere mesh (owned so we can drive
// its material opacity/emissive/scale per-frame) plus a text sprite label. The
// shared HighlightController emits {nodeId, intensity, pinned}; applyGlobeHighlight
// maps that onto Three.js material properties — the direct equivalent of the
// Flat view's inline styles — so hover/dwell/fade/pin behavior is identical.

const GLOBE_DIM_OPACITY = 0.16;      // low-but-non-zero dimmed context
const GLOBE_PRIMARY_SCALE = 1.35;
const GLOBE_NEIGHBOR_SCALE = 1.12;

function boundedNetworkScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  // Display range is 60%..150% (App.tsx), multiplied by the 1.25 model base,
  // so the model-space envelope is [0.75, 1.875].
  return Math.max(0.75, Math.min(1.875, scale));
}

function globeTheme(theme: ThemeMode) {
  if (theme === 'light') {
    return {
      background: '#f8fafc',
      wireframe: 0x94a3b8,
      label: '#0f172a',
      labelBg: '#ffffff'
    };
  }
  return {
    background: '#0b0d10',
    wireframe: 0x2a313a,
    label: '#f4ede0',
    labelBg: '#0b0d10'
  };
}

function labelSpriteFor(text: string, theme: ThemeMode): THREE.Sprite {
  const colors = globeTheme(theme);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const font = 28;
  ctx.font = `600 ${font}px Inter, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + 24;
  const h = font + 20;
  canvas.width = w;
  canvas.height = h;
  ctx.font = `600 ${font}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = colors.labelBg;
  ctx.globalAlpha = theme === 'light' ? 0.78 : 0.55;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  ctx.fillStyle = colors.label;
  ctx.fillText(text, w / 2, h / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(mat);
  const scale = 0.18;
  sprite.scale.set(w * scale, h * scale, 1);
  sprite.renderOrder = 1000;
  return sprite;
}

function buildNodeObject(n: any, theme: ThemeMode): THREE.Object3D {
  const group = new THREE.Group();
  const radius = n.__radius ?? 6;
  const color = new THREE.Color(n.__color ?? '#f4ede0');
  const geo = new THREE.SphereGeometry(radius, 20, 16);
  const mat = new THREE.MeshLambertMaterial({
    color,
    transparent: true,
    opacity: 1,
    emissive: color.clone().multiplyScalar(0.0),
    emissiveIntensity: 1
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.baseRadius = radius;
  mesh.renderOrder = 10;
  group.add(mesh);

  const sprite = labelSpriteFor(String(n.label ?? ''), theme);
  sprite.position.set(0, radius + 12, radius * 0.55);
  // Labels hidden at rest for faculty (progressive disclosure); shown for
  // platforms/verticals. Ego highlight forces them visible regardless.
  const restVisible = n.type !== 'faculty';
  (sprite.material as THREE.SpriteMaterial).opacity = restVisible ? 0.9 : 0;
  group.add(sprite);

  // Stash for the highlight pass.
  group.userData.mesh = mesh;
  group.userData.sprite = sprite;
  group.userData.baseColor = color;
  group.userData.restLabelOpacity = restVisible ? 0.9 : 0;
  group.renderOrder = 10;
  return group;
}

interface EgoState {
  nodeId: string | null;
  neighborIds: Set<string>;
  edgeIds: Set<string>;
  intensity: number;
}

function resolveLinkColor(l: any, ego: EgoState): string {
  if (!ego.nodeId) return l.__color;
  const k = ego.intensity;
  if (ego.edgeIds.has(l.__id)) return l.__color;
  // Dim non-ego links toward the background, proportional to intensity.
  const base = new THREE.Color(l.__color);
  const bg = new THREE.Color(l.__themeBg ?? '#0b0d10');
  return '#' + base.clone().lerp(bg, 0.82 * k).getHexString();
}

function resolveLinkWidth(l: any, ego: EgoState): number {
  if (!ego.nodeId) return l.__width;
  const k = ego.intensity;
  if (ego.edgeIds.has(l.__id)) return l.__width * (1 + 1.1 * k);
  return l.__width * (1 - 0.7 * k);
}

function updateRestGlobeLabels(fg: any) {
  if (!fg) return;
  const data = fg.graphData?.();
  const cam = fg.camera?.();
  if (!data?.nodes || !cam) return;
  const camDir = cam.position.clone().normalize();
  for (const node of data.nodes) {
    const obj = node.__threeObj as THREE.Object3D | undefined;
    const sprite = obj?.userData?.sprite as THREE.Sprite | undefined;
    if (!sprite) continue;
    const restLabelOp = (obj!.userData.restLabelOpacity as number) ?? 0;
    const nodeDir = new THREE.Vector3(node.x ?? 0, node.y ?? 0, node.z ?? 0).normalize();
    const facing = nodeDir.dot(camDir);
    const facingRamp = Math.max(0, Math.min(1, (facing + 0.08) / 0.35));
    (sprite.material as THREE.SpriteMaterial).opacity = restLabelOp * facingRamp;
  }
}

/**
 * Map the controller's normalized highlight state onto the globe's Three.js
 * node materials + link accessors. Cross-type: for a faculty node the ego
 * network already contains verticals, platforms AND collaborators (computed via
 * computeEgoNetwork over all edge types), so they all light up together.
 */
function applyGlobeHighlight(
  fg: any,
  graph: GraphModel,
  state: HighlightState,
  egoRef: { current: EgoState },
  linkKeyRef: { current: string }
) {
  if (!fg) return;
  const data = fg.graphData();
  if (!data || !data.nodes) return;

  const k = Math.max(0, Math.min(1, state.intensity));
  const active = !!state.nodeId && k > 0.001;

  if (active) {
    const ego = computeEgoNetwork(graph, state.nodeId!, {
      nodes: new Set<string>(data.nodes.map((n: any) => n.id)),
      edges: new Set<string>(data.links.map((l: any) => l.__id))
    });
    egoRef.current = {
      nodeId: state.nodeId,
      neighborIds: ego.neighborIds,
      edgeIds: ego.edgeIds,
      intensity: k
    };
  } else {
    egoRef.current = { nodeId: null, neighborIds: new Set(), edgeIds: new Set(), intensity: 0 };
  }

  const ego = egoRef.current;

  for (const node of data.nodes) {
    const obj = node.__threeObj as THREE.Object3D | undefined;
    if (!obj) continue;
    const mesh = obj.userData.mesh as THREE.Mesh | undefined;
    const sprite = obj.userData.sprite as THREE.Sprite | undefined;
    if (!mesh) continue;
    const mat = mesh.material as THREE.MeshLambertMaterial;
    const baseColor = obj.userData.baseColor as THREE.Color;
    const restLabelOp = (obj.userData.restLabelOpacity as number) ?? 0;

    if (!active) {
      mat.opacity = 1;
      mat.emissive.copy(baseColor).multiplyScalar(0);
      obj.scale.setScalar(1);
      if (sprite) (sprite.material as THREE.SpriteMaterial).opacity = restLabelOp;
      continue;
    }

    const isPrimary = node.id === state.nodeId;
    const isNeighbor = ego.neighborIds.has(node.id);

    if (isPrimary || isNeighbor) {
      const scaleTarget = isPrimary ? GLOBE_PRIMARY_SCALE : GLOBE_NEIGHBOR_SCALE;
      obj.scale.setScalar(1 + (scaleTarget - 1) * k);
      mat.opacity = 1;
      // Brighten via emissive: primary strongest, neighbors secondary.
      const emin = isPrimary ? 0.55 : 0.3;
      mat.emissive.copy(baseColor).multiplyScalar(emin * k);
      // Labels for hovered node + neighbors become visible even if hidden at rest.
      if (sprite) {
        const target = 1;
        (sprite.material as THREE.SpriteMaterial).opacity = restLabelOp + (target - restLabelOp) * k;
      }
    } else {
      obj.scale.setScalar(1);
      mat.opacity = 1 + (GLOBE_DIM_OPACITY - 1) * k;
      mat.emissive.copy(baseColor).multiplyScalar(0);
      if (sprite) {
        const target = Math.min(restLabelOp, GLOBE_DIM_OPACITY);
        (sprite.material as THREE.SpriteMaterial).opacity = restLabelOp + (target - restLabelOp) * k;
      }
    }
  }

  // Nudge the link accessors so 3d-force-graph re-reads colour/width. We only
  // reassign when the ego target changes to avoid churn every intensity frame;
  // colour/width accessors read egoRef.current.intensity live via closure.
  const key = ego.nodeId ?? '';
  if (key !== linkKeyRef.current) {
    linkKeyRef.current = key;
  }
  // Always refresh link visuals so intensity ramps animate.
  fg.linkColor(fg.linkColor());
  fg.linkWidth(fg.linkWidth());
}

/**
 * Position the camera so the visible graph fills the viewport. We compute the
 * centroid and bounding extent of the node positions, then place the camera
 * outside the bounding sphere pointing at the centroid.
 */
function fitCameraToGraph(fg: any) {
  if (!fg) return;
  const data = fg.graphData();
  if (!data || !data.nodes || data.nodes.length === 0) return;
  let cx = 0, cy = 0, cz = 0;
  for (const n of data.nodes) {
    cx += n.x; cy += n.y; cz += n.z;
  }
  const n = data.nodes.length;
  cx /= n; cy /= n; cz /= n;
  let maxR = 0;
  for (const node of data.nodes) {
    const dx = node.x - cx, dy = node.y - cy, dz = node.z - cz;
    const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (r > maxR) maxR = r;
  }
  const cam = fg.camera();
  // Place camera with extra label padding; live pixels showed the old 2.5× fit
  // clipped top/edge sprites after labels were brought to the front.
  const dist = Math.max(maxR * 2.9, SPHERE_RADIUS * 2.35);
  cam.position.set(cx, cy, cz + dist);
  cam.lookAt(cx, cy, cz);
  fg.controls().target.set(cx, cy, cz);
  fg.controls().update();
}

/**
 * Animate the camera to look at a specific node. Reduced-motion users get an
 * instant snap instead.
 */
function flyToNode(fg: any, node: any, reducedMotion: boolean) {
  const cam = fg.camera();
  const target = new THREE.Vector3(node.x, node.y, node.z);
  const dir = target.clone().normalize();
  const endPos = target.clone().add(dir.multiplyScalar(SPHERE_RADIUS * 1.6));

  if (reducedMotion) {
    cam.position.copy(endPos);
    fg.controls().target.copy(target);
    fg.controls().update();
    return;
  }

  // Manual interpolation: start from current camera state, tween to endPos.
  const startPos = cam.position.clone();
  const startTarget = fg.controls().target.clone();
  const duration = 700; // ms
  const startT = performance.now();
  const tick = () => {
    const t = Math.min(1, (performance.now() - startT) / duration);
    // easeInOutCubic
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    cam.position.lerpVectors(startPos, endPos, eased);
    const tgt = new THREE.Vector3().lerpVectors(startTarget, target, eased);
    fg.controls().target.copy(tgt);
    fg.controls().update();
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
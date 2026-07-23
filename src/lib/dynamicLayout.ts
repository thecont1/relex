// dynamicLayout — space-aware node sizing math shared by the renderers.
//
// The goal (Part A of the spec) is that node size and spacing adapt to the
// available canvas so a sparse filtered view uses big, legible nodes and a
// dense unfiltered view shrinks them to fit — always filling the space without
// clipping. The core is a pure function so it can be unit-reasoned about and
// reused by both the Flat fit-and-scale pass and the Globe sizing.

export interface NodeSizingInput {
  /** Usable canvas area in px^2 (already minus padding). */
  availableArea: number;
  /** Number of currently-visible nodes. */
  visibleNodeCount: number;
  /** Legible floor for the base diameter (px). Spec: ~14-16. */
  minDiameter?: number;
  /** Caricature ceiling for the base diameter (px). Spec: ~60-70. */
  maxDiameter?: number;
  /**
   * Fraction of each node's notional cell the node should occupy. Lower =
   * more breathing room / spacing between nodes. 0.55 leaves room for labels.
   */
  fillFactor?: number;
}

export const DEFAULT_MIN_DIAMETER = 15;
export const DEFAULT_MAX_DIAMETER = 66;
export const DEFAULT_FILL_FACTOR = 0.55;

/**
 * Compute the base node DIAMETER (px) as a function of available area per
 * visible node, clamped between a legible minimum and a non-caricature maximum.
 * The degree-centrality multiplier is applied on top of this base by the
 * caller.
 *
 * Derivation: give each node a square cell of area (availableArea / count).
 * The cell's side is sqrt(areaPerNode); the node occupies `fillFactor` of that
 * side as its diameter, then we clamp.
 */
export function computeBaseDiameter(input: NodeSizingInput): number {
  const {
    availableArea,
    visibleNodeCount,
    minDiameter = DEFAULT_MIN_DIAMETER,
    maxDiameter = DEFAULT_MAX_DIAMETER,
    fillFactor = DEFAULT_FILL_FACTOR
  } = input;

  // Guard: no nodes or degenerate area → return the max legible size so a
  // single visible node reads big rather than collapsing to the floor.
  if (visibleNodeCount <= 0 || !isFinite(availableArea) || availableArea <= 0) {
    return maxDiameter;
  }

  const areaPerNode = availableArea / visibleNodeCount;
  const cellSide = Math.sqrt(areaPerNode);
  const raw = cellSide * fillFactor;
  return clamp(raw, minDiameter, maxDiameter);
}

/**
 * Degree-centrality multiplier applied on top of the base diameter. Higher
 * degree → larger, within [minMult, maxMult]. Degree is soft-capped so a
 * single very-high-degree hub doesn't dwarf everything.
 */
export function degreeMultiplier(
  degree: number,
  opts: { degreeCap?: number; minMult?: number; maxMult?: number } = {}
): number {
  const { degreeCap = 14, minMult = 1, maxMult = 1.9 } = opts;
  const norm = Math.min(Math.max(degree, 0), degreeCap) / degreeCap;
  return minMult + norm * (maxMult - minMult);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

// ---------- standardized inline-label shape sizing (verticals/platforms) ----------
//
// Verticals (hexagons) and platforms (rounded squares) render their label
// INSIDE the shape, wrapped over up to two lines and centered. Every node of a
// type must be one standardized size, large enough to fit the *longest* label
// in that set on two lines at the current font. We compute that once by
// measuring all labels and sizing to the worst case.

export interface InlineLabelSizingInput {
  /** All labels in the type set (e.g. every vertical's label). */
  labels: string[];
  /** Rendered label font size in px (model units). */
  fontSize: number;
  /** Approximate line-height multiple. */
  lineHeight?: number;
  /** Max wrapped lines the shape must accommodate. Spec: 2. */
  maxLines?: number;
  /**
   * Measures the pixel width of a single line of text at `fontSize`. Injected so
   * the math stays pure/testable; the renderer passes a canvas-2d measurer.
   */
  measure: (text: string, fontSize: number) => number;
  /**
   * Fraction of the shape's HEIGHT that is full-width. A rounded rectangle is
   * ~1.0 (text can use nearly the whole box). A regular hexagon (Cytoscape's
   * `hexagon`, points top+bottom) is only full-width across its vertical
   * middle, so wrapped text must be constrained to that central band — use a
   * value < 1 (≈0.5) so text never crosses the angled top/bottom edges.
   */
  widthBandFraction?: number;
  /**
   * Fraction of the shape's WIDTH that is usable for text (horizontal internal
   * padding). Hexagons taper horizontally too, so keep this generous (< 1).
   */
  usableWidthFraction?: number;
  /** Absolute internal padding (px) added around the text block. */
  padding?: number;
  /** Clamp for the resulting width/height. */
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
}

export interface InlineLabelSize {
  width: number;
  height: number;
  /** The text-max-width (px) to hand Cytoscape so greedy wrap yields ≤ maxLines. */
  textMaxWidth: number;
}

/**
 * Greedy-wrap `text` into the fewest lines whose widest line is <= maxLineWidth,
 * returning the resulting line count and the widest achieved line width. This
 * mirrors Cytoscape's own greedy `text-wrap: wrap` behavior so our sizing and
 * the renderer agree on how many lines a label takes.
 */
export function greedyWrap(
  text: string,
  maxLineWidth: number,
  measure: (t: string) => number
): { lines: string[]; widest: number } {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { lines: [''], widest: 0 };
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? current + ' ' + word : word;
    if (current && measure(candidate) > maxLineWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  const widest = lines.reduce((m, l) => Math.max(m, measure(l)), 0);
  return { lines, widest };
}

/**
 * Compute one standardized shape size (width, height, text-max-width) that fits
 * the worst-case label in the set on <= maxLines wrapped lines, with internal
 * padding and (for hexagons) a central-band constraint so text never touches
 * the angled edges.
 *
 * Strategy: for each label, find the smallest max-line-width that wraps it into
 * <= maxLines lines (search a small set of candidate widths derived from the
 * label's single-line width). The chosen text block for the whole set is the
 * worst case across all labels. Then expand the block by the band/padding
 * factors into the actual shape footprint.
 */
export function computeStandardizedShapeSize(input: InlineLabelSizingInput): InlineLabelSize {
  const {
    labels,
    fontSize,
    lineHeight = 1.25,
    maxLines = 2,
    measure,
    widthBandFraction = 1,
    usableWidthFraction = 0.9,
    padding = 12,
    minWidth = 40,
    maxWidth = 400,
    minHeight = 40,
    maxHeight = 400
  } = input;

  const clean = labels.filter(l => l && l.trim().length > 0);
  if (clean.length === 0) {
    return { width: minWidth, height: minHeight, textMaxWidth: minWidth };
  }

  const measureAt = (t: string) => measure(t, fontSize);

  // For each label, choose the max-line-width that packs it into <= maxLines
  // while keeping the widest line as small as possible (a balanced 2-line box).
  // We want the SET's text block to be the worst case, so track the max needed
  // line width and the max needed line count across all labels.
  let neededLineWidth = 0;
  let neededLines = 1;

  for (const label of clean) {
    const singleLine = measureAt(label);
    // Candidate target widths: full single line down to 1/maxLines of it. The
    // balanced target for maxLines is singleLine/maxLines, but greedy wrap on
    // word boundaries rarely hits it exactly, so we search upward from the
    // balanced width until the label fits in <= maxLines lines.
    const balanced = singleLine / maxLines;
    let chosenWidth = singleLine; // fallback: one line
    // Search from balanced width up to full single-line width in small steps.
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const w = balanced + ((singleLine - balanced) * i) / steps;
      const { lines } = greedyWrap(label, w, measureAt);
      if (lines.length <= maxLines) {
        // Use the widest actual line at this wrap, not the target width.
        const { widest } = greedyWrap(label, w, measureAt);
        chosenWidth = widest;
        break;
      }
    }
    const { lines } = greedyWrap(label, chosenWidth, measureAt);
    neededLineWidth = Math.max(neededLineWidth, chosenWidth);
    neededLines = Math.max(neededLines, Math.min(lines.length, maxLines));
  }

  const textBlockW = neededLineWidth;
  const textBlockH = neededLines * fontSize * lineHeight;

  // Expand the text block into the shape footprint: divide by the usable
  // fractions (band/padding) so the *usable* interior still contains the block,
  // then add absolute padding.
  const rawW = textBlockW / Math.max(0.1, usableWidthFraction) + padding * 2;
  const rawH = textBlockH / Math.max(0.1, widthBandFraction) + padding * 2;

  const width = clamp(rawW, minWidth, maxWidth);
  const height = clamp(rawH, minHeight, maxHeight);

  // text-max-width handed to Cytoscape must be the same safe interior width we
  // used for sizing. This matters most for hexagons: the outer box may be wide,
  // but only a smaller central band is safe for text without touching angled
  // edges. If we returned `width - padding * 2`, Cytoscape could wrap into the
  // unsafe tapered area even though the shape was sized with a smaller usable
  // fraction.
  return {
    width,
    height,
    textMaxWidth: Math.max(1, (width - padding * 2) * usableWidthFraction)
  };
}

// ---------- axis-aligned bounding-box overlap for label collision ----------

export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function boxesOverlap(a: Box, b: Box, gap = 0): boolean {
  return !(
    a.x2 + gap <= b.x1 ||
    b.x2 + gap <= a.x1 ||
    a.y2 + gap <= b.y1 ||
    b.y2 + gap <= a.y1
  );
}

/** Minimum translation needed to separate two overlapping boxes, as (dx, dy)
 *  applied to box `b` (a stays put). Pushes along the axis of least penetration. */
export function separationVector(a: Box, b: Box, gap = 0): { dx: number; dy: number } {
  const aCx = (a.x1 + a.x2) / 2;
  const aCy = (a.y1 + a.y2) / 2;
  const bCx = (b.x1 + b.x2) / 2;
  const bCy = (b.y1 + b.y2) / 2;

  const overlapX =
    Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) + gap;
  const overlapY =
    Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1) + gap;

  if (overlapX <= 0 && overlapY <= 0) return { dx: 0, dy: 0 };

  // Resolve along the axis of least penetration.
  if (overlapX < overlapY) {
    const dir = bCx >= aCx ? 1 : -1;
    return { dx: dir * overlapX, dy: 0 };
  }
  const dir = bCy >= aCy ? 1 : -1;
  return { dx: 0, dy: dir * overlapY };
}

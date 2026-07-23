// Sector-to-color mapping. Distinct sectors are read dynamically from the workbook;
// the assignment below is deterministic and colorblind-safe.

import type { NodeType } from './types';

// HCL-derived palette chosen to be distinguishable under deuteranopia, protanopia,
// and tritanopia. Each entry also differs in luminance so it remains distinguishable
// in monochrome (we never rely on color alone).

interface PaletteEntry {
  fill: string;
  border: string;
  text: string; // for use on dark surfaces
}

const PALETTE: PaletteEntry[] = [
  { fill: '#f0b860', border: '#ffd28a', text: '#3a2a08' }, // warm amber  — Strategic Sector
  { fill: '#5fb8d1', border: '#a8e0ee', text: '#0a2832' }, // sky cyan    — Industry Relevance
  { fill: '#b58cd6', border: '#d3b6ec', text: '#2a1a3a' }, // muted violet — Public Interest
  { fill: '#7fc88f', border: '#aee0b8', text: '#0f2a14' }, // sage green  — reserve
  { fill: '#d96a78', border: '#f0a3ad', text: '#3a0e14' }, // dusty rose  — reserve
  { fill: '#e6c860', border: '#f4dca0', text: '#3a2e08' }  // saffron     — reserve
];

const RESERVED_FALLBACK: PaletteEntry = { fill: '#8a857a', border: '#a8a39a', text: '#1a1814' };

export function sectorColor(sector: string | null | undefined, sectors: string[]): PaletteEntry {
  if (!sector) return RESERVED_FALLBACK;
  const idx = sectors.indexOf(sector);
  if (idx < 0) return RESERVED_FALLBACK;
  return PALETTE[idx % PALETTE.length];
}

// Node-type tints. Background gradient/inner glow is handled in cytoscape stylesheet,
// but we expose the canonical tints here for any HTML overlay (legend, drawer badges).

export const TYPE_TINT: Record<NodeType, string> = {
  faculty: '#f4ede0',
  platform: '#5fb8d1',
  vertical: '#b58cd6'
};

// Inline SVG used by the legend to show node shapes. These mirror what the
// Cytoscape stylesheet renders so users see a consistent visual key.

export function shapeSvgPath(type: NodeType): string {
  if (type === 'faculty') {
    return '<circle cx="10" cy="10" r="8" />';
  }
  if (type === 'platform') {
    return '<rect x="2" y="2" width="16" height="16" rx="3" ry="3" />';
  }
  // vertical — hexagon
  return '<polygon points="10,1 18,5 18,15 10,19 2,15 2,5" />';
}
// Graph export.
//
// PNG: uses Cytoscape's built-in `cy.png()` — captures the rendered canvas
// at any scale and embeds the configured background colour.
//
// SVG: uses the `cytoscape-svg` extension (registered once in GraphCanvas.tsx)
// which provides `cy.svg()`. SVG export is NOT part of Cytoscape core; without
// the extension registered via `cytoscape.use(cytoscapeSvg)`, calling `cy.svg()`
// throws. The extension emits an SVG string of the current view which we wrap
// in a self-contained, presentation-ready <svg> element.
//
// Both exports are invoked from user click handlers — i.e. well after the
// fcose layout has settled — so the rendered coordinates are stable.

import type { CyCore } from './graphTypes';

export function exportPng(cy: CyCore, filename: string): void {
  // cytoscape's cy.png() returns either a string (default) or Blob when called
  // with output:'blob'. We pass options matching ExportBlobOptions so we can
  // hand a real Blob to URL.createObjectURL — which scales to large renders
  // where a data URL would balloon to tens of megabytes.
  const raw = cy.png({
    full: true,
    scale: 2,           // presentation-quality; bumpable later
    bg: getComputedDocumentBg(),
    output: 'blob'
  } as unknown as Parameters<CyCore['png']>[0]);
  const blob = raw instanceof Blob
    ? raw
    : new Blob([raw as unknown as string], { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportSvg(cy: CyCore, filename: string): void {
  // cytoscape-svg returns the rendered SVG string of the current view.
  // The extension is required: cy.svg() throws if the extension isn't registered.
  const raw = cy.svg({ full: true, scale: 2, bg: getComputedDocumentBg() });

  // The extension emits a standalone <svg> element with width/height set to
  // the canvas pixel size. We hand it straight to the user.
  const blob = new Blob([raw], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getComputedDocumentBg(): string {
  if (typeof document === 'undefined') return '#0b0d10';
  const root = getComputedStyle(document.documentElement);
  return root.getPropertyValue('--surface-0').trim() || '#0b0d10';
}

function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
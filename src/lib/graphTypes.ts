// Permissive Cytoscape typings for code paths where the public types are too
// strict (numericStyle / style accept zero args at runtime but the typings
// require a property name; cytoscape-svg's cy.svg() is also not in @types).

import type { Core } from 'cytoscape';

export type CyCore = Core;

export interface CySvgOptions {
  full?: boolean;
  scale?: number;
  bg?: string;
}

// Add the SVG extension method to Core without depending on @types.
// (cy.png is already in @types/cytoscape and returns a Blob; we let it through.)
declare module 'cytoscape' {
  interface Core {
    svg(options?: CySvgOptions): string;
  }
}
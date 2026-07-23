// Minimal ambient declaration for cytoscape-svg (no @types package ships).
declare module 'cytoscape-svg' {
  import type { Ext } from 'cytoscape';
  const cytoscapeSvg: Ext;
  export default cytoscapeSvg;
}
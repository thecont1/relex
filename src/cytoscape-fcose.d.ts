// Minimal ambient declarations for cytoscape-fcose which doesn't ship its own.
declare module 'cytoscape-fcose' {
  import type { Ext } from 'cytoscape';
  const fcose: Ext;
  export default fcose;
}
// Ego-network computation — the shared, renderer-agnostic definition of what
// "lights up" when a node is hovered / focused / pinned.
//
// This is the primary storytelling primitive of the app: a node's ego network
// is itself PLUS every directly (1-hop) connected node, ACROSS ALL EDGE TYPES
// simultaneously. For a faculty node that means connected verticals,
// platforms AND collaborating faculty are all part of the same ego network —
// the cross-type highlight is not limited to one edge kind. For a
// platform/vertical node it means all connected faculty.
//
// Callers pass the set of currently-visible node/edge ids so the ego network
// only ever includes elements the user can actually see (a neighbor hidden by
// a layer toggle or sector filter must not be emphasized).

import type { GraphModel } from './types';

export interface EgoNetwork {
  /** The hovered/focused/pinned node id. */
  primaryId: string;
  /** Direct (1-hop) neighbor node ids, across every edge type. */
  neighborIds: Set<string>;
  /** Edge ids directly connecting the primary node to its neighbors. */
  edgeIds: Set<string>;
}

export interface VisibilityMask {
  nodes?: Set<string>;
  edges?: Set<string>;
}

/**
 * Compute the ego network for `nodeId` from the shared graph model.
 *
 * @param graph  the full graph model
 * @param nodeId the primary node
 * @param mask   optional visibility mask; when provided, neighbors reached only
 *               through a hidden edge, hidden neighbors, and hidden edges are
 *               excluded so we never emphasize something off-screen.
 */
export function computeEgoNetwork(
  graph: GraphModel,
  nodeId: string,
  mask?: VisibilityMask
): EgoNetwork {
  const neighborIds = new Set<string>();
  const edgeIds = new Set<string>();

  const nodeVisible = (id: string) => (mask?.nodes ? mask.nodes.has(id) : true);
  const edgeVisible = (id: string) => (mask?.edges ? mask.edges.has(id) : true);

  // Primary must itself be visible for the ego network to be meaningful; if it
  // isn't we still return an empty-neighbor ego so callers degrade gracefully.
  for (const e of graph.edges) {
    if (e.source !== nodeId && e.target !== nodeId) continue;
    if (!edgeVisible(e.id)) continue;
    const other = e.source === nodeId ? e.target : e.source;
    if (!nodeVisible(other)) continue;
    neighborIds.add(other);
    edgeIds.add(e.id);
  }

  return { primaryId: nodeId, neighborIds, edgeIds };
}

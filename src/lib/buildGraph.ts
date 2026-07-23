// Normalizes validated workbook rows into a canonical node/edge collection plus metrics.
// This is the bridge between the spreadsheet and both the visual graph and the accessible model.
//
// Rules implemented here:
//  - faculty-platform and faculty-vertical edges are simple affiliations (weight 1).
//  - faculty-faculty edges are undirected and merged across multiple collaboration rows,
//    accumulating projectCount and a merged projects[] array.
//  - Sector values are derived dynamically from the data (no hardcoded labels).
//  - Degree and connected-IDs are computed for every node.

import type { GraphModel, GraphNode, GraphEdge, EdgeType, WorkbookData } from './types';

export function buildGraph(data: WorkbookData): GraphModel {
  // ---------- nodes ----------
  const facultyNodes: GraphNode[] = data.faculty.map(f => ({
    id: `faculty:${f.Faculty}`,
    type: 'faculty',
    label: f.Faculty,
    category: null,
    degree: 0,
    counts: { platforms: 0, verticals: 0, collaborators: 0 },
    connectedIds: []
  }));
  const platformNodes: GraphNode[] = data.platforms.map(p => ({
    id: `platform:${p['Platform']}`,
    type: 'platform',
    label: p['Platform'],
    category: p['Sector'] || null,
    description: p['Description'],
    degree: 0,
    counts: { platforms: 0, verticals: 0, collaborators: 0 },
    connectedIds: []
  }));
  const verticalNodes: GraphNode[] = data.verticals.map(v => ({
    id: `vertical:${v['Research Vertical']}`,
    type: 'vertical',
    label: v['Research Vertical'],
    category: v['Sector'] || null,
    degree: 0,
    counts: { platforms: 0, verticals: 0, collaborators: 0 },
    connectedIds: []
  }));

  const nodes: GraphNode[] = [...facultyNodes, ...platformNodes, ...verticalNodes];
  const nodeById = new Map(nodes.map(n => [n.id, n]));

  // ---------- faculty-platform edges ----------
  const edges: GraphEdge[] = [];
  let edgeSeq = 0;
  const facultyByName = new Map(data.faculty.map(f => [f.Faculty, `faculty:${f.Faculty}`]));

  for (const row of data.facultyPlatforms) {
    const fId = facultyByName.get(row.Faculty);
    const pId = `platform:${row.Platform}`;
    if (!fId || !nodeById.has(pId)) continue;
    edges.push({
      id: `e-${edgeSeq++}`,
      source: fId,
      target: pId,
      type: 'faculty-platform',
      projectCount: 1,
      projects: [],
      weight: 1,
      sector: nodeById.get(pId)?.category ?? null
    });
  }

  // ---------- faculty-vertical edges ----------
  for (const row of data.facultyVerticals) {
    const fId = facultyByName.get(row.Faculty);
    const vId = `vertical:${row['Research Vertical']}`;
    if (!fId || !nodeById.has(vId)) continue;
    edges.push({
      id: `e-${edgeSeq++}`,
      source: fId,
      target: vId,
      type: 'faculty-vertical',
      projectCount: 1,
      projects: [],
      weight: 1,
      sector: nodeById.get(vId)?.category ?? null
    });
  }

  // ---------- faculty-faculty collaborations (merged) ----------
  interface CollabAcc {
    projects: string[];
    count: number;
    a: string;
    b: string;
  }
  const collabMap = new Map<string, CollabAcc>();
  for (const row of data.collaborations) {
    const a = row['Faculty A'];
    const b = row['Faculty B'];
    if (!a || !b || a === b) continue;
    const aId = facultyByName.get(a);
    const bId = facultyByName.get(b);
    if (!aId || !bId) continue;
    // Canonical key so (A,B) and (B,A) collapse
    const [lo, hi] = aId < bId ? [aId, bId] : [bId, aId];
    const key = `${lo}::${hi}`;
    const topic = row['Project/Topic'] || '';
    const existing = collabMap.get(key);
    if (existing) {
      existing.count++;
      if (topic && !existing.projects.includes(topic)) existing.projects.push(topic);
    } else {
      collabMap.set(key, { a: lo, b: hi, count: 1, projects: topic ? [topic] : [] });
    }
  }
  for (const { a, b, count, projects } of Array.from(collabMap.values())) {
    edges.push({
      id: `e-${edgeSeq++}`,
      source: a,
      target: b,
      type: 'faculty-faculty',
      projectCount: count,
      projects,
      weight: count,
      sector: null
    });
  }

  // ---------- metrics: degree + connected ids + counts ----------
  for (const e of edges) {
    const s = nodeById.get(e.source);
    const t = nodeById.get(e.target);
    if (!s || !t) continue;
    s.degree++;
    t.degree++;
    if (!s.connectedIds.includes(t.id)) s.connectedIds.push(t.id);
    if (!t.connectedIds.includes(s.id)) t.connectedIds.push(s.id);
    if (e.type === 'faculty-platform') {
      s.counts.platforms++;
      t.counts.platforms++;
    } else if (e.type === 'faculty-vertical') {
      s.counts.verticals++;
      t.counts.verticals++;
    } else if (e.type === 'faculty-faculty') {
      s.counts.collaborators++;
      t.counts.collaborators++;
    }
  }

  // ---------- distinct sectors in encounter order ----------
  const seenSectors = new Set<string>();
  const sectors: string[] = [];
  for (const n of [...platformNodes, ...verticalNodes]) {
    const cat = n.category;
    if (cat && !seenSectors.has(cat)) {
      seenSectors.add(cat);
      sectors.push(cat);
    }
  }

  // ---------- edge counts by type ----------
  const edgeCounts: Record<EdgeType, number> = { 'faculty-platform': 0, 'faculty-vertical': 0, 'faculty-faculty': 0 };
  for (const e of edges) edgeCounts[e.type]++;

  return {
    nodes,
    edges,
    sectors,
    counts: {
      faculty: facultyNodes.length,
      platforms: platformNodes.length,
      verticals: verticalNodes.length,
      edges: edgeCounts
    }
  };
}

// ---------- helpers used by drawer/search ----------

export function findFacultyIdByName(graph: GraphModel, name: string): string | null {
  const target = graph.nodes.find(n => n.type === 'faculty' && n.label.toLowerCase() === name.toLowerCase());
  return target?.id ?? null;
}

export function searchFaculty(graph: GraphModel, query: string): GraphNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return graph.nodes.filter(n =>
    n.type === 'faculty' &&
    n.label.toLowerCase().includes(q)
  );
}
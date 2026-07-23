// Builds the semantic accessible model exposed via AccessibleView.
// Equivalent information to the graph, but expressed as lists and tables so it
// is fully usable by screen-reader and keyboard-only users.
//
// The model mirrors the visual graph: faculty rosters with their connected
// verticals, platforms, and collaborators; sector groupings; collaboration
// topic index.

import type { GraphModel } from './types';

export interface AccessibleFaculty {
  id: string;
  name: string;
  collaborators: { name: string; projects: string[] }[];
  verticals: string[];
  platforms: string[];
  degree: number;
}

export interface AccessiblePlatform {
  id: string;
  name: string;
  sector: string | null;
  description: string;
  faculty: string[];
}

export interface AccessibleVertical {
  id: string;
  name: string;
  sector: string | null;
  faculty: string[];
}

export interface AccessibleCollaboration {
  facultyA: string;
  facultyB: string;
  projects: string[];
  weight: number;
}

export interface AccessibleModel {
  faculty: AccessibleFaculty[];
  platforms: AccessiblePlatform[];
  verticals: AccessibleVertical[];
  collaborations: AccessibleCollaboration[];
  sectors: string[];
}

export function buildAccessibleModel(graph: GraphModel): AccessibleModel {
  const byId = new Map(graph.nodes.map(n => [n.id, n]));

  const faculty: AccessibleFaculty[] = graph.nodes
    .filter(n => n.type === 'faculty')
    .map(n => {
      const collabEdges = graph.edges.filter(e =>
        e.type === 'faculty-faculty' &&
        (e.source === n.id || e.target === n.id)
      );
      const collaborators = collabEdges.map(e => {
        const otherId = e.source === n.id ? e.target : e.source;
        const other = byId.get(otherId);
        return { name: other?.label ?? otherId, projects: e.projects };
      });
      // Sort collaborators alphabetically for stable screen-reader order
      collaborators.sort((a, b) => a.name.localeCompare(b.name));

      const verticals = graph.edges
        .filter(e => e.type === 'faculty-vertical' && (e.source === n.id || e.target === n.id))
        .map(e => byId.get(e.source === n.id ? e.target : e.source)?.label ?? '')
        .filter(Boolean)
        .sort();

      const platforms = graph.edges
        .filter(e => e.type === 'faculty-platform' && (e.source === n.id || e.target === n.id))
        .map(e => byId.get(e.source === n.id ? e.target : e.source)?.label ?? '')
        .filter(Boolean)
        .sort();

      return {
        id: n.id,
        name: n.label,
        collaborators,
        verticals,
        platforms,
        degree: n.degree
      };
    })
    // Sort faculty by descending degree (most-connected first), then alphabetical
    .sort((a, b) => b.degree - a.degree || a.name.localeCompare(b.name));

  const platforms: AccessiblePlatform[] = graph.nodes
    .filter(n => n.type === 'platform')
    .map(n => ({
      id: n.id,
      name: n.label,
      sector: n.category,
      description: n.description ?? '',
      faculty: graph.edges
        .filter(e => e.type === 'faculty-platform' && (e.source === n.id || e.target === n.id))
        .map(e => byId.get(e.source === n.id ? e.target : e.source)?.label ?? '')
        .filter(Boolean)
        .sort()
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const verticals: AccessibleVertical[] = graph.nodes
    .filter(n => n.type === 'vertical')
    .map(n => ({
      id: n.id,
      name: n.label,
      sector: n.category,
      faculty: graph.edges
        .filter(e => e.type === 'faculty-vertical' && (e.source === n.id || e.target === n.id))
        .map(e => byId.get(e.source === n.id ? e.target : e.source)?.label ?? '')
        .filter(Boolean)
        .sort()
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const collaborations: AccessibleCollaboration[] = graph.edges
    .filter(e => e.type === 'faculty-faculty')
    .map(e => ({
      facultyA: byId.get(e.source)?.label ?? e.source,
      facultyB: byId.get(e.target)?.label ?? e.target,
      projects: e.projects,
      weight: e.projectCount
    }))
    .sort((a, b) => a.facultyA.localeCompare(b.facultyA) || a.facultyB.localeCompare(b.facultyB));

  return { faculty, platforms, verticals, collaborations, sectors: graph.sectors };
}
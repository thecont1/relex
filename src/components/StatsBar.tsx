import { useEffect, useRef } from 'react';
import { animateCounter } from '../lib/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { GraphModel } from '../lib/types';

/** Format an ISO timestamp as "4 Aug 2026 3:31:30 PM" — no dot, no comma. */
function formatRefreshed(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const month = d.toLocaleString('en-GB', { month: 'short' });
  const year = d.getFullYear();
  const time = d.toLocaleString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).toUpperCase();
  return `${day} ${month} ${year} ${time}`;
}

interface Props {
  graph: GraphModel;
  /** IDs currently visible (after filters/search). */
  visibleNodeIds: Set<string>;
  visibleEdgeIds: Set<string>;
  /** ISO timestamp of last data refresh, or null if never refreshed. */
  refreshedAt: string | null;
}

/**
 * Compact summary bar shown above the graph. Numbers animate on initial
 * mount to draw attention to the dataset. Under reduced motion, they
 * appear with their final values immediately.
 */
export function StatsBar({ graph, visibleNodeIds, visibleEdgeIds, refreshedAt }: Props) {
  const reduced = useReducedMotion();
  const faculty = useRef<HTMLSpanElement | null>(null);
  const verticals = useRef<HTMLSpanElement | null>(null);
  const platforms = useRef<HTMLSpanElement | null>(null);
  const collabs = useRef<HTMLSpanElement | null>(null);
  const visibleNodes = useRef<HTMLSpanElement | null>(null);
  const visibleEdges = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    animateCounter(faculty, graph.counts.faculty, reduced);
    animateCounter(platforms, graph.counts.platforms, reduced);
    animateCounter(verticals, graph.counts.verticals, reduced);
    animateCounter(collabs, graph.counts.edges['faculty-faculty'], reduced);
    // visible counters are not animated to avoid layout churn on every filter change
    if (visibleNodes.current) visibleNodes.current.textContent = String(visibleNodeIds.size);
    if (visibleEdges.current) visibleEdges.current.textContent = String(visibleEdgeIds.size);
  }, [graph, reduced]); // intentionally not depending on visibleX — see comment above

  // Update visible counters immediately when they change
  useEffect(() => {
    if (visibleNodes.current) visibleNodes.current.textContent = String(visibleNodeIds.size);
    if (visibleEdges.current) visibleEdges.current.textContent = String(visibleEdgeIds.size);
  }, [visibleNodeIds, visibleEdgeIds]);

  return (
    <div className="stage-summary" aria-label="Network summary">
      <span className="stat"><strong className="stat-num" ref={faculty}>0</strong> faculty</span>
      <span className="stat"><strong className="stat-num" ref={verticals}>0</strong> verticals</span>
      <span className="stat"><strong className="stat-num" ref={platforms}>0</strong> platforms</span>
      <span className="stat"><strong className="stat-num" ref={collabs}>0</strong> collaborations</span>
      <span className="stat stage-summary__showing" style={{ color: 'var(--text-muted)' }}>
        Showing <strong ref={visibleNodes} style={{ color: 'var(--text-primary)' }}>0</strong>
        {' / '}{graph.nodes.length} nodes, {' '}
        <strong ref={visibleEdges} style={{ color: 'var(--text-primary)' }}>0</strong>
        {' / '}{graph.edges.length} relationships
      </span>
      {refreshedAt && (
        <span className="stat stage-summary__refreshed" title={refreshedAt}>
          refreshed {formatRefreshed(refreshedAt)}
        </span>
      )}
    </div>
  );
}
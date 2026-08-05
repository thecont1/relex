import { MobileSheet } from './MobileSheet';
import type { GraphModel } from '../../lib/types';

interface Props {
  graph: GraphModel;
  nodeId: string | null;
  open: boolean;
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
}

/**
 * Mobile detail drawer — renders the same node detail content as the desktop
 * DetailDrawer, but inside a MobileSheet (bottom sheet) instead of a
 * right-side panel. Capped at 75vh per the plan §3.5.
 */
export function MobileDetailDrawer({ graph, nodeId, open, onClose, onSelectNode }: Props) {
  const node = nodeId ? graph.nodes.find(n => n.id === nodeId) ?? null : null;
  const title = node?.label ?? 'No node selected';

  return (
    <MobileSheet open={open} onClose={onClose} title={title} maxHeight="75vh">
      {node && (
        <div className="mobile-detail-content">
          <div className="mobile-detail-meta">
            {node.type === 'faculty' ? 'Faculty' : node.type === 'platform' ? 'Platform' : 'Research Vertical'}
            {node.category && ` · Sector: ${node.category}`}
          </div>

          {node.description && (
            <p className="mobile-detail-description">{node.description}</p>
          )}

          {node.type === 'faculty' && (
            <FacultyDetailContent graph={graph} nodeId={node.id} onSelectNode={onSelectNode} />
          )}
          {node.type === 'platform' && (
            <PlatformDetailContent graph={graph} nodeId={node.id} onSelectNode={onSelectNode} />
          )}
          {node.type === 'vertical' && (
            <VerticalDetailContent graph={graph} nodeId={node.id} onSelectNode={onSelectNode} />
          )}

          <div className="mobile-detail-connectivity">
            <h3>Connectivity</h3>
            <p>
              Total connections: <strong>{node.degree}</strong>
              {' · '}Platforms: <strong>{node.counts.platforms}</strong>
              {' · '}Verticals: <strong>{node.counts.verticals}</strong>
              {' · '}Collaborators: <strong>{node.counts.collaborators}</strong>
            </p>
          </div>
        </div>
      )}
    </MobileSheet>
  );
}

function FacultyDetailContent({ graph, nodeId, onSelectNode }: { graph: GraphModel; nodeId: string; onSelectNode: (id: string) => void }) {
  const collabEdges = graph.edges.filter(e => e.type === 'faculty-faculty' && (e.source === nodeId || e.target === nodeId));
  const verticals = graph.edges.filter(e => e.type === 'faculty-vertical' && (e.source === nodeId || e.target === nodeId));
  const platforms = graph.edges.filter(e => e.type === 'faculty-platform' && (e.source === nodeId || e.target === nodeId));
  const byId = new Map(graph.nodes.map(n => [n.id, n]));

  return (
    <>
      <div className="mobile-detail-section">
        <h3>Research Verticals ({verticals.length})</h3>
        {verticals.length === 0 ? (
          <p className="mobile-detail-empty">No verticals linked.</p>
        ) : (
          <ul className="mobile-detail-list">
            {verticals.map(e => {
              const otherId = e.source === nodeId ? e.target : e.source;
              const other = byId.get(otherId);
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => onSelectNode(otherId)}>
                    {other?.label ?? otherId}
                  </button>
                  {other?.category && <div className="row-meta">Sector: {other.category}</div>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mobile-detail-section">
        <h3>Platforms ({platforms.length})</h3>
        {platforms.length === 0 ? (
          <p className="mobile-detail-empty">No platforms linked.</p>
        ) : (
          <ul className="mobile-detail-list">
            {platforms.map(e => {
              const otherId = e.source === nodeId ? e.target : e.source;
              const other = byId.get(otherId);
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => onSelectNode(otherId)}>
                    {other?.label ?? otherId}
                  </button>
                  {other?.category && <div className="row-meta">Sector: {other.category}</div>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mobile-detail-section">
        <h3>Collaborators ({collabEdges.length})</h3>
        {collabEdges.length === 0 ? (
          <p className="mobile-detail-empty">No collaborations recorded.</p>
        ) : (
          <ul className="mobile-detail-list">
            {collabEdges.map(e => {
              const otherId = e.source === nodeId ? e.target : e.source;
              const other = byId.get(otherId);
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => onSelectNode(otherId)}>
                    {other?.label ?? otherId}
                  </button>
                  {e.projects.length > 0 && (
                    <div className="row-meta">Projects: {e.projects.join('; ')}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

function PlatformDetailContent({ graph, nodeId, onSelectNode }: { graph: GraphModel; nodeId: string; onSelectNode: (id: string) => void }) {
  const links = graph.edges.filter(e => e.type === 'faculty-platform' && (e.source === nodeId || e.target === nodeId));
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  return (
    <div className="mobile-detail-section">
      <h3>Linked Faculty ({links.length})</h3>
      {links.length === 0 ? (
        <p className="mobile-detail-empty">No faculty linked.</p>
      ) : (
        <ul className="mobile-detail-list">
          {links.map(e => {
            const otherId = e.source === nodeId ? e.target : e.source;
            const other = byId.get(otherId);
            return (
              <li key={e.id}>
                <button type="button" onClick={() => onSelectNode(otherId)}>
                  {other?.label ?? otherId}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function VerticalDetailContent({ graph, nodeId, onSelectNode }: { graph: GraphModel; nodeId: string; onSelectNode: (id: string) => void }) {
  const links = graph.edges.filter(e => e.type === 'faculty-vertical' && (e.source === nodeId || e.target === nodeId));
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  return (
    <div className="mobile-detail-section">
      <h3>Faculty in this Vertical ({links.length})</h3>
      {links.length === 0 ? (
        <p className="mobile-detail-empty">No faculty linked.</p>
      ) : (
        <ul className="mobile-detail-list">
          {links.map(e => {
            const otherId = e.source === nodeId ? e.target : e.source;
            const other = byId.get(otherId);
            return (
              <li key={e.id}>
                <button type="button" onClick={() => onSelectNode(otherId)}>
                  {other?.label ?? otherId}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

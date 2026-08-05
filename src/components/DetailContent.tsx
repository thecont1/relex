/**
 * Shared detail content for node detail drawers.
 *
 * Extracted from the desktop DetailDrawer so both desktop and mobile
 * wrappers render identical content. Each wrapper provides its own
 * header, close mechanics, and presentation shell.
 *
 * Related-node navigation (clicking a linked faculty/vertical/platform)
 * calls onSelectNode, which the parent uses to update the displayed node
 * and (on mobile) reset scroll position.
 */
import type { GraphModel } from '../lib/types';

interface Props {
  graph: GraphModel;
  node: NonNullable<GraphModel['nodes'][number]>;
  onSelectNode: (nodeId: string) => void;
}

export function DetailContent({ graph, node, onSelectNode }: Props) {
  return (
    <div className="drawer-body">
      {node.description && (
        <div className="drawer-section">
          <h3>Description</h3>
          <p style={{ fontSize: 'var(--fs-sm)' }}>{node.description}</p>
        </div>
      )}

      {node.type === 'faculty' && (
        <FacultyDetail graph={graph} nodeId={node.id} onSelectNode={onSelectNode} />
      )}
      {node.type === 'platform' && (
        <PlatformDetail graph={graph} nodeId={node.id} onSelectNode={onSelectNode} />
      )}
      {node.type === 'vertical' && (
        <VerticalDetail graph={graph} nodeId={node.id} onSelectNode={onSelectNode} />
      )}

      <div className="drawer-section">
        <h3>Connectivity</h3>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
          Total connections: <strong>{node.degree}</strong>
          {' · '}Platforms: <strong>{node.counts.platforms}</strong>
          {' · '}Verticals: <strong>{node.counts.verticals}</strong>
          {' · '}Collaborators: <strong>{node.counts.collaborators}</strong>
        </p>
      </div>
    </div>
  );
}

function FacultyDetail({ graph, nodeId, onSelectNode }: { graph: GraphModel; nodeId: string; onSelectNode: (id: string) => void }) {
  const collabEdges = graph.edges.filter(e => e.type === 'faculty-faculty' && (e.source === nodeId || e.target === nodeId));
  const verticals = graph.edges.filter(e => e.type === 'faculty-vertical' && (e.source === nodeId || e.target === nodeId));
  const platforms = graph.edges.filter(e => e.type === 'faculty-platform' && (e.source === nodeId || e.target === nodeId));
  const byId = new Map(graph.nodes.map(n => [n.id, n]));

  return (
    <>
      <div className="drawer-section">
        <h3>Research Verticals ({verticals.length})</h3>
        {verticals.length === 0 ? (
          <p className="drawer-empty">No verticals linked.</p>
        ) : (
          <ul className="drawer-list">
            {verticals.map(e => {
              const otherId = e.source === nodeId ? e.target : e.source;
              const other = byId.get(otherId);
              return (
                <li key={e.id}>
                  <button type="button" className="btn" style={{ background: 'transparent', border: 'none', padding: 0, color: 'var(--text-primary)' }}
                          onClick={() => onSelectNode(otherId)}>
                    {other?.label ?? otherId}
                  </button>
                  {other?.category && <div className="row-meta">Sector: {other.category}</div>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="drawer-section">
        <h3>Platforms ({platforms.length})</h3>
        {platforms.length === 0 ? (
          <p className="drawer-empty">No platforms linked.</p>
        ) : (
          <ul className="drawer-list">
            {platforms.map(e => {
              const otherId = e.source === nodeId ? e.target : e.source;
              const other = byId.get(otherId);
              return (
                <li key={e.id}>
                  <button type="button" className="btn" style={{ background: 'transparent', border: 'none', padding: 0, color: 'var(--text-primary)' }}
                          onClick={() => onSelectNode(otherId)}>
                    {other?.label ?? otherId}
                  </button>
                  {other?.category && <div className="row-meta">Sector: {other.category}</div>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="drawer-section">
        <h3>Collaborators ({collabEdges.length})</h3>
        {collabEdges.length === 0 ? (
          <p className="drawer-empty">No collaborations recorded.</p>
        ) : (
          <ul className="drawer-list">
            {collabEdges.map(e => {
              const otherId = e.source === nodeId ? e.target : e.source;
              const other = byId.get(otherId);
              return (
                <li key={e.id}>
                  <button type="button" className="btn" style={{ background: 'transparent', border: 'none', padding: 0, color: 'var(--text-primary)' }}
                          onClick={() => onSelectNode(otherId)}>
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

function PlatformDetail({ graph, nodeId, onSelectNode }: { graph: GraphModel; nodeId: string; onSelectNode: (id: string) => void }) {
  const links = graph.edges.filter(e => e.type === 'faculty-platform' && (e.source === nodeId || e.target === nodeId));
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  return (
    <div className="drawer-section">
      <h3>Linked Faculty ({links.length})</h3>
      {links.length === 0 ? (
        <p className="drawer-empty">No faculty linked.</p>
      ) : (
        <ul className="drawer-list">
          {links.map(e => {
            const otherId = e.source === nodeId ? e.target : e.source;
            const other = byId.get(otherId);
            return (
              <li key={e.id}>
                <button type="button" className="btn" style={{ background: 'transparent', border: 'none', padding: 0, color: 'var(--text-primary)' }}
                        onClick={() => onSelectNode(otherId)}>
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

function VerticalDetail({ graph, nodeId, onSelectNode }: { graph: GraphModel; nodeId: string; onSelectNode: (id: string) => void }) {
  const links = graph.edges.filter(e => e.type === 'faculty-vertical' && (e.source === nodeId || e.target === nodeId));
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  return (
    <div className="drawer-section">
      <h3>Faculty in this Vertical ({links.length})</h3>
      {links.length === 0 ? (
        <p className="drawer-empty">No faculty linked.</p>
      ) : (
        <ul className="drawer-list">
          {links.map(e => {
            const otherId = e.source === nodeId ? e.target : e.source;
            const other = byId.get(otherId);
            return (
              <li key={e.id}>
                <button type="button" className="btn" style={{ background: 'transparent', border: 'none', padding: 0, color: 'var(--text-primary)' }}
                        onClick={() => onSelectNode(otherId)}>
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

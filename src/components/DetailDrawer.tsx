import { useEffect, useRef } from 'react';
import { IconClose } from './Icons';
import { focusDrawerCloseButton, restoreFocusAfterDrawer, rememberFocusBeforeDrawer } from '../lib/focusManager';
import type { GraphModel } from '../lib/types';

interface Props {
  graph: GraphModel;
  nodeId: string | null;
  open: boolean;
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
}

export function DetailDrawer({ graph, nodeId, open, onClose, onSelectNode }: Props) {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open) {
      rememberFocusBeforeDrawer();
      focusDrawerCloseButton(closeBtnRef.current);
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    } else {
      restoreFocusAfterDrawer();
    }
  }, [open, onClose]);

  const node = nodeId ? graph.nodes.find(n => n.id === nodeId) ?? null : null;

  return (
    <>
      <div
        className={'drawer-backdrop' + (open ? ' open' : '')}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={'drawer' + (open ? ' open' : '')}
        role="dialog"
        aria-modal="false"
        aria-labelledby="drawer-title"
        aria-hidden={!open}
      >
        <div className="drawer-header">
          <div>
            <div className="meta">
              {node ? (node.type === 'faculty' ? 'Faculty' : node.type === 'platform' ? 'Platform' : 'Research Vertical') : 'Node'}
            </div>
            <h2 id="drawer-title">{node?.label ?? 'No node selected'}</h2>
            {node?.category && (
              <div className="meta" style={{ marginTop: 4 }}>Sector: {node.category}</div>
            )}
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="drawer-close"
            aria-label="Close detail drawer"
            onClick={onClose}
          >
            <IconClose />
          </button>
        </div>

        {node && (
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
        )}
      </aside>
    </>
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
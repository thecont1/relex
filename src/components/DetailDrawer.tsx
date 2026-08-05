import { useEffect, useRef } from 'react';
import { IconClose } from './Icons';
import { DetailContent } from './DetailContent';
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
          <DetailContent graph={graph} node={node} onSelectNode={onSelectNode} />
        )}
      </aside>
    </>
  );
}

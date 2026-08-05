import { MobileSheet } from './MobileSheet';
import { DetailContent } from '../DetailContent';
import type { GraphModel } from '../../lib/types';

interface Props {
  graph: GraphModel;
  nodeId: string | null;
  open: boolean;
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
}

/**
 * Mobile detail drawer — renders the same DetailContent as the desktop
 * DetailDrawer, but inside a MobileSheet (bottom sheet) instead of a
 * right-side panel. Capped at 75vh per the plan §3.5.
 */
export function MobileDetailDrawer({ graph, nodeId, open, onClose, onSelectNode }: Props) {
  const node = nodeId ? graph.nodes.find(n => n.id === nodeId) ?? null : null;
  const title = node?.label ?? 'No node selected';

  return (
    <MobileSheet open={open} onClose={onClose} title={title} maxHeight="75vh">
      {node && (
        <>
          <div className="mobile-detail-meta">
            {node.type === 'faculty' ? 'Faculty' : node.type === 'platform' ? 'Platform' : 'Research Vertical'}
            {node.category && ` · Sector: ${node.category}`}
          </div>
          <DetailContent graph={graph} node={node} onSelectNode={onSelectNode} />
        </>
      )}
    </MobileSheet>
  );
}

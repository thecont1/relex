import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { buildAccessibleModel } from '../lib/buildAccessibleModel';
import { sectorColor } from '../lib/colorSystem';
import type { GraphFilters, GraphModel, NodeType } from '../lib/types';

interface Props {
  graph: GraphModel;
  filters: GraphFilters;
  onSelectNode: (nodeId: string) => void;
  /** Shared entity focus used by search and cross-links. */
  focusedNodeId?: string | null;
  onFocusNode?: (nodeId: string | null) => void;
  /** Compact mode for mobile: single-column, tighter spacing. */
  compact?: boolean;
}

/**
 * Semantic equivalent of the visual graph. The same filtered data is rendered
 * as scannable entity lists, with cross-links that create an in-page point of
 * view. If a linked entity is hidden by the current filters, its detail drawer
 * is opened instead of navigating to a missing section.
 */
export function AccessibleView({
  graph,
  filters,
  onSelectNode,
  focusedNodeId,
  onFocusNode,
  compact,
}: Props) {
  const accessible = useMemo(() => buildAccessibleModel(graph), [graph]);
  const [localFocusId, setLocalFocusId] = useState<string | null>(null);
  const activeFocusId = focusedNodeId === undefined ? localFocusId : focusedNodeId;
  const onSelectNodeRef = useRef(onSelectNode);
  onSelectNodeRef.current = onSelectNode;

  const nodeById = useMemo(() => new Map(graph.nodes.map(node => [node.id, node])), [graph]);
  const idByName = useMemo(() => new Map(graph.nodes.map(node => [node.label, node.id])), [graph]);

  const visibleFacultyIds = useMemo(() => {
    const out = new Set<string>();
    for (const faculty of accessible.faculty) {
      if (filters.activeSectors.size > 0) {
        const allSectors = new Set<string>();
        for (const name of faculty.verticals) {
          const vertical = accessible.verticals.find(item => item.name === name);
          if (vertical?.sector) allSectors.add(vertical.sector);
        }
        for (const name of faculty.platforms) {
          const platform = accessible.platforms.find(item => item.name === name);
          if (platform?.sector) allSectors.add(platform.sector);
        }
        if (!Array.from(allSectors).some(sector => filters.activeSectors.has(sector))) continue;
      }
      out.add(faculty.id);
    }
    return out;
  }, [accessible, filters.activeSectors]);

  const visibleVerticalNames = useMemo(() => {
    if (!filters.showVerticals) return new Set<string>();
    return new Set(accessible.verticals
      .filter(vertical => filters.activeSectors.size === 0 || (!!vertical.sector && filters.activeSectors.has(vertical.sector)))
      .map(vertical => vertical.name));
  }, [accessible.verticals, filters.activeSectors, filters.showVerticals]);

  const visiblePlatformNames = useMemo(() => {
    if (!filters.showPlatforms) return new Set<string>();
    return new Set(accessible.platforms
      .filter(platform => filters.activeSectors.size === 0 || (!!platform.sector && filters.activeSectors.has(platform.sector)))
      .map(platform => platform.name));
  }, [accessible.platforms, filters.activeSectors, filters.showPlatforms]);

  const visibleCollaborations = useMemo(() => {
    if (!filters.showCollaborations) return [];
    return accessible.collaborations.filter(collaboration => {
      const facultyAId = idByName.get(collaboration.facultyA);
      const facultyBId = idByName.get(collaboration.facultyB);
      return !!facultyAId && !!facultyBId && visibleFacultyIds.has(facultyAId) && visibleFacultyIds.has(facultyBId);
    });
  }, [accessible.collaborations, filters.showCollaborations, idByName, visibleFacultyIds]);

  const visibleAffiliationCounts = useMemo(() => {
    let verticals = 0;
    let platforms = 0;
    for (const edge of graph.edges) {
      if (edge.type === 'faculty-vertical' && filters.showVerticals) {
        const facultyId = nodeById.get(edge.source)?.type === 'faculty' ? edge.source : edge.target;
        const verticalId = facultyId === edge.source ? edge.target : edge.source;
        const vertical = nodeById.get(verticalId);
        if (visibleFacultyIds.has(facultyId) && !!vertical && visibleVerticalNames.has(vertical.label)) verticals += 1;
      }
      if (edge.type === 'faculty-platform' && filters.showPlatforms) {
        const facultyId = nodeById.get(edge.source)?.type === 'faculty' ? edge.source : edge.target;
        const platformId = facultyId === edge.source ? edge.target : edge.source;
        const platform = nodeById.get(platformId);
        if (visibleFacultyIds.has(facultyId) && !!platform && visiblePlatformNames.has(platform.label)) platforms += 1;
      }
    }
    return { verticals, platforms };
  }, [filters.showPlatforms, filters.showVerticals, graph.edges, nodeById, visibleFacultyIds, visiblePlatformNames, visibleVerticalNames]);

  const groupedCollaborations = useMemo(() => {
    const groups = new Map<string, typeof visibleCollaborations>();
    for (const collaboration of visibleCollaborations) {
      const existing = groups.get(collaboration.facultyA) ?? [];
      existing.push(collaboration);
      groups.set(collaboration.facultyA, existing);
    }
    return Array.from(groups.entries());
  }, [visibleCollaborations]);

  const focusIds = useMemo(() => {
    if (!activeFocusId) return null;
    const node = nodeById.get(activeFocusId);
    return new Set([activeFocusId, ...(node?.connectedIds ?? [])]);
  }, [activeFocusId, nodeById]);

  const setFocus = (nodeId: string | null) => {
    if (focusedNodeId === undefined) setLocalFocusId(nodeId);
    onFocusNode?.(nodeId);
  };

  const scrollToEntity = (nodeId: string) => {
    setFocus(nodeId);
    requestAnimationFrame(() => {
      const target = document.getElementById(entityAnchor(nodeId));
      if (!target) {
        onSelectNode(nodeId);
        return;
      }
      if (target instanceof HTMLDetailsElement) target.open = true;
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      target.focus({ preventScroll: true });
    });
  };

  useEffect(() => {
    if (!activeFocusId) return;
    const target = document.getElementById(entityAnchor(activeFocusId));
    if (!target) {
      // A search or cross-link may target an entity hidden by current filters.
      // Preserve useful navigation by showing its relationship detail instead
      // of silently doing nothing.
      onSelectNodeRef.current(activeFocusId);
      return;
    }
    if (target instanceof HTMLDetailsElement) target.open = true;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    target.focus({ preventScroll: true });
  }, [activeFocusId]);

  const focusClass = (nodeIds: Array<string | undefined>) => {
    if (!focusIds) return '';
    return nodeIds.some(id => !!id && focusIds.has(id)) ? ' is-focus-match' : ' is-focus-dimmed';
  };

  const entityLink = (name: string, extraClass = '') => {
    const id = idByName.get(name);
    if (!id) return <span>{name}</span>;
    return (
      <button
        type="button"
        className={`acc-entity-link ${extraClass}`.trim()}
        onClick={() => scrollToEntity(id)}
      >
        {name}
      </button>
    );
  };

  const focusedNode = activeFocusId ? nodeById.get(activeFocusId) : null;

  return (
    <div className={'accessible-view' + (compact ? ' accessible-view--compact' : '')} role="region" aria-labelledby="accessible-heading">
      <header className="acc-intro">
        <h2 id="accessible-heading">Explore the network</h2>
        <p className="lede">
          Browse faculty, research verticals, platforms, and collaborations as linked records.
          {filters.activeSectors.size > 0 || !filters.showVerticals || !filters.showPlatforms || !filters.showCollaborations
            ? ' Active filters are applied.'
            : ''}
        </p>
      </header>

      {focusedNode && (
        <aside className="acc-focus-bar" aria-label="Entity focus">
          <div>
            <span className="acc-focus-bar__label">Focused {entityTypeLabel(focusedNode.type)}</span>
            <strong>{focusedNode.label}</strong>
          </div>
          <div className="acc-focus-bar__actions">
            <button type="button" className="acc-text-action" onClick={() => onSelectNode(focusedNode.id)}>View details</button>
            <button type="button" className="acc-text-action" onClick={() => setFocus(null)}>Clear focus</button>
          </div>
        </aside>
      )}

      <section aria-labelledby="acc-summary-heading">
        <h3 id="acc-summary-heading">Summary</h3>
        <dl className="acc-summary-list">
          <div><dt>Faculty</dt><dd>{visibleFacultyIds.size}/{graph.counts.faculty}</dd></div>
          <div><dt>Research verticals</dt><dd>{visibleVerticalNames.size}/{graph.counts.verticals}</dd></div>
          <div><dt>Platforms</dt><dd>{visiblePlatformNames.size}/{graph.counts.platforms}</dd></div>
          <div><dt>Collaborations</dt><dd>{visibleCollaborations.length}/{graph.counts.edges['faculty-faculty']}</dd></div>
          <div><dt>Faculty–vertical links</dt><dd>{visibleAffiliationCounts.verticals}/{graph.counts.edges['faculty-vertical']}</dd></div>
          <div><dt>Faculty–platform links</dt><dd>{visibleAffiliationCounts.platforms}/{graph.counts.edges['faculty-platform']}</dd></div>
        </dl>
      </section>

      {accessible.sectors.length > 0 && (
        <section aria-labelledby="acc-sectors-heading">
          <h3 id="acc-sectors-heading">Sectors</h3>
          <ul className="acc-sector-list">
            {accessible.sectors.map(sector => {
              const color = sectorColor(sector, accessible.sectors);
              return (
                <li key={sector}>
                  <span aria-hidden="true" style={{ background: color.fill, borderColor: color.border }} />
                  {sector}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="acc-faculty-heading">
        <div className="acc-section-heading">
          <h3 id="acc-faculty-heading">Faculty</h3>
          <span>{visibleFacultyIds.size} shown</span>
        </div>
        <p className="acc-section-note">Sorted by most-connected first. Open a record to browse its relationships.</p>
        <div className="acc-grid">
          {accessible.faculty.filter(faculty => visibleFacultyIds.has(faculty.id)).map(faculty => {
            const visibleVerticals = faculty.verticals.filter(name => visibleVerticalNames.has(name));
            const visiblePlatforms = faculty.platforms.filter(name => visiblePlatformNames.has(name));
            const visibleCollaborators = faculty.collaborators.filter(item => {
              const id = idByName.get(item.name);
              return filters.showCollaborations && !!id && visibleFacultyIds.has(id);
            });
            return (
              <details
                id={entityAnchor(faculty.id)}
                tabIndex={-1}
                className={`acc-disclose${focusClass([faculty.id])}`}
                key={faculty.id}
                onToggle={(event) => {
                  if (event.currentTarget.open) setFocus(faculty.id);
                }}
              >
                <summary>
                  <span>{faculty.name}</span>
                  <span className="acc-connection-count">{faculty.degree} connections</span>
                </summary>
                <div className="acc-disclose-body">
                  <RelationshipList title="Research verticals" empty="None shown." items={visibleVerticals.map(name => ({ key: name, content: entityLink(name) }))} />
                  <RelationshipList title="Platforms" empty="None shown." items={visiblePlatforms.map(name => ({ key: name, content: entityLink(name) }))} />
                  <RelationshipList
                    title="Collaborators and projects"
                    empty="None shown."
                    items={visibleCollaborators.map(collaborator => ({
                      key: collaborator.name,
                      content: <>{entityLink(collaborator.name)}{collaborator.projects.length > 0 && <span className="acc-row-meta">{collaborator.projects.join('; ')}</span>}</>,
                    }))}
                  />
                  <button type="button" className="acc-text-action acc-detail-action" onClick={() => onSelectNode(faculty.id)}>View faculty details</button>
                </div>
              </details>
            );
          })}
        </div>
      </section>

      {filters.showVerticals && accessible.verticals.length > 0 && (
        <section aria-labelledby="acc-verticals-heading">
          <div className="acc-section-heading">
            <h3 id="acc-verticals-heading">Research verticals</h3>
            <span>{visibleVerticalNames.size} shown</span>
          </div>
          <div className="acc-entity-list">
            {accessible.verticals.filter(vertical => visibleVerticalNames.has(vertical.name)).map(vertical => (
              <article id={entityAnchor(vertical.id)} tabIndex={-1} className={`acc-entity-card${focusClass([vertical.id])}`} key={vertical.id}>
                <h4>{vertical.name}</h4>
                <p className="acc-entity-meta">Sector: {vertical.sector ?? 'Not recorded'}</p>
                <p><span className="acc-field-label">Faculty</span> {vertical.faculty.length > 0 ? intersperseEntityLinks(vertical.faculty, entityLink) : 'None recorded.'}</p>
                <button type="button" className="acc-text-action" onClick={() => onSelectNode(vertical.id)}>View vertical details</button>
              </article>
            ))}
          </div>
        </section>
      )}

      {filters.showPlatforms && accessible.platforms.length > 0 && (
        <section aria-labelledby="acc-platforms-heading">
          <div className="acc-section-heading">
            <h3 id="acc-platforms-heading">Platforms</h3>
            <span>{visiblePlatformNames.size} shown</span>
          </div>
          <div className="acc-entity-list">
            {accessible.platforms.filter(platform => visiblePlatformNames.has(platform.name)).map(platform => (
              <article id={entityAnchor(platform.id)} tabIndex={-1} className={`acc-entity-card${focusClass([platform.id])}`} key={platform.id}>
                <h4>{platform.name}</h4>
                <p className="acc-entity-meta">Sector: {platform.sector ?? 'Not recorded'}</p>
                {platform.description && <p>{platform.description}</p>}
                <p><span className="acc-field-label">Faculty</span> {platform.faculty.length > 0 ? intersperseEntityLinks(platform.faculty, entityLink) : 'None recorded.'}</p>
                <button type="button" className="acc-text-action" onClick={() => onSelectNode(platform.id)}>View platform details</button>
              </article>
            ))}
          </div>
        </section>
      )}

      {filters.showCollaborations && (
        <section aria-labelledby="acc-collabs-heading">
          <div className="acc-section-heading">
            <h3 id="acc-collabs-heading">Collaborations</h3>
            <span>{visibleCollaborations.length} shown</span>
          </div>
          {groupedCollaborations.length === 0 ? (
            <p className="acc-empty">No collaborations match the current filters.</p>
          ) : (
            <div className="acc-collaboration-list">
              {groupedCollaborations.map(([facultyA, collaborations]) => {
                const facultyAId = idByName.get(facultyA);
                return (
                  <article className={`acc-collaboration-group${focusClass([facultyAId, ...collaborations.map(item => idByName.get(item.facultyB))])}`} key={facultyA}>
                    <h4>{entityLink(facultyA, 'acc-collaboration-group__faculty')}</h4>
                    <ul>
                      {collaborations.map(collaboration => (
                        <li key={`${collaboration.facultyB}:${collaboration.projects.join('|')}`}>
                          {entityLink(collaboration.facultyB)}
                          <span className="acc-collaboration-topic">{collaboration.projects.length > 0 ? collaboration.projects.join('; ') : 'Topic not recorded'}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function RelationshipList({ title, items, empty }: { title: string; items: Array<{ key: string; content: ReactNode }>; empty: string }) {
  return (
    <section className="acc-relationship-group">
      <h4>{title}</h4>
      {items.length === 0 ? <p className="acc-empty">{empty}</p> : <ul>{items.map(item => <li key={item.key}>{item.content}</li>)}</ul>}
    </section>
  );
}

function intersperseEntityLinks(names: string[], render: (name: string) => ReactNode): ReactNode[] {
  return names.map((name, index) => (
    <Fragment key={name}>
      {index > 0 && ', '}
      {render(name)}
    </Fragment>
  ));
}

function entityAnchor(nodeId: string): string {
  return `acc-entity-${encodeURIComponent(nodeId)}`;
}

function entityTypeLabel(type: NodeType): string {
  if (type === 'faculty') return 'faculty member';
  if (type === 'vertical') return 'research vertical';
  return 'platform';
}

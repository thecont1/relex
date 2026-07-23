import { useMemo } from 'react';
import { buildAccessibleModel } from '../lib/buildAccessibleModel';
import { sectorColor } from '../lib/colorSystem';
import type { GraphFilters, GraphModel } from '../lib/types';

interface Props {
  graph: GraphModel;
  filters: GraphFilters;
  onSelectNode: (nodeId: string) => void;
}

/**
 * Semantic equivalent of the visual graph. Provides:
 * - a textual summary of the network
 * - per-faculty expandable sections with collaborators, verticals, platforms
 * - tabular lists of all platforms, verticals, and collaborations
 *
 * The view always reflects the underlying dataset. When filters are active
 * in the visual graph, we mirror them here so both views stay in sync.
 */
export function AccessibleView({ graph, filters, onSelectNode }: Props) {
  const accessible = useMemo(() => buildAccessibleModel(graph), [graph]);

  // Apply the same visibility rules used for the visual graph.
  const visibleFacultyIds = useMemo(() => {
    const out = new Set<string>();
    for (const f of accessible.faculty) {
      // faculty always considered; sector filter applies below
      if (filters.activeSectors.size > 0) {
        const allSectors = new Set<string>();
        for (const v of f.verticals) {
          const vert = accessible.verticals.find(x => x.name === v);
          if (vert?.sector) allSectors.add(vert.sector);
        }
        for (const p of f.platforms) {
          const plat = accessible.platforms.find(x => x.name === p);
          if (plat?.sector) allSectors.add(plat.sector);
        }
        let anyMatch = false;
        for (const s of allSectors) if (filters.activeSectors.has(s)) { anyMatch = true; break; }
        if (!anyMatch) continue;
      }
      out.add(f.id);
    }
    return out;
  }, [accessible, filters]);

  const visibleVerticalNames = useMemo(() => {
    if (!filters.showVerticals) return new Set<string>();
    const out = new Set<string>();
    for (const v of accessible.verticals) {
      if (filters.activeSectors.size > 0) {
        if (!v.sector || !filters.activeSectors.has(v.sector)) continue;
      }
      out.add(v.name);
    }
    return out;
  }, [accessible, filters]);

  const visiblePlatformNames = useMemo(() => {
    if (!filters.showPlatforms) return new Set<string>();
    const out = new Set<string>();
    for (const p of accessible.platforms) {
      if (filters.activeSectors.size > 0) {
        if (!p.sector || !filters.activeSectors.has(p.sector)) continue;
      }
      out.add(p.name);
    }
    return out;
  }, [accessible, filters]);

  return (
    <div className="accessible-view" role="region" aria-labelledby="accessible-heading">
      <h2 id="accessible-heading">Accessible View of the CeNSE Ecosystem</h2>
      <p className="lede">
        The data below mirrors the visual network diagram. Use this view if you prefer reading the
        information as lists and tables rather than navigating a spatial graph.
        {filters.activeSectors.size > 0 || !filters.showVerticals || !filters.showPlatforms || !filters.showCollaborations
          ? ' The active filters from the visual view are applied here as well.'
          : ''}
      </p>

      {/* ----- Summary table ----- */}
      <section aria-labelledby="acc-summary-heading">
        <h3 id="acc-summary-heading">Summary</h3>
        <table className="acc-table">
          <caption className="sr-only">Network totals by node and relationship type</caption>
          <thead>
            <tr><th scope="col">Metric</th><th scope="col">Total</th><th scope="col">Currently shown</th></tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Faculty</th>
              <td>{graph.counts.faculty}</td>
              <td>{visibleFacultyIds.size}</td>
            </tr>
            <tr>
              <th scope="row">Research Verticals</th>
              <td>{graph.counts.verticals}</td>
              <td>{visibleVerticalNames.size}</td>
            </tr>
            <tr>
              <th scope="row">Platforms</th>
              <td>{graph.counts.platforms}</td>
              <td>{visiblePlatformNames.size}</td>
            </tr>
            <tr>
              <th scope="row">Collaborations</th>
              <td>{graph.counts.edges['faculty-faculty']}</td>
              <td>{filters.showCollaborations ? graph.counts.edges['faculty-faculty'] : 0}</td>
            </tr>
            <tr>
              <th scope="row">Faculty–Vertical affiliations</th>
              <td>{graph.counts.edges['faculty-vertical']}</td>
              <td>{filters.showVerticals ? graph.counts.edges['faculty-vertical'] : 0}</td>
            </tr>
            <tr>
              <th scope="row">Faculty–Platform affiliations</th>
              <td>{graph.counts.edges['faculty-platform']}</td>
              <td>{filters.showPlatforms ? graph.counts.edges['faculty-platform'] : 0}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ----- Sector index ----- */}
      {accessible.sectors.length > 0 && (
        <section aria-labelledby="acc-sectors-heading">
          <h3 id="acc-sectors-heading">Sectors</h3>
          <ul className="legend-list" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {accessible.sectors.map(s => {
              const c = sectorColor(s, accessible.sectors);
              return (
                <li key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span aria-hidden="true" style={{ width: 12, height: 12, background: c.fill, border: `1px solid ${c.border}`, borderRadius: 2 }} />
                  {s}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ----- Faculty ----- */}
      <section aria-labelledby="acc-faculty-heading">
        <h3 id="acc-faculty-heading">Faculty ({accessible.faculty.length})</h3>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
          Sorted by most-connected first. Each entry opens to show linked verticals, platforms, and collaborators.
        </p>
        <div className="acc-grid">
          {accessible.faculty.filter(f => visibleFacultyIds.has(f.id)).map(f => (
            <details className="acc-disclose" key={f.id}>
              <summary>
                <span>{f.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                  {f.degree} connections
                </span>
              </summary>
              <div className="acc-disclose-body">
                <h4 style={{ fontSize: 'var(--fs-sm)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                  Research Verticals
                </h4>
                {f.verticals.length === 0 ? <p>None recorded.</p> : (
                  <ul>{f.verticals.map(v => <li key={v}>{v}</li>)}</ul>
                )}

                <h4 style={{ fontSize: 'var(--fs-sm)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginTop: 12 }}>
                  Platforms
                </h4>
                {f.platforms.length === 0 ? <p>None recorded.</p> : (
                  <ul>{f.platforms.map(p => <li key={p}>{p}</li>)}</ul>
                )}

                <h4 style={{ fontSize: 'var(--fs-sm)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginTop: 12 }}>
                  Collaborators and Projects
                </h4>
                {f.collaborators.length === 0 ? <p>None recorded.</p> : (
                  <ul>
                    {f.collaborators.map(c => (
                      <li key={c.name}>
                        <strong>{c.name}</strong>
                        {c.projects.length > 0 && <div style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)' }}>{c.projects.join('; ')}</div>}
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  type="button"
                  className="btn"
                  style={{ marginTop: 12 }}
                  onClick={() => onSelectNode(f.id)}
                >
                  Open in detail drawer
                </button>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* ----- Research Verticals ----- */}
      {filters.showVerticals && accessible.verticals.length > 0 && (
        <section aria-labelledby="acc-verticals-heading">
          <h3 id="acc-verticals-heading">Research Verticals</h3>
          <table className="acc-table">
            <caption className="sr-only">Research verticals with their sector and linked faculty</caption>
            <thead>
              <tr><th scope="col">Vertical</th><th scope="col">Sector</th><th scope="col">Faculty</th></tr>
            </thead>
            <tbody>
              {accessible.verticals
                .filter(v => visibleVerticalNames.has(v.name))
                .map(v => (
                <tr key={v.id}>
                  <th scope="row">{v.name}</th>
                  <td>{v.sector ?? '—'}</td>
                  <td>{v.faculty.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ----- Platforms ----- */}
      {filters.showPlatforms && accessible.platforms.length > 0 && (
        <section aria-labelledby="acc-platforms-heading">
          <h3 id="acc-platforms-heading">Platforms</h3>
          <table className="acc-table">
            <caption className="sr-only">Platforms with their sector, description, and linked faculty</caption>
            <thead>
              <tr><th scope="col">Platform</th><th scope="col">Sector</th><th scope="col">Description</th><th scope="col">Faculty</th></tr>
            </thead>
            <tbody>
              {accessible.platforms
                .filter(p => visiblePlatformNames.has(p.name))
                .map(p => (
                <tr key={p.id}>
                  <th scope="row">{p.name}</th>
                  <td>{p.sector ?? '—'}</td>
                  <td>{p.description || '—'}</td>
                  <td>{p.faculty.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ----- Collaborations ----- */}
      {filters.showCollaborations && accessible.collaborations.length > 0 && (
        <section aria-labelledby="acc-collabs-heading">
          <h3 id="acc-collabs-heading">Collaborations</h3>
          <table className="acc-table">
            <caption className="sr-only">All faculty-faculty collaborations with merged project topics</caption>
            <thead>
              <tr><th scope="col">Faculty A</th><th scope="col">Faculty B</th><th scope="col">Projects / Topics</th></tr>
            </thead>
            <tbody>
              {accessible.collaborations.map((c, i) => (
                <tr key={i}>
                  <th scope="row">{c.facultyA}</th>
                  <td>{c.facultyB}</td>
                  <td>{c.projects.length ? c.projects.join('; ') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
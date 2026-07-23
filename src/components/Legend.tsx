/**
 * Visual legend describing only the three node shapes. Sectors now live in
 * the SectorFilter above as clickable chips (which double as the color key).
 */
export function Legend() {
  return (
    <div className="control-section" aria-labelledby="legend-heading">
      <h2 id="legend-heading">Legend</h2>
      <div className="legend-list">
        <div className="legend-row shape-circle">
          <span className="swatch" style={{ background: 'var(--text-primary)' }} aria-hidden="true" />
          <span>Faculty (circle)</span>
        </div>
        <div className="legend-row shape-square">
          <span className="swatch" style={{ background: '#5fb8d1', border: '1px solid #a8e0ee' }} aria-hidden="true" />
          <span>Platform (rounded square)</span>
        </div>
        <div className="legend-row shape-hex">
          <span className="swatch" style={{ background: '#b58cd6', border: '1px solid #d3b6ec' }} aria-hidden="true" />
          <span>Research Vertical (hexagon)</span>
        </div>
      </div>
    </div>
  );
}
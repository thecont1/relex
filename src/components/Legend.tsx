/**
 * Visual legend describing only the three node shapes. Sectors now live in
 * the SectorFilter above as clickable chips (which double as the color key).
 *
 * Shapes are frame-only (no fill) with a stroke, enlarged for legibility.
 * Shape descriptors (circle, rounded square, etc.) are omitted — the shape
 * itself is the descriptor.
 */
export function Legend() {
  return (
    <div className="control-section" aria-labelledby="legend-heading">
      <h2 id="legend-heading">Legend</h2>
      <div className="legend-list">
        <div className="legend-row shape-circle">
          <span className="swatch" aria-hidden="true" />
          <span>Faculty</span>
        </div>
        <div className="legend-row shape-rect">
          <span className="swatch" aria-hidden="true" />
          <span>Platform</span>
        </div>
        <div className="legend-row shape-hex">
          <span className="swatch" aria-hidden="true" />
          <span>Research Vertical</span>
        </div>
      </div>
    </div>
  );
}
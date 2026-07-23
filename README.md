# relex: The Interactive Network Relationship Explorer

A browser-based, accessible visualization tool for exploring organizational networks as interactive graphs. Designed for departments, research groups, or any ecosystem that can be modeled as nodes (people, platforms, domains) and their relationships.

Built for intranet deployment: no backend, no database, no admin tooling. The data workbook is the only editable source of truth.

## Quick start

```bash
bun install
bun run dev       # http://127.0.0.1:5173
bun run build     # type-check + production build → dist/
bun run preview   # serve dist/ on http://127.0.0.1:4173
```

Node ≥ 20 and Bun ≥ 1.3 are required.

## How to update the data

1. Edit the Excel workbook in `public/data/` using Excel / Numbers / LibreOffice / Google Sheets.
2. Drop the updated file in place. The workbook is fetched on every page load (cache-busted). No redeploy is required.
3. Users can also click **Refresh data** in the app to re-fetch without reloading the page.

## Required workbook schema

The workbook is validated on load. Sheet names and column names must match exactly. Mismatches are surfaced as a fatal error in the UI.

This schema was designed for a university research centre's ecosystem (faculty, platforms, research verticals, collaborations). The structure can be customized to model any network or ecosystem by adapting the sheet names and columns to your domain.

| Sheet                | Required columns                              |
|----------------------|-----------------------------------------------|
| `Platforms`          | `Platform ID`, `Platform`, `Description`, `Sector` |
| `Faculty`            | `Faculty ID`, `Faculty`                       |
| `Faculty_Platforms`  | `Faculty`, `Platform`                         |
| `Research_Verticals` | `Vertical ID`, `Research Vertical`, `Sector`  |
| `Faculty_Verticals`  | `Faculty`, `Research Vertical`                |
| `Collaborations`     | `Faculty A`, `Faculty B`, `Project/Topic`     |

Non-fatal warnings are surfaced for blank sectors, unknown references in relationship sheets, duplicate rows, and malformed collaboration rows.

## Default view choice (and justification)

First load shows **people + domains + person–person collaboration edges**. Infrastructure/platform nodes are off by default but one click reveals them.

Why: the narrative for most organizational presentations is *people*, *what they work on* (domains), and *who they work with* (collaboration edges). Infrastructure reads as ambient noise on first glance. The legend and accessible view still show all node shapes so users see the complete system; they can compose any view they want with the layer toggles.

## Accessibility

- WCAG 2.1 AA contrast verified across primary surfaces.
- Light and dark theme modes available via toggle in the bottom-right corner.
- `prefers-reduced-motion` respected throughout (animations collapse to final state).
- Keyboard-operable across the whole app. Press <kbd>Tab</kbd> to walk through controls, <kbd>Enter</kbd> in the search box to focus a person, <kbd>Esc</kbd> to close the drawer.
- A semantic **Accessible View** is one click away and exposes the same data as sortable, expandable lists and tables — no information loss relative to the visual graph.

## Visualization libraries

| Library | Version | Purpose |
|---------|---------|---------|
| Cytoscape | 3.30.2 | 2D graph rendering engine with force-directed layout, interactive pan/zoom, and comprehensive styling for the flat view |
| Cytoscape-fcose | 2.2.0 | Fast layout algorithm that organizes nodes into aspect-aware bands to prevent edge crossings |
| Cytoscape-svg | 0.4.0 | SVG export functionality for the graph |
| 3D Force Graph | 1.80.0 | 3D spherical network visualization for the globe view |
| Three.js | 0.185.1 | WebGL rendering engine powering the 3D globe visualization |
| XLSX (SheetJS) | 0.18.5 | Excel workbook parsing for data loading |
| GSAP | 3.12.5 | Animation library for fade-in effects, focus mode transitions, and smooth UI state changes |

See [TECH_STACK.md](./TECH_STACK.md) for the complete technology stack and architecture details.

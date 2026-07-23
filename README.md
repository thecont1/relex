# CeNSE Interactive Ecosystem Network Diagram

A browser-based, accessible visualization of the CeNSE department as an interactive
network of faculty, research platforms, research verticals, and collaborations.

Built for the intranet: no backend, no database, no admin tooling. The
workbook is the only editable source of truth.

## Quick start

```bash
bun install
bun run dev       # http://127.0.0.1:5173
bun run build     # type-check + production build → dist/
bun run preview   # serve dist/ on http://127.0.0.1:4173
```

Node ≥ 20 and Bun ≥ 1.3 are required.

## How to update the data

1. Edit `public/data/CeNSE_Master_Ecosystem_Dataset.xlsx` in Excel / Numbers /
   LibreOffice / Google Sheets.
2. Drop the updated file in place. The file path is hard-coded as
   `./data/CeNSE_Master_Ecosystem_Dataset.xlsx` and is fetched on every page
   load (cache-busted). No redeploy is required.
3. Users can also click **Refresh data** in the app to re-fetch without
   reloading the page.

## Required workbook schema

The workbook is validated on load. Sheet names and column names must match
exactly. Mismatches are surfaced as a fatal error in the UI.

| Sheet                | Required columns                              |
|----------------------|-----------------------------------------------|
| `Platforms`          | `Platform ID`, `Platform`, `Description`, `Sector` |
| `Faculty`            | `Faculty ID`, `Faculty`                       |
| `Faculty_Platforms`  | `Faculty`, `Platform`                         |
| `Research_Verticals` | `Vertical ID`, `Research Vertical`, `Sector`  |
| `Faculty_Verticals`  | `Faculty`, `Research Vertical`                |
| `Collaborations`     | `Faculty A`, `Faculty B`, `Project/Topic`     |

Non-fatal warnings are surfaced for blank sectors, unknown references in
relationship sheets, duplicate rows, and malformed collaboration rows.

## Default view choice (and justification)

First load shows **faculty + research verticals + faculty–faculty collaboration
edges**. Platforms are off by default but one click reveals them.

Why: the narrative of the CeNSE ecosystem for presentations and annual reports
is *people* (faculty), *what they work on* (verticals), and *who they work with*
(collaboration edges). Platforms are infrastructure and read as ambient noise
on first glance. The legend and accessible view still show all three node
shapes so users see the system is complete; they can compose any view they
want with the layer toggles.

## Accessibility

- WCAG 2.1 AA contrast verified across primary surfaces.
- `prefers-reduced-motion` respected throughout (animations collapse to final
  state).
- Keyboard-operable across the whole app. Press <kbd>Tab</kbd> to walk through
  controls, <kbd>Enter</kbd> in the search box to focus a faculty, <kbd>Esc</kbd>
  to close the drawer.
- A semantic **Accessible View** is one click away and exposes the same data
  as sortable, expandable lists and tables — no information loss relative to
  the visual graph.

## Project layout

```
public/
  data/
    CeNSE_Master_Ecosystem_Dataset.xlsx
src/
  app/
    App.tsx
  components/
    GraphCanvas.tsx
    ControlPanel.tsx
    SearchBox.tsx
    LayerToggles.tsx
    SectorFilter.tsx
    Legend.tsx
    DetailDrawer.tsx
    ExportControls.tsx
    WarningBanner.tsx
    AccessibleView.tsx
    StatsBar.tsx
    Icons.tsx
  hooks/
    useWorkbookData.ts
    useGraphState.ts
    useReducedMotion.ts
  lib/
    loadWorkbook.ts
    validateWorkbook.ts
    buildGraph.ts
    buildAccessibleModel.ts
    exportGraph.ts
    motion.ts
    colorSystem.ts
    focusManager.ts
    types.ts
  styles/
    tokens.css
    app.css
```

## Browser support

Latest Chrome, Edge, Firefox, Safari. The app uses standard Web APIs only —
no service worker, no auth, no network calls other than the workbook fetch.
# Tech Stack Overview

## Core Framework & Build Tools

**React 18.3.1** - UI framework with hooks-based state management. Uses `StrictMode` for development checks and the new `createRoot` API for concurrent rendering.

**Vite 5.4.10** - Build tool and dev server. Configured with:
- Relative base path (`./`) for intranet/subpath deployment flexibility
- Tenant-aware build: `TENANT={slug} vite build` reads `tenants/{slug}/tenant.config.json` and inlines it as a global `__TENANT_CONFIG__` constant
- Build-time tenant config validation (`validateTenantConfig`): required fields, local workbook existence, `schema.roles` ↔ `schema.sheets` consistency, relative logo paths; malformed configs fail the build with actionable errors. Warns when `coreVersion` drifts from `package.json` version.
- Per-tenant `publicDir`: `tenants/{slug}/public/` (falls back to repo-root `public/`), so each build output contains only that tenant's data and branding
- Output to `dist/{slug}/` so multiple tenants can coexist
- Dev server on port 5173 with Docker host support
- Preview server on port 4173
- ES2022 target for modern JavaScript features
- Source maps disabled for production builds

**TypeScript 5.6.3** - Type safety with strict mode enabled. Configured for:
- ES2022 target with DOM libraries
- React JSX transform
- Bundler module resolution
- Strict type checking including no unused locals/parameters
- JSON module resolution (for tenant config files)

## Multi-Tenant Architecture

The codebase is structured as a **single codebase, multi-tenant deployment**:

```
src/                     # Shared core engine (zero tenant-specific code)
  tenant/config.ts       # Typed accessor + resolveAssetUrl for the injected config
  components/            # All UI components (generic, config-driven)
  hooks/                 # React hooks (data loading, state management)
  lib/                   # Core logic (graph building, validation, layout)
tenants/{slug}/          # Per-client configuration, data, and branding
  tenant.config.json     # Branding, data source, schema mapping
  public/                # Tenant-only static files (workbook, logo) —
                         #   becomes the build's publicDir
scripts/build-all.ts     # Discovers and builds every tenant (bun run build:all)
```

**Build-time tenant injection**: `vite.config.ts` reads and validates the
tenant config, then inlines it as a global `__TENANT_CONFIG__` constant via
Vite's `define` option. Each tenant's bundle has its own config baked in — no
runtime fetch, no runtime branching on tenant identity.

**Schema contract**: the tenant config's `schema.roles` mapping (required at
build time) maps the six fixed logical roles (platforms, faculty,
facultyPlatforms, verticals, facultyVerticals, collaborations) to the tenant's
sheet names; `schema.sheets` lists required columns per sheet. Column names
and the domain model itself are fixed by the standard schema — see "Schema
limitation" in `docs/TENANT_ONBOARDING.md`.

**Tenant theming**: at app start, `branding.colorAccent` and
`branding.headerBackground` are applied as the CSS custom properties
`--tenant-accent`, `--brand-accent`, and `--tenant-header-bg`, so all styling
resolves from the config with no hardcoded brand colors in core CSS. Tenant
asset paths (e.g. the logo) are relative and resolved against
`import.meta.env.BASE_URL` via `resolveAssetUrl`, keeping them correct under
arbitrary mount paths.

**Deployment**: static bundles deploy to per-tenant Cloudflare Pages projects
(`bun run deploy:{slug}`, backed by `wrangler pages deploy`), or are handed
to clients as a zip for intranet hosting.

**Zero data custody**: Each tenant's browser fetches their own workbook directly
from their own data source URL. The deployed static bundle never proxies or
stores tenant data. If a client's data source requires an API key, it is
supplied and used entirely client-side (held in browser memory/sessionStorage
on the client's own network, never sent to any server controlled by the Licensor).

## Data Processing Layer

**XLSX (SheetJS) 0.18.5** - Parses the Excel workbook specified by the tenant
config's `dataSource.path`.

**Data Pipeline Flow:**
1. [useWorkbookData](src/hooks/useWorkbookData.ts) hook fetches the workbook from the tenant-config-specified data source
2. `loadWorkbook` parses the Excel into raw JavaScript objects
3. `validateWorkbook` checks data quality against the schema from the tenant config (not hardcoded)
4. [buildGraph](src/lib/buildGraph.ts) transforms validated data into a canonical graph model with nodes (faculty, platforms, verticals) and edges (affiliations, collaborations)

## Graph Visualization

**Cytoscape 3.30.2** - Core graph rendering engine for the 2D flat view. Handles:
- Force-directed layout using fcose algorithm
- Interactive pan/zoom
- Node/edge styling and theming
- Event handling (click, hover, keyboard navigation)

**Cytoscape-fcose 2.2.0** - Fast layout algorithm that organizes nodes into
aspect-aware bands (verticals top, faculty middle, platforms bottom) to
prevent edge crossings and ensure all nodes fit without scrolling.

**Cytoscape-svg 0.4.0** - Enables SVG export functionality for the graph.

**3D Force Graph 1.80.0** - Alternative 3D globe renderer (via `GlobeCanvas`
component) using Three.js for spherical network visualization.

**Three.js 0.185.1** - 3D rendering engine used by the globe view for WebGL-based visualization.

## Animation & Motion

**GSAP 3.12.5** - Animation library used for:
- Fade-in effects on app load
- Focus mode transitions
- Smooth UI state changes

## State Management Architecture

**Custom React Hooks** - No external state library; uses React's built-in hooks:
- [useWorkbookData](src/hooks/useWorkbookData.ts) - Manages data loading lifecycle (idle → loading → ready/error) with cancellation token pattern to prevent race conditions. Reads the data source path from the tenant config.
- [useGraphState](src/hooks/useGraphState.ts) - Centralized UI state for filters, search, drawer, view mode, and focus mode. Computes visible node/edge sets based on current filters.
- `useReducedMotion` - Respects user's motion preferences for accessibility

## Component Architecture

**App.tsx** - Root component orchestrating:
- Data loading and error handling
- Theme switching (dark/light mode)
- Export functionality (PNG/SVG) — uses the tenant config's `exportFilenameBase`
- Live region announcements for screen readers
- Integration of all sub-components

**AppHeader.tsx** - Generic header component that reads all branding (title,
logo, color accent) from the tenant config. No hardcoded client-specific
references.

**GraphCanvas.tsx** - 2D Cytoscape renderer with:
- Aspect-aware band layout
- Dynamic node sizing based on degree centrality
- Hub/peripheral classification for visual hierarchy
- Keyboard navigation (roving focus)
- Highlight controller for hover/pin states
- Inline label sizing for platforms/verticals

**GlobeCanvas.tsx** - 3D spherical view using 3D Force Graph

**ControlPanel.tsx** - Filter controls for toggling platforms, verticals,
collaborations, and sector selection

**DetailDrawer.tsx** - Sidebar showing node details with ego network visualization

**AccessibleView.tsx** - Screen-reader-friendly text-based alternative to visual graph

## Key Integration Points

1. **Data Flow**: Tenant config → Excel → XLSX parser → validation (schema from config) → graph model → visual renderers
2. **State Flow**: User actions → [useGraphState](src/hooks/useGraphState.ts) → filter computation → visible sets → renderer updates
3. **Theme System**: CSS custom properties with data attributes for dark/light switching
4. **Accessibility**: Live regions announce state changes; keyboard navigation works in both visual and accessible views
5. **Export**: Cytoscape instance exposed via ref to export functions that generate PNG/SVG downloads with tenant-config-specified filenames

The architecture prioritizes separation of concerns: data processing, UI state,
and rendering are distinct layers, making it easy to add new visualizations or
modify the data pipeline without affecting other components. The core engine
contains zero tenant-specific code — all client-specific configuration is
isolated in `tenants/{slug}/tenant.config.json`.

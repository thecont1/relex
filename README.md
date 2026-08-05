# relex: The Interactive Network Relationship Explorer

A browser-based, accessible visualization tool for exploring organizational
networks as interactive graphs. Built as a **single-codebase, multi-tenant**
application: one shared core engine is deployed separately per client, each
pointed at that client's own data source.

Designed for intranet deployment: no backend, no database, no admin tooling.
The data workbook is the only editable source of truth. Each tenant's browser
fetches their own workbook directly from their own data source — the deployed
static bundle never proxies or stores tenant data, preserving a zero-data-custody
model.

## Quick start

```bash
bun install
bun run dev                    # default tenant (cense) at http://127.0.0.1:5173
bun run dev:cense              # explicitly build the cense tenant
bun run dev:test-dept          # build the test-dept tenant
bun run build                # build default tenant → dist/cense/
bun run build:cense          # build cense tenant → dist/cense/
bun run build:test-dept      # build test-dept tenant → dist/test-dept/
bun run build:all            # build all tenants (auto-discovers tenants/)
bun run preview              # serve the default tenant's build on http://127.0.0.1:4173
bun run deploy:cense         # deploy dist/cense to Cloudflare Pages
bun run deploy:test-dept     # deploy dist/test-dept to Cloudflare Pages
```

Node ≥ 20 and Bun ≥ 1.3 are required.

## Multi-tenant architecture

```
relex/
├── src/                     # Shared core engine (zero tenant-specific code)
│   ├── components/          # All UI components (generic, config-driven)
│   ├── hooks/               # React hooks (data loading, state management)
│   ├── lib/                 # Core logic (graph building, validation, layout)
│   └── tenant/config.ts     # Typed accessor + asset URL resolver for the
│                            #   build-time injected config
├── tenants/                 # Per-client configuration, data, and branding
│   ├── cense/
│   │   ├── tenant.config.json   # CeNSE branding, data source, schema
│   │   └── public/              # CeNSE-only files (workbook, logo) —
│   │                            #   becomes the build's publicDir
│   └── test-dept/
│       ├── tenant.config.json   # Fictional reference tenant
│       └── public/              # Synthetic dataset + logo (committed)
├── scripts/
│   ├── build-all.ts             # bun run build:all — discovers and builds
│   │                            #   every tenant automatically
│   └── make-test-dept-workbook.ts  # Regenerates the fictional test dataset
├── docs/
│   ├── TENANT_ONBOARDING.md # Repeatable onboarding process
│   ├── VERSIONING.md        # Version tag and changelog convention
│   ├── SINGLE-CODEBASE-MULTI-TENANT.md  # Architecture design doc
│   └── PLAN-MULTITENANT.md  # Executed migration plan (with decisions)
├── vite.config.ts           # Tenant-aware build (TENANT=slug bun run build)
├── package.json
└── CHANGELOG.md
```

### How it works

1. **Tenant config** (`tenants/{slug}/tenant.config.json`) specifies:
   - Branding (logo, title, color accent, header background)
   - Data source (local file path or remote URL, with optional auth headers)
   - Schema (required `schema.roles` mapping of the six logical roles to
     sheet names, required columns per sheet, entity/edge type labels)
   - Feature flags (default layer visibility, export filename base)

2. **Build-time injection and validation**: `vite.config.ts` reads the tenant
   config, validates it (required fields, local workbook existence, roles ↔
   sheets consistency — malformed configs fail the build), and inlines it as
   a global `__TENANT_CONFIG__` constant via Vite's `define` option. Each
   tenant's bundle has its own config baked in — no runtime fetch, no runtime
   branching.

3. **Per-tenant assets**: each tenant's `tenants/{slug}/public/` becomes the
   build's `publicDir`, so a tenant's `dist/` contains only that tenant's
   data and branding — never another tenant's workbook. Tenant workbooks are
   gitignored; only the fictional test-dept dataset is committed.

4. **Core engine** (`src/`) reads the config via `src/tenant/config.ts` to
   know branding, data source, and schema. Brand colors reach the CSS via
   `--tenant-accent` / `--tenant-header-bg` custom properties; asset paths
   resolve against the app base URL. The core contains zero hardcoded
   tenant-specific references.

5. **Deployment**: Each tenant gets its own `dist/{slug}/` output, deployed
   to its own Cloudflare Pages project (`bun run deploy:{slug}`), subdomain,
   path, or intranet server. The relative base (`./`) works under any mount
   path.

### Adding a new tenant

See [docs/TENANT_ONBOARDING.md](./docs/TENANT_ONBOARDING.md) for the full
repeatable process: clone config → fill in data source/branding/schema →
build → deploy.

## How to update the data

1. Edit the tenant's Excel workbook in `tenants/{slug}/public/data/` using Excel / Numbers / LibreOffice / Google Sheets.
2. Drop the updated file in place (and re-upload it to the tenant's hosting if deployed). The workbook is fetched on every page load (cache-busted), so no rebuild is required for a local/intranet deployment.
3. Users can also click **Reset** in the app to re-fetch without reloading the page.

## Required workbook schema

The workbook is validated on load against the tenant config: the required
`schema.roles` mapping tells the core engine which sheet plays which logical
role, and `schema.sheets` lists the required columns per sheet. Sheet names
may differ per tenant; column names follow the standard schema below (see
"Schema limitation" in [docs/TENANT_ONBOARDING.md](./docs/TENANT_ONBOARDING.md)
for what is and isn't customizable).

The default schema models an organizational ecosystem:

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

To use different sheet names, remap the six logical roles via `schema.roles`
in the tenant config. A genuinely different domain model (different node/edge
kinds or column semantics) requires core engine changes — that
generalization is intentionally out of scope for now.

## Default view choice (and justification)

First load shows **people + domains + person–person collaboration edges**.
Infrastructure/platform nodes are off by default but one click reveals them.

Why: the narrative for most organizational presentations is *people*, *what they
work on* (domains), and *who they work with* (collaboration edges).
Infrastructure reads as ambient noise on first glance. The legend and
accessible view still show all node shapes so users see the complete system;
they can compose any view they want with the layer toggles.

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

## Licensing

Relex is licensed under the Relex Business Source License — source-available
for internal use, with commercial licensing required for hosted/saas
deployment. See [LICENSE.md](./LICENSE.md) for details.

## Migration to a Single-Codebase, Multi-Tenant SaaS Architecture

Restructure relex from a single-tenant application into a "single codebase, multi-tenant deployment" architecture, where one shared core engine is deployed separately per client, each pointed at that client's own data source, without any cross-client code duplication for future feature development.

### Step 1: Repository and licensing changes (do first, before any refactor)

- Change the repository visibility to private, or if it should remain visible for portfolio purposes, replace `LICENSE.md` with a source-available license (e.g., Business Source License 1.1, or a custom "all rights reserved, no commercial redistribution or hosting by third parties" license) rather than Apache-2.0.
- Audit git history: since the repo has been public under Apache-2.0, note that anyone who already cloned it retains rights under that license for that snapshot — going forward, only new commits need the new terms, but flag this to Mahesh as a known limitation, not something code can fix retroactively.
- Update `README.md` to remove any "fork and self-host freely" framing and replace with licensing terms appropriate to the new model.

### Step 2: Separate "core engine" from "tenant configuration"

Restructure the codebase into two clearly separated concerns:

- **`/core`** (or keep as `/src`): all shared application logic — Cytoscape rendering, fcose layout, 3D globe view, GSAP animations, accessible view, search, filters, hover/focus/pin interaction logic, export functionality. This code must contain zero hardcoded references to "CeNSE," IISc branding, or any client-specific schema assumptions beyond the already-generalized workbook schema documented in the README.
- **`/tenants/{client-slug}`** (new): per-client configuration only — branding (logo, name, color accents if customized), the specific `public/data/` workbook location or fetch URL, any client-specific schema field mappings if they deviate from the standard schema, and deployment-specific environment variables (e.g., API key handling if a client's data source requires auth headers).
- Introduce a build-time or runtime tenant-selection mechanism: either (a) a build step that takes a `--tenant=cense` flag and bundles that tenant's config into the output, or (b) a runtime config file (`tenant.config.json`) loaded at app start that the core engine reads to know branding and data source — evaluate both and pick whichever fits Vite's build model more cleanly, since relex already uses Vite.
- Ensure the schema validation logic (sheet/column name matching, currently a core feature) stays generic and reads its expected schema from the tenant config, not hardcoded, so future clients with different domain models (not just faculty/platforms/verticals) can be supported without touching core code.

### Step 3: Deployment model

- Each tenant gets its own deployment (e.g., separate Cloudflare Pages project, or separate subdomain/path) built from the same core codebase with that tenant's config injected at build time.
- Document a repeatable "new tenant onboarding" process: clone tenant config template → fill in data source URL, branding, schema mapping → run tenant-specific build → deploy to tenant's subdomain or their intranet.
- Confirm the existing "no backend, no database" model holds per-tenant: each tenant's browser fetches their own workbook directly from their own data source URL, with their own credentials if needed — the deployed static bundle should never proxy or store tenant data, preserving the zero-data-custody claim central to the business model.
- If a client's data source requires an API key header (per Mahesh's business model discussion), confirm the key is supplied and used entirely client-side (e.g., entered once and held in browser memory/sessionStorage on their own network, never sent to any server you control) — flag this as a design decision needing explicit confirmation, not an assumption to bake in silently.

### Step 4: Versioning and update propagation

- Set up the core engine so that a single update (e.g., the hover/decay/layout improvements from recent iterations) can be released once and redeployed across all tenant instances via their individual build pipelines, without manual re-patching per client.
- Consider a simple version tag/changelog convention so Mahesh can tell clients "you're on core version X" and communicate what shipped in each update — this becomes useful for justifying the "continuous development" line item on future invoices.

### Step 5: Rename/rebrand consideration

- Since relex will no longer be a single-purpose CeNSE tool but a licensed product served to multiple institutions, evaluate whether the product needs a distinct public-facing name separate from any one client's branding, and whether "relex" itself becomes the product name across all tenant deployments, or if each tenant sees only their own white-labeled instance.

### Acceptance criteria

- Core engine code contains no hardcoded tenant-specific data, branding, or schema assumptions.
- A second hypothetical tenant (e.g., a fictional "test-dept" config) can be added and deployed using only the tenant-config folder, with zero changes to core code.
- Existing CeNSE deployment continues to work identically after the refactor, with no regression in the layout, hover, or accessibility behavior already built.
- Licensing terms are updated and no longer permit unrestricted third-party redistribution/hosting.

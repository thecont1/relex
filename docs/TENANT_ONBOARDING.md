# Tenant Onboarding Guide

Relex is a single-codebase, multi-tenant application. The core engine lives in
`src/` and is shared across all deployments. Each client gets its own tenant
configuration under `tenants/{slug}/` and its own build output under
`dist/{slug}/`.

## Prerequisites

- Bun >= 1.3 (or Node >= 20 with a compatible package manager)
- The relex source code checked out locally

## Step-by-step onboarding

### 1. Clone the tenant config template

Copy the template directory to create a new tenant. Use `test-dept` as the
template — it is the fictional reference tenant, so nothing client-specific
leaks into the new folder:

```bash
cp -r tenants/test-dept tenants/my-new-client
```

Then replace the contents of `tenants/my-new-client/public/` (workbook and
logo) with the client's own data and branding in steps 3–4.

### 2. Fill in the tenant config

Edit `tenants/my-new-client/tenant.config.json`:

| Field | What to set |
|-------|-------------|
| `tenantId` | A unique slug (e.g. `my-new-client`) |
| `name` | Full display name for the app (used in `<title>` and meta) |
| `description` | Meta description for SEO/intranet indexing |
| `branding.title` | Header title text (e.g. `DEPARTMENT OF COMPUTER SCIENCE`) |
| `branding.logo.src` | Path to the logo image under `tenants/{slug}/public/assets/` |
| `branding.logo.alt` | Alt text for the logo |
| `branding.colorAccent` | Primary accent color (hex) |
| `branding.headerBackground` | (Optional) Header background color (hex). Defaults to `#dedddd`. |
| `dataSource.type` | `local` for a static file, `remote` for an HTTP endpoint |
| `dataSource.path` | For `local`: relative path to the workbook under `tenants/{slug}/public/data/` (e.g. `./data/my_client_dataset.xlsx`). For `remote`: full URL. |
| `dataSource.headers` | (Optional) HTTP headers for remote sources, e.g. `{"Authorization": "Bearer ..."}` |
| `schema.sheets` | Map of sheet name → required column names. Column names must match the standard schema (see "Schema limitation" below). |
| `schema.roles` | **Required.** Explicit map of the six logical roles (`platforms`, `faculty`, `facultyPlatforms`, `verticals`, `facultyVerticals`, `collaborations`) to your sheet names. The build fails without it — the runtime engine throws on unresolvable roles, so this is enforced at build time rather than left to a runtime crash. |
| `schema.entityTypes` | Labels and searchability for each node type |
| `schema.edgeTypes` | Labels for each edge type |
| `features.exportFilenameBase` | Base filename for PNG/SVG exports (e.g. `my-client-network`) |
| `coreVersion` | The core engine version this tenant is built against (e.g. `1.0.0`) |

### Schema limitation (important)

The core engine currently implements one fixed domain model: faculty,
platforms, research verticals, and the three relationship kinds between
them. Tenants may rename *sheets* via `schema.roles`, but *column* names
are fixed by the standard schema (the row coercion in the core engine reads
the standard column names). A client whose workbook uses different column
names, or a genuinely different domain model (different node/edge kinds),
requires core engine changes — that generalization is intentionally out of
scope for now.

### 3. Place the data workbook

- For `local` data sources: copy the Excel workbook to
  `tenants/{slug}/public/data/` and ensure the `dataSource.path` in the
  config matches.
- For `remote` data sources: ensure the URL is accessible from the tenant's
  deployment environment. If auth is needed, set the headers in the config.

Each tenant has its own `public/` dir (`tenants/{slug}/public/`), which Vite
uses as the build's `publicDir`. This guarantees a tenant's `dist/` output
contains only that tenant's data and branding — never another tenant's
workbook. Tenant workbooks are gitignored (`tenants/*/public/data/*.xlsx`);
only fictional test data may be committed.

### 4. Place branding assets

Copy logo images to `tenants/{slug}/public/assets/{tenant-slug}/` and update
the `branding.logo.src` path in the config.

### 5. Build the tenant

```bash
TENANT=my-new-client bun run build
```

This produces output in `dist/my-new-client/`.

### 6. Deploy

Deploy the contents of `dist/my-new-client/` to the tenant's hosting
environment (e.g. Cloudflare Pages, Vercel, Fly.io static hosting, or an
intranet web server).

The app uses a relative base path (`./`), so it works under any mount path
without configuration changes.

#### Cloudflare Pages (default target)

Each tenant gets its own Pages project named `relex-{slug}`. One-time setup
per tenant (requires Cloudflare credentials via `bunx wrangler login` or a
`CLOUDFLARE_API_TOKEN` env var):

```bash
bunx wrangler pages project create relex-my-new-client --production-branch=main
```

Then deploy with the matching script:

```bash
bun run deploy:my-new-client
# equivalent to:
# bunx wrangler pages deploy dist/my-new-client --project-name=relex-my-new-client
```

Add a `deploy:{slug}` script to `package.json` for each new tenant, following
the existing `deploy:cense` / `deploy:test-dept` pattern.

#### Intranet hand-off

For clients hosting on their own intranet, zip the tenant's build output and
hand it over — no credentials or pipeline needed on your side:

```bash
cd dist/my-new-client && zip -r ../my-new-client.zip . && cd ../..
```

The bundle is fully static and self-contained; any web server (or even a
static-file server on the client's network) can host it.

### 7. Verify

After deployment, verify:
- The header shows the correct title and logo
- The workbook loads and the graph renders
- Export (PNG/SVG) produces files with the correct filename base
- No hardcoded references to other tenants appear in the UI

## API key handling (design decision)

If a client's data source requires an API key:

1. Set `dataSource.type` to `remote` and `dataSource.path` to the API URL.
2. Set `dataSource.headers` to include the auth header, e.g.:
   ```json
   "headers": { "Authorization": "Bearer YOUR_KEY_HERE" }
   ```

**Important:** The API key is embedded in the client-side bundle at build time.
This means:
- The key is visible in the browser's network tab and in the JS bundle.
- This is acceptable for keys that are:
  - Read-only access tokens with limited scope
  - Intended for browser-side use (e.g. a public read-only API key)
  - Used in an intranet environment where the bundle is not publicly accessible

If the client needs a secret key that should not be visible to end users,
consider:
- Using a reverse proxy on the client's own infrastructure that adds the auth
  header before forwarding to the API (the proxy runs on the client's network,
  not on your infrastructure)
- Using a token exchange flow where the browser fetches a short-lived token
  from the client's own auth server

The deployed static bundle never sends tenant data to any server you control.
Each tenant's browser fetches directly from their own data source.

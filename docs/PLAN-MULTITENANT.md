# Multi-Tenant Architecture — Execution Plan

Branch: `arch/multitenant`

This plan closes the gap between the current state of the repo and the target architecture described in [SINGLE-CODEBASE-MULTI-TENANT.md](./SINGLE-CODEBASE-MULTI-TENANT.md) and [TENANT_ONBOARDING.md](./TENANT_ONBOARDING.md).

## Current state (audit, 2026-08-06)

Much of the refactor is already implemented on this branch:

- `LICENSE.md` is already the Relex Business Source License (Step 1 of the design doc, code side).
- Tenant config system exists: `src/tenant/config.ts` (typed accessor, build-time injection via `__TENANT_CONFIG__`), `tenants/cense/` and `tenants/test-dept/` config folders.
- `vite.config.ts` injects the tenant config via `define`, rewrites `index.html` title/description per tenant, and outputs to `dist/{slug}/`.
- `package.json` has per-tenant `dev:`/`build:`/`preview:` scripts and a `build:all` aggregate.
- `src/lib/loadWorkbook.ts` reads `dataSource` (local/remote + headers) from the tenant config — no hardcoded paths.
- `src/lib/validateWorkbook.ts` reads sheet/column expectations from the tenant config.
- Branding (title, logo) is consumed from the tenant config in `AppHeader.tsx` and `MobileTopBar.tsx`; export filenames use `features.exportFilenameBase`.
- Docs exist: `TENANT_ONBOARDING.md`, `VERSIONING.md`, `CHANGELOG.md`; README is already rewritten for the multi-tenant model.

The remaining work falls into the phases below. Each task lists the files it touches and how to verify it. Execute phases in order; tasks within a phase are mostly independent.

---

## Phase 0 — Housekeeping

- [ ] **0.1 Commit the design doc.** `docs/SINGLE-CODEBASE-MULTI-TENANT.md` is untracked. Commit it (and this plan) on `arch/multitenant`.
  - Verify: `git status` is clean.
- [ ] **0.2 Confirm repo visibility.** The design doc requires the repo to be private (or source-available). Check with `gh repo view --json visibility`. If still public, flag to the user — this is a GitHub settings change, not a code change. Note the known limitation from the design doc: snapshots cloned under Apache-2.0 retain those rights; only new commits are under the BSL.

## Phase 1 — Per-tenant asset and data segregation (highest priority)

**Problem:** Vite copies the entire `public/` directory into every tenant's `dist/{slug}/` output. Today that means a `test-dept` build would ship the CeNSE workbook (`public/data/CeNSE_Master_Ecosystem_Dataset.xlsx`) — a cross-tenant data leak that breaks the zero-data-custody story.

- [ ] **1.1 Move tenant assets into tenant folders.**
  - Create `tenants/cense/public/` and move tenant-owned files there:
    `public/data/CeNSE_Master_Ecosystem_Dataset.xlsx` →
    `tenants/cense/public/data/CeNSE_Master_Ecosystem_Dataset.xlsx`,
    `public/assets/cense/` → `tenants/cense/public/assets/cense/`.
  - Keep truly shared assets (if any) in the root `public/`.
  - Update `.gitignore`: the CeNSE workbook is currently ignored by filename
    at repo root — update the ignore rule to its new path
    (`tenants/cense/public/data/*.xlsx` or equivalent).
- [ ] **1.2 Layered `publicDir` in `vite.config.ts`.** Point Vite's
  `publicDir` at `tenants/{slug}/public` when it exists, falling back to the
  root `public/`. If shared assets are needed, copy root `public/` into the
  build via a small plugin or keep shared assets in the tenant dir.
  - Verify: `bun run build:cense` output `dist/cense/` contains the CeNSE
    workbook; `bun run build:test-dept` output `dist/test-dept/` does **not**
    contain any CeNSE files.
- [ ] **1.3 Update docs.** Adjust the paths in `TENANT_ONBOARDING.md`
  (steps 3–4) to the new tenant-scoped locations.

## Phase 2 — Make the test-dept tenant real (acceptance criterion #2)

**Problem:** `tenants/test-dept/tenant.config.json` references
`./data/test_dept_dataset.xlsx` and `/assets/test-dept/logo.png`, neither of
which exists. The "second tenant with zero core changes" criterion cannot be
demonstrated until they do.

- [ ] **2.1 Generate a synthetic test workbook.** Write a small script
  (e.g. `scripts/make-test-dept-workbook.ts`, run with `bunx tsx` or a one-off
  `bun` script using the already-installed `xlsx` package) that generates
  `tenants/test-dept/public/data/test_dept_dataset.xlsx` with the six standard
  sheets and a small fictional dataset (~10 faculty, ~6 platforms, ~5
  verticals, some collaborations). Commit the generator script; the workbook
  itself may be committed since it is fictional.
- [ ] **2.2 Add a placeholder logo** at
  `tenants/test-dept/public/assets/test-dept/logo.png` (simple generated
  wordmark is fine).
- [ ] **2.3 Verify end to end.** `bun run dev:test-dept` loads with test-dept
  branding and data; `bun run build:all` succeeds for both tenants.
- [ ] **2.4 Header background check.** The desktop header background is
  hardcoded to `#dedddd` (`src/styles/app.css`, `.app-header`) specifically to
  blend with the CeNSE logo. With a different logo this may look wrong.
  Either make the header background a tenant branding field
  (`branding.headerBackground`, default `#dedddd`) or confirm the placeholder
  logo works on that grey. Prefer the config field.

## Phase 3 — Eliminate remaining tenant-specific styling

- [ ] **3.1 Drive the accent color from config on desktop.** The desktop
  header title is hardcoded `#d8232a` ("CeNSE red") in `src/styles/app.css`
  (`.app-header__title`); only `MobileTopBar.tsx` uses
  `branding.colorAccent`. Fix: set a CSS custom property at app start (e.g.
  in `App.tsx`: `document.documentElement.style.setProperty('--tenant-accent', tenantConfig.branding.colorAccent)`)
  and change the CSS to `color: var(--tenant-accent, #d8232a)`.
  - Verify: test-dept header renders in `#1e40af`, cense still `#ed2229` —
    note the config value `#ed2229` differs from the CSS `#d8232a`; confirm
    with the user which red is correct and align them.
- [ ] **3.2 Clean tenant-specific comments** in `src/styles/app.css`
  (lines ~903, ~954, ~1062 reference CeNSE/cense.iisc.ac.in). Reword to
  generic descriptions.
- [ ] **3.3 Final sweep.** `rg -i "cense|iisc|nanoscience" src/` should return
  zero matches when done.

## Phase 4 — Schema mapping robustness (scoped)

**Problem:** `validateWorkbook.ts` reads sheet/column lists from the tenant
config, but two hardcodings remain:

1. The role→sheet resolution is a name heuristic (`ROLE_TO_SHEET`, lines
   ~42–61) with hardcoded fallbacks (`'Platforms'`, `'Faculty'`, …).
2. Row coercion and warning messages use hardcoded domain keys
   (`row['Research Vertical']`, `'Faculty A'`, etc.), and
   `buildGraph.ts`/`types.ts` hardcode the faculty/platform/vertical domain
   model throughout.

Fully generalizing the domain model is a large refactor and is **out of
scope** for this branch — the standard schema *is* the product's data
contract for now. In scope:

- [ ] **4.1 Replace the name heuristic with explicit role mapping.** Add an
  optional `schema.roles` object to the tenant config schema
  (`{ platforms: "Platforms", faculty: "Faculty", ... }`), use it when
  present, keep the heuristic as fallback, and remove the hardcoded sheet-name
  fallbacks (fail with a clear config error instead).
- [ ] **4.2 Validate the tenant config at build time.** In `vite.config.ts`
  `loadTenantConfig`, check required fields (branding, dataSource, schema with
  all six roles, features) and fail the build with an actionable message on a
  malformed config.
- [ ] **4.3 Document the limitation** in `TENANT_ONBOARDING.md`: tenants must
  use the standard domain model; custom domain models require core changes.
  Update `src/tenant/config.ts` types and both tenant configs.

## Phase 5 — Build/release ergonomics

- [ ] **5.1 Dynamic `build:all`.** The script hardcodes `cense` and
  `test-dept`. Replace with a small script (`scripts/build-all.ts`) that
  enumerates `tenants/*/tenant.config.json` and builds each, so onboarding a
  tenant needs no `package.json` edit. Update `VERSIONING.md` accordingly.
- [ ] **5.2 Core-version consistency check.** In the build, compare
  `package.json` `version` with the tenant config's `coreVersion`; warn (not
  fail) when they differ so `coreVersion` stays honest per VERSIONING.md.
- [ ] **5.3 Changelog entry.** Add the multi-tenant restructure to
  `CHANGELOG.md` per the VERSIONING.md convention.

## Phase 6 — Deployment (one real target, then templated)

The docs describe per-tenant static deploys but no pipeline exists yet.

- [ ] **6.1 Pick the first deploy target** (Cloudflare Pages is named in the
  design doc). Create one Pages project per tenant (`relex-cense`,
  `relex-test-dept`) and add `deploy:{slug}` scripts
  (`wrangler pages deploy dist/{slug} --project-name=relex-{slug}`).
  Requires the user's Cloudflare credentials — coordinate before running.
- [ ] **6.2 Document the deploy step** in `TENANT_ONBOARDING.md` step 6 with
  the concrete command.
- [ ] **6.3 (Decision) Intranet deployments** stay manual: document handing
  the client a `dist/{slug}/` zip. No code change.

## Phase 7 — Final verification against the design doc's acceptance criteria

- [ ] **7.1** `rg -i "cense|iisc" src/` → no tenant-specific code/branding in
  core (only generic schema semantics remain).
- [ ] **7.2** Fresh-clone simulation: `bun install && bun run build:all` → both
  tenants build; test-dept required zero core changes.
- [ ] **7.3** CeNSE regression check: `bun run dev:cense`, verify layout,
  hover, focus/pin, accessible view, globe view, exports, and mobile view
  against the current production behavior (visual pass at
  http://localhost:5173).
- [ ] **7.4** `bun run typecheck` clean.
- [ ] **7.5** License check: `LICENSE.md` is BSL, README contains no
  "fork and self-host" framing (already true — re-verify after edits).

## Open decisions for the user (not agent-resolvable)

1. **Repo visibility** — make the GitHub repo private? (Phase 0.2)
2. **The two reds** — tenant config says `#ed2229`, CSS says `#d8232a`. Which
   is canonical? (Phase 3.1)
3. **Deploy target & credentials** — Cloudflare Pages? Something else?
   (Phase 6)
4. **Product naming** (design doc Step 5) — README already uses "relex" as the
   product name with white-labeled tenants. Confirm that's the final call.
5. **Domain-model generalization** — confirm "standard schema only" scope for
   this branch (Phase 4), with fully custom domain models deferred.

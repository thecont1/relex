# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Per-tenant `public/` dirs (`tenants/{slug}/public/`) used as Vite
  `publicDir` — a tenant's `dist/` now contains only that tenant's data and
  branding, never another tenant's workbook
- `branding.headerBackground` tenant config field; header theming now driven
  by `--tenant-accent` / `--tenant-header-bg` CSS variables
- `schema.roles` explicit role→sheet mapping in tenant configs (name
  heuristic kept as fallback)
- Build-time tenant config validation (required fields, local data source
  existence, roles/sheets consistency) with actionable error messages
- `coreVersion` drift warning when tenant config differs from `package.json`
- `scripts/build-all.ts` — `build:all` now discovers tenants automatically
- `scripts/make-test-dept-workbook.ts` — generates the fictional test-dept
  dataset
- Working `test-dept` tenant: synthetic workbook + SVG wordmark logo, proving
  a second tenant runs with zero core code changes

### Changed
- CeNSE data workbook and branding assets moved from `public/` to
  `tenants/cense/public/` (`.gitignore` updated; tenant workbooks stay
  untracked, fictional test data excepted)
- Canonical cense accent red is now the config value `#ed2229` (was a
  hardcoded `#d8232a` in CSS)
- `validateWorkbook.ts` throws a config error for unresolvable schema roles
  instead of silently falling back to hardcoded standard sheet names

### Removed
- Last tenant-specific strings from core CSS (`src/styles/app.css` comments
  and hardcoded brand colors)

## [1.0.0] — 2026-07-24

### Added
- Multi-tenant architecture: single codebase, multi-tenant deployment model
- Tenant config system (`tenants/{slug}/tenant.config.json`) for per-client
  branding, data source, and schema mapping
- Build-time tenant injection via Vite `define` — each tenant's config is
  inlined at build time, no runtime fetch
- `src/tenant/config.ts` typed accessor for the injected config
- `AppHeader.tsx` — generic header component that reads branding from config
- Tenant-aware Vite config with `TENANT=slug` build flag
- `docs/TENANT_ONBOARDING.md` — repeatable onboarding process
- `docs/VERSIONING.md` — version tag and changelog convention
- `CHANGELOG.md`
- Per-tenant build scripts in `package.json` (`build:cense`, `build:test-dept`,
  `build:all`)
- `test-dept` fictional tenant for validating the multi-tenant architecture

### Changed
- Renamed `CenseHeader.tsx` → `AppHeader.tsx` (generic, config-driven)
- `loadWorkbook.ts` reads data source path from tenant config (was hardcoded)
- `validateWorkbook.ts` reads schema (sheet/column names) from tenant config
  (was hardcoded)
- `App.tsx` uses tenant config's `exportFilenameBase` for export filenames
  (was hardcoded to `cense-ecosystem`)
- `index.html` is now generic (title/description injected by Vite plugin)
- `package.json` renamed from `cense-ecosystem-network` to `relexplorer`
- `tokens.css` renamed `--cense-red` → `--brand-accent`
- `app.css` renamed all `cense-header` classes → `app-header`
- `GraphCanvas.tsx` and `GlobeCanvas.tsx` aria-labels no longer reference CeNSE
- `AccessibleView.tsx` heading no longer references CeNSE
- `WarningBanner.tsx` error message no longer references CeNSE workbook path
- `LICENSE.md` updated to reflect multi-tenant licensing model

### Removed
- All hardcoded CeNSE/IISc branding references from core engine code
- `CenseHeader.tsx` (replaced by `AppHeader.tsx`)

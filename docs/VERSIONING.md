# Versioning & Update Propagation

## Core engine versioning

The core engine version is tracked in two places:

1. **`tenants/{slug}/tenant.config.json`** — the `coreVersion` field records
   which core version a tenant was last built against. This is informational
   and helps communicate to clients what they're running.

2. **`package.json`** — the `version` field tracks the overall package version.

## Changelog

Maintain a changelog at `CHANGELOG.md` with entries like:

```
## [1.1.0] — 2026-08-15

### Added
- Globe view auto-rotation now pauses on hover (was: only on click)
- New `--tenant` flag for build-time tenant selection

### Changed
- Hover dwell time reduced from 380ms to 300ms
- Node sizing algorithm now accounts for label bounding boxes

### Fixed
- Label collision resolution no longer pushes nodes off-canvas
- Keyboard focus ring now visible on globe canvas host
```

## Update propagation

When a core engine update ships:

1. Update the core code in `src/`.
2. Bump the version in `package.json` and `CHANGELOG.md`.
3. Rebuild all tenants:

   ```bash
   bun run build:all
   ```

   This runs `build:cense` and `build:test-dept` (and any other tenants)
   sequentially, producing fresh `dist/{slug}/` outputs.

4. Deploy each tenant's `dist/{slug}/` to its respective hosting environment.

Each tenant gets its own deployment pipeline, but they all build from the same
core codebase. A single core update propagates to all tenants with one
`build:all` command — no manual patching per client.

## Communicating updates to clients

When informing a client about an update, reference the core version:

> "You're now on relex core version 1.1.0. This update includes:
> - Improved hover behavior with shorter dwell time
> - Fixed label collision issues on dense graphs
> - New auto-rotation pause on the 3D globe view"

This makes the "continuous development" line item on invoices concrete and
justifiable — clients can see exactly what they're getting for each update.

## Version tag convention

Use semantic versioning: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes to the core engine API or tenant config schema
- **MINOR**: New features, non-breaking changes to core behavior
- **PATCH**: Bug fixes, performance improvements

The `coreVersion` in each tenant config should be updated when the tenant is
rebuilt against a new core version.

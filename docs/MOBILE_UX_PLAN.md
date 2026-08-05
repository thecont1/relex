# Mobile UX plan — CeNSE Interactive Ecosystem Network Diagram

Status: implementation brief
Scope: mobile viewports (≤900px) and coarse-pointer devices
Style: Swiss-influenced, text-first, academic interface
Audience: academic / intranet users on phones and tablets

This is the working plan that the implementation in this branch follows. It is a
companion to `docs/HANDOFF.md`, `docs/ADDENDUM_2026JUL31.md`, and
`docs/RELATIONSHIP_ARCHITECTURE.md` — for behaviour on desktop, those docs remain
the source of truth. This plan only covers what changes on small screens.

---

## 0. Guiding product call

Mobile is **not** a shrunken desktop graph explorer. Mobile is a **lookup and
reading tool** with selective, on-demand graph exploration. The Accessible view is
the primary exploration surface on mobile because:

- It is an editorial document — semantic HTML with definitions, grouped
  sections, expandable detail.
- It works with screen readers out of the box (its original purpose).
- It survives one-handed use, small viewports, and assistive zoom.
- It does not require Cytoscape / three.js to load before the user gets value.

Graph views remain available, but behind a deliberate mockery-hurdle — the user
opts in, gets a light-touch, lightly-chromed overlay, and the bulk of the state
(search text, sector/type/layer filters, selected node) is preserved across the
switch.

---

## 1. Mobile information architecture

```text
┌───────────────────────────────────────────────────┐
│ CeNSE Ecosystem           [Search faculty…]      │ ← MobileTopBar (sticky)
├───────────────────────────────────────────────────┤
│ 19 F · 7 V · 7 P · 25 C                · Refreshed│ ← MobileStatsChip (collapsed)
├───────────────────────────────────────────────────┤
│ [ Filters ]  [ View ]                  [ More ]  │ ← MobileControls (trigger row)
├───────────────────────────────────────────────────┤
│ LIST  ·  8 faculty match                          │ ← section heading
│   ├───────────────────────────────────────────┐   │
│ [Madhav Rao]                                  │   │
│ Professor · Materials Engineering             │   │
│ Stakeholders: 4   Platforms: 2   Collabs: 3  │   │
│   └───────────────────────────────────────────┘   │
│ ...list rows...                                   │
├───────────────────────────────────────────────────┤
│                                                   │
│       (bottom sheets open over this area)         │
│                                                   │
└───────────────────────────────────────────────────┘
```

### Flow
1. **Entry** → wordmark + search, no logos, no chrome, accessible list view.
2. **Filter** → tap "Filters" → bottom sheet → pick sector/type/layer → "Show N results".
3. **List** → editorial rows, expandable cards, grouped by entity type.
4. **Detail** → tap row → detail drawer rendered as bottom sheet with grouped relationships.
5. **Visualise** → tap "View" → bottom sheet → pick Flat / Globe → graph overlay enters.

Search is persistent. Search results feed directly into the list view and into the
detail drawer; the graph becomes a visual summary of the current search/filter
state, not an entry point.

### View default
`view` starts `'accessible'` whenever `(pointer: coarse)` OR viewport ≤ 900px.
This is driven by `initialViewState()` in `useGraphState.ts`.

`renderMode` (flat/globe) only matters when `view === 'visual'`, and is only
exposed through the View sheet.

---

## 2. Viewport breakpoints

| Range | Behaviour |
|---|---|
| `> 900px` | Desktop. Sidebar + stage. Header + stats inline. |
| `≤ 900px` | Mobile IA. Sidebar hidden. MobileTopBar + MobileControls. |
| `≤ 760px` | Stricter mobile density (smaller type scale, tighter chips). |
| `(max-height: 500px)` | Height-critical: strip logos, compress stats to single line, suppress hints. |
| `(orientation: landscape) and (max-height: 500px)` | Phone in landscape (e.g. iPhone rotated): header + search collapse to single row, hamburger ≡ to reach controls. |
| `(pointer: coarse)` | Same as ≤900px, regardless of width. (iPad Mini, etc.) |
| `(prefers-reduced-motion: reduce)` | Disable FLIP/graph transitions; instant detail expansion. |

In code, mobile is detected via:

```ts
const isMobile = useMediaQuery('(pointer: coarse), (max-width: 900px)')
```

Media queries in `mobile.css` use the same breakpoint tokens, and the
`(max-height: 500px)` rules are stacked under `body.ui-mobile`.

---

## 3. Component-by-component plan

### 3.1 AppHeader → MobileTopBar

**Decision:** Desktop AppHeader stays for > 900px. MobileTopBar replaces it for
≤ 900px. No conditional sub-tree, two separate components.

**MobileTopBar structure:**
- left: wordmark `CeNSE Ecosystem` (no institutional logos)
- center: text-first SearchInput (full-width, prominent, 44px touch target)
- right: text-based "More" trigger (opens the More sheet — see 3.6)

**Behaviour:**
- Sticky at top, `backdrop-filter: blur(6px)` over dark surface.
- At ≤ 760px, no vertical padding above/below input; height = 48px total.
- At max-height ≤ 500px, reduce height to 40px and drop the wordmark to text-only
  14px.
- No icons. All actions are text labels.

**Search:**
- Same search pipeline as desktop (SearchBar component owns `onSearch`,
  `onSearchFocusNode`, `onClear`).
- Results list appears as a parked dropdown *under* the input. Tapping a result
  focuses the node in the graph (if visible) OR navigates to the accessible list /
  detail view (if in list mode). This is implemented by switching `view` to
  `accessible` when a result is selected on mobile.

### 3.2 StatsBar → MobileStatsChip

**Decision:** The 4-count grid is too tall for mobile. Collapse to a single
text-line chip:

```
19 F · 7 V · 7 P · 25 C   ·   Refreshed 04 Aug
```

**Hierarchy:**
1. Primary: counts (F/V/P/C).
2. Secondary (tertiary on desktop): `Showing 33/33 nodes, 104/104 relationships`
   — hidden by default, revealed on tap or via More sheet.
3. Tertiary: refreshed timestamp — collapsed to `· Refreshed HH:MM` next to
   counts.

**Behaviour:**
- Renders inside `MobileControls` (below the trigger row).
- Tap to expand → shows full "Showing N/M nodes..." line and full timestamp.
- At max-height ≤ 500px, suppress entirely — counts are secondary to reading.

### 3.3 ControlPanel → MobileControls

**Decision:** Do NOT render the 260px ControlPanel sidebar on mobile. Replace
with a trigger row + bottom sheets.

**Trigger row** (MobileControls renders):
- `Filters` — button, opens Filter sheet
- `View` — button, opens View sheet (graph / flat / globe / accessible)
- `More` — button, opens More sheet (extras: Refresh / Export / Legend / About)

**Trigger row behaviour:**
- Sticky under MobileTopBar (same blur + surface).
- Each button shows a plain text label with a small count badge if active
  (e.g. `Filters ▾ 2`).
- Buttons must not be icon-only — text labels per Swiss discipline.

**Filter sheet** contents (in order):
1. Sector facet — three collapsible sections (Research, Education, Innovation).
   Feature-flagged on.
2. Type chips — visible iff `showFacets !== true`.
3. Layer chips — visible iff `showFacets !== true`.
4. "Show N results" / "Reset" (bottom row).

**View sheet** contents:
1. `Accessible list` — selected on mobile by default.
2. `Flat graph` — 2D node-link.
3. `Globe` — 3D globe (warning: heavy texture + three.js on low-end phones).

**More sheet** contents:
1. `Refresh data`
2. `Export PNG`
3. `Export SVG`
4. `Legend: node types` — expands to the same legend list.
5. `About this diagram` — opens the existing AccessibilityOverlay content.
6. `Reset` (hard) — full state reset.

### 3.4 SectorFilter

**Decision:** Not rendered on mobile standalone. Lives inside the Filter sheet.

**Mobile-specific behaviour:**
- Read-only heading "Facet / {name}" on the left; chips are full-width text rows
  (44px touch target), not the small desktop chips.
- "Select all / Clear all" sit at the top-right of the sheet header when a facet
  group is expanded.

### 3.5 Graph overlays

**Affected existing surfaces:**
- DetailDrawer
- AccessibilityOverlay (More → About)
- ZoomControls
- FocusControls / `.corner-dock`
- StatsBar (inside the desktop header)

**Mobile override:**
- DetailDrawer: rendered as a **bottom sheet** (same `MobileSheet` component) —
  slides up, capped at 75vh, full-width, drag-to-dismiss. Content is unchanged
  (semantic ULs and DLs read fine in this shape).
- ZoomControls: **not rendered** on mobile. Pinch-to-zoom on the graph handles
  zoom; the +/- buttons are content overhead.
- FocusControls (Enter focus mode): **not rendered** on mobile. Focus mode is
  a desktop affordance.
- `.corner-dock`: **not rendered** on mobile to prevent it overlaying legend /
  sheet chrome.
- StatsBar: rendered as MobileStatsChip (see 3.2).

### 3.6 MobileSheet (the bottom-sheet primitive)

A single generic component used by DetailDrawer, Filter sheet, View sheet, and
More sheet. CSS + React hooks, **no animation library** — transform + opacity
transitions:

- backdrop + sheet markup portaled to `document.body`.
- Escape closes; tap backdrop closes; swipe down dismisses.
- `max-height: 85vh`; content scrolls internally.
- Sticky header with text label + `Close` text button.
- On `(prefers-reduced-motion: reduce)`, transitions are instant.

### 3.7 Accessible view

**Already strong on mobile.** Changes needed are purely presentational:
- `.acc-shell` uses single-column card layout under 900px.
- Group headers (AccessibilityModeChip) collapse into `view=all` by default.
- `.acc-controls` moves into the Filter sheet (Search works directly against the
  list).
- `.acc-summary-chip` for verdict counts compresses to `Selected ✓ Collab ⚬ …`
  line so it doesn't take extra vertical space.
- Detail expansion uses native `<details>` / `<summary>` semantics (no chevrons)
  and a clean keyboard flow.

### 3.8 MobileGraphHint

Small text-only hint shown below the trigger row when `view !== 'accessible'`:

```
Tap a node for details · Pinch to zoom · Graph renders best on larger screens
```

Rendered once per mobile session to set expectations, dismissible with a tap.

---

## 4. State changes in `useGraphState.ts`

```ts
// NEW: explicit setter for mobile filter chips
setFilters: (updater: (prev: GraphFilters) => GraphFilters) => void

// MODIFIED: entry default
initialViewState: () => ViewState  // returns { view: coarse ? 'accessible' : 'visual', ... }
```

`resetAll` already handles hard reset; `softReset` clears filters+selection without
resetting view — used by `Filters → Clear all`.

View-mode switching on mobile is the same `setView` we use on desktop; the
App.tsx conditional simply renders different chrome for `isMobile`.

---

## 5. Decisions summary table

| Control | Desktop | Mobile | Reason |
|---|---|---|---|
| AppHeader logos | ✓ | hidden | vertical space, academic modesty |
| Search bar | ✓ | ✓ (prominent) | search is the entry point on mobile |
| StatsBar counts | grid | single line chip | height budget |
| StatsBar "Showing x/y" | ✓ | collapsed by default | tertiary metadata |
| StatsBar refreshed | ✓ | secondary text | tertiary metadata |
| Reset (header) | ✓ | More sheet | demote |
| Refresh (header) | ✓ | More sheet | demote |
| Export (header) | ✓ | More sheet | demote |
| ControlPanel sidebar | ✓ | hidden | vertical space |
| SectorFilter | sidebar | Filter sheet | density |
| LayerFilter | sidebar | Filter sheet | density |
| TypeFilter | sidebar | Filter sheet | density |
| View switcher | sidebar | View sheet | density |
| Legend | sidebar | More sheet (conditional) | density |
| DetailDrawer | right column | bottom sheet | mapping to native idiom |
| AccessibilityOverlay | overlay | bottom sheet (via More) | mapping to native idiom |
| ZoomControls | ✓ | hidden | pinch-to-zoom on graph |
| FocusControls | ✓ | hidden | desktop affordance |
| Theme toggle | ✓ | top bar (text) | keep parity, one tap |
| `.corner-dock` | ✓ | hidden | prevents overlaying |
| Focus hint | after selection | suppressed on mobile | mobile context already brief |

---

## 6. Suggested copy and labels (mobile only)

| Element | Copy |
|---|---|
| Wordmark | CeNSE Ecosystem |
| Search placeholder | Search faculty, verticals, platforms… |
| Stats chip | 19 F · 7 V · 7 P · 25 C |
| Stats chip expanded | Showing 33 nodes · 104 relationships · Refreshed HH:MM |
| Filter trigger | Filters |
| Filter sheet heading | Refine results |
| Filter sheet primary CTA | Show N results |
| Filter sheet secondary | Reset |
| View trigger | View |
| View sheet heading | View |
| View sheet rows | Accessible list / Flat graph / Globe |
| View sheet footer | Accessible view is selected |
| More trigger | More |
| More sheet heading | Options |
| More sheet rows | Refresh data / Export PNG / Export SVG / Legend: node types / About this diagram / Reset |
| Detail sheet heading | (entity name) — auto-populated |
| Graph sheet heading | Graph — Flat / Graph — Globe |
| MobileGraphHint | Tap a node for details · Pinch to zoom · Graph renders best on larger screens |
| Accessibility switcher (view=all) | All |

---

## 7. Implementation order

1. `src/hooks/useMediaQuery.ts` — `useMediaQuery(query)` hook.
2. `src/styles/mobile.css` — gated layer under `body.ui-mobile`, scoped overrides
   for app-header, stats-bar, main grid, control-panel, corner-dock, detail-drawer.
3. `src/styles/tokens.css` — add `--color-text-high` contrast tokens for
   `prefers-contrast: more`.
4. `src/components/mobile/MobileSheet.tsx` — generic bottom sheet.
5. `src/components/mobile/MobileTopBar.tsx` — wordmark + search + more toggle.
6. `src/components/mobile/MobileControls.tsx` — trigger row + 3 sheets + stats chip.
7. `src/components/mobile/MobileGraphHint.tsx` — one-shot text hint.
8. `src/hooks/useGraphState.ts` — `setFilters`, mobile entry default via
   `(pointer: coarse)`.
9. `src/app/App.tsx` — wire `isMobile`, body class, conditional mobile chrome.
10. `src/styles/app.css` — `@import '../styles/mobile.css';` at end.

---

## 8. Known non-goals and follow-ups

- **No** automated visual regression snapshots for mobile in this pass — manual
  screenshot matrix only.
- **No** PDF/print stylesheet changes.
- **No** dedicated mobile keyboard-shortcut system (shortcuts already no-op on
  coarse pointers).
- Globe on low-end phones remains heavy; consider a static list fallback if it
  ever ships to that audience.
- After implementation, save the following to memory / skill notes:
  - `body.ui-mobile` is the CSS gate.
  - `useMediaQuery` is the React gate.
  - View state on mobile defaults to accessible.
  - Overlay surfaces (drawer, sheets) live in `src/components/mobile/`.

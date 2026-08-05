# Mobile + Accessible View Design Plan

## Goal

Redesign the mobile experience of the CeNSE Interactive Ecosystem Network Diagram so it feels intentional, readable, and Swiss-class rather than like a compressed desktop layout. The app is informational, academic, and intranet-hosted, so the mobile UI should prioritize clarity, hierarchy, and fast orientation over dense control exposure.

The current mobile experience already has the right broad direction: a compact header, search, summary stats, Filters/View controls, and an Accessible View that mirrors the graph in readable form. The main issue is refinement: several sections still look visually unedited, typography wraps poorly, tables fight for horizontal space, and some controls feel bolted on rather than composed.

---

## Product stance

Use the same information architecture, but different interaction priorities by viewport.

- Mobile should be optimized for lookup, reading, and selective exploration.
- Accessible View should be the default mobile exploration surface.
- Graph views should remain available, but should not dominate the first-run mobile experience.
- Keep the interface text-first and avoid introducing icon-heavy chrome.

---

## Current problems visible in the screenshots

### Header
- The header still carries logo artwork and a truncated wordmark.
- The header background does not blend seamlessly with the logo area, creating a visible seam.
- The wordmark is cut off instead of wrapping gracefully.

### Stats bar
- The metrics row feels dropped in rather than composed.
- The “Refreshed” timestamp competes with the metrics even though it is secondary metadata.
- The row is readable, but not yet elegant.

### Accessible View
- The Accessible View is promising, but the tables are not yet mobile-native.
- In the Research Verticals table, narrow columns force ugly wrapping such as “VERTIC / AL” and “SE / CT / O / R”.
- In the Collaborations table, Faculty A repeats too often and consumes too much horizontal space.
- The Platforms section is more readable than the tables, but still feels like stacked field labels rather than a designed card/list system.
- The interface currently reads as static content; it does not yet support entity-centric navigation.

### Hamburger / options sheet
- The options sheet is useful, but visually flat and generic.
- Item grouping is weak.
- The sheet mixes theme, refresh, export, legend, about, and reset without enough hierarchy.

---

## Design principles

Use a restrained Swiss-inspired system:

- Text-first controls, not icon-led controls
- Strong alignment and spacing discipline
- Neutral surfaces, subtle borders, minimal ornament
- Clear hierarchy through type, spacing, and grouping
- Content before chrome
- Mobile layouts should be editorial and scannable, not mini-dashboards

---

## Mobile information architecture

### Recommended mobile structure

1. Compact header
2. Search
3. Compact stats/meta row
4. Filters / View controls
5. Accessible View content
6. Contextual sheets for filters, legend, options, export

### Default mobile behavior
- Default to Accessible View on mobile.
- Treat Flat and Globe as secondary views.
- Search results should open entity-focused Accessible View states, not just graph highlights.

---

## Header plan

### What to change
- Remove logo artwork in mobile mode.
- Keep only the wordmark.
- Match the header background exactly to the surrounding app background so there is no visible seam.
- Allow the wordmark to wrap to two lines instead of truncating.

### Recommended behavior
- Use a compact institutional wordmark such as:
  - `Centre for Nanoscience and Engineering`
  - Optional smaller support line: `CeNSE · IISc`
- If space is tight, wrap naturally rather than ellipsizing.
- Keep the hamburger trigger, but make it visually quieter and aligned to the same surface system.

### Notes
The goal is not to erase identity; it is to reduce institutional overhead on a small screen. A clean typographic wordmark is more appropriate here than a logo lockup.

---

## Stats bar plan

### Problem
The current stats row is functional but visually careless: all items have similar emphasis, and the refreshed timestamp sits too close in hierarchy.

### Better treatment
Use a two-level composition:

#### Primary row
A compact, aligned metrics strip:
- `19 Faculty`
- `7 Verticals`
- `7 Platforms`
- `25 Collaborations`

#### Secondary row
A quieter metadata line:
- `Showing 33/33 nodes · 104/104 relationships`
- `Refreshed 23:52`

### Layout rules
- Use consistent spacing and alignment.
- Prefer a single-row metrics strip on wider phones.
- Allow a 2x2 arrangement only if the viewport is very narrow.
- Keep the metadata line visibly subordinate: smaller, muted, and separated by a hairline or spacing.
- Do not let the stats bar become a second header.

### Optional refinement
On scroll, collapse the stats block into a slimmer summary or let it scroll away entirely. The stats are orientation context, not persistent navigation.

---

## Accessible View content strategy

The Accessible View should feel like the primary reading experience, not a fallback for screen readers only.

That means:
- Strong section headings
- Better spacing rhythm
- Mobile-native entity layouts
- Tap targets on entities
- Cross-linking between related sections

---

## Table redesigns

## 1. Collaborations

### Current issue
Faculty A repeats across rows and consumes too much width, forcing the table into awkward wrapping.

### Recommended pattern
Convert the table into grouped relationship blocks.

#### Pattern
For each Faculty A:
- Render Faculty A once as a group header
- Under it, list each related Faculty B + project/topic as a sub-row

#### Example structure
```text
Aditya Sadhanala
  Sushobhan Avasthi — Perovskite solar cells
  Another Collaborator — Topic

Akshay Naik
  Dhavala Suri — Superconducting devices
  Manoj Varma — Nanopores
  Pavan Nukala — Optomechanics
```

### Why this works
- Removes repetition
- Saves horizontal space
- Improves scanability
- Creates a more editorial, less spreadsheet-like presentation

### Implementation guidance
- Use semantic HTML lists or definition-list-like structures rather than forcing a 3-column table on narrow screens.
- Keep the group header sticky only if it does not create weird overlap during scroll.
- If a table is retained for desktop, switch to grouped cards/lists below a mobile breakpoint.

---

## 2. Research Verticals

### Current issue
The table columns are too narrow for mobile, causing severe word breaks in headers and content.

### Recommended pattern
Convert each vertical into a compact entity card or stacked row.

#### Suggested structure
```text
Advanced Electronics
Sector: Industry Relevance
Faculty: Aditya Sadhanala, Chandan Kumar, Digbijoy Nath, ...
```

### Design treatment
- Use the vertical name as the primary heading.
- Put sector on a muted secondary line.
- Put faculty in a readable wrapped body line.
- Add a subtle divider between entries.

### Important
Do not force multi-column tables on mobile if the content naturally wants to be stacked. A Swiss layout is not “table at all costs”; it is disciplined hierarchy.

---

## 3. Platforms

### Current state
This section is closer to the right idea, but still feels like repeated field labels rather than a polished mobile component.

### Recommended pattern
Use a consistent card/list treatment aligned with Research Verticals.

#### Suggested structure
```text
Characterization Platform
Sector: Strategic Sector
Description: Electron microscopy, spectroscopy, XRD, electrical characterization
Faculty: Akshay Naik, Ambarish Ghosh, Chandan Kumar, ...
```

### Design treatment
- Platform name as heading
- Sector as metadata
- Description and faculty as readable body text
- Consistent spacing between entries
- Avoid overly heavy label styling for every field

### Consistency rule
Research Verticals and Platforms should feel like sibling components, not unrelated sections.

---

## Entity clickability and point-of-view navigation

Yes, this absolutely makes sense.

### Concept
Make every entity mention clickable:
- Faculty
- Research Vertical
- Platform

When tapped, the app should switch into an entity-focused reading state.

### Behavior
Tapping an entity should:
1. Identify the entity type and ID
2. Smooth-scroll to the most relevant section or open a focused detail panel
3. Filter or highlight related records in the Accessible View

### Best interaction model
Use a shared “entity focus” system.

#### Example
If I tap `Akshay Naik`:
- Scroll to a Faculty detail block for Akshay Naik
- Show:
  - related verticals
  - related platforms
  - collaborations
- Optionally filter the rest of the page to that entity’s point of view

If I tap `Advanced Electronics`:
- Scroll to that vertical’s block
- Show associated faculty and related platforms/collaborations

### UX recommendation
Do not merely jump to a table row. Instead, create a focused entity view or section anchor with contextual highlighting.

### Implementation options
Choose one of these:

#### Option A: In-page focused sections
- Each entity has a canonical block in Accessible View
- Clicking a mention smooth-scrolls to that block
- Related mentions are highlighted

#### Option B: Entity detail sheet
- Tapping an entity opens a bottom sheet or side panel
- Sheet shows that entity’s relationships
- Includes “View in Accessible View” action

#### Option C: Filtered Accessible View
- Tapping an entity filters the whole Accessible View to that entity’s network
- Add a clear “Clear entity focus” control

### Recommendation
Use Option A + C together:
- Smooth scroll to the relevant section
- Apply a temporary entity focus filter/highlight state

This gives both orientation and point-of-view exploration.

---

## Hamburger / options sheet improvements

### Current issue
The sheet is useful but visually generic. It mixes unrelated actions in one flat list.

### Better structure
Group the sheet into sections:

#### Display
- Switch to light mode
- Legend: node types

#### Data
- Refresh data
- Export PNG
- Export SVG

#### Help
- About this diagram

#### Danger / reset
- Reset

### Design improvements
- Add section labels in small caps or muted type
- Increase row height for touch comfort
- Use dividers sparingly
- Keep text-only actions
- Make Reset visually distinct but not hysterical
- Keep Close in a predictable position

### Naming improvement
“Options” is generic. Consider:
- `Menu`
- `More`
- `Settings & actions`

For this app, `Menu` is probably enough.

---

## Controls to hide, demote, or keep on mobile

### Keep visible
- Search
- Filters
- View
- Menu trigger

### Demote into sheets or contextual areas
- Export PNG / SVG
- Refresh data
- Legend
- Theme toggle
- Reset

### Hide by default in graph mode
- +/- zoom controls
- Any persistent desktop-style graph chrome that duplicates gesture behavior

### Rule
Only keep controls in the top region that help the user answer: “What am I looking at, and how do I change the current view?”

---

## Visual design refinements

## Typography
- Reduce aggressive all-caps usage in body/table content.
- Use all-caps only for tiny metadata labels, not for long entity names.
- Avoid letter-spacing on long text; it hurts readability.
- Use stronger weight contrast instead of forcing uppercase everywhere.

## Spacing
- Increase vertical rhythm between sections.
- Use consistent padding inside cards and rows.
- Use hairline dividers rather than large empty gaps where possible.

## Surfaces
- Keep backgrounds quiet and neutral.
- Use subtle surface elevation for sheets and cards.
- Avoid boxed-everything styling; let whitespace and dividers do more work.

## Color
- Keep color usage restrained.
- Use sector colors as small accents only, not as large decorative fills.
- Ensure selected states are visible without relying on color alone.

---

## Suggested mobile component system

### Header
- Compact wordmark
- Menu button

### Search
- Full-width search field
- Optional subtle helper text only if needed

### Stats
- Compact metrics row
- Secondary metadata row

### Controls
- Two-button row: Filters / View

### Accessible sections
- Summary
- Sectors
- Research Verticals
- Platforms
- Collaborations
- Faculty

### Sheets
- Filters sheet
- View sheet
- Menu sheet
- Entity detail sheet (optional)

---

## Breakpoint and behavior guidance

### Small phones
- Accessible View default
- Wordmark wraps to two lines
- Stats may become 2x2
- Tables become grouped lists/cards

### Larger phones / small tablets
- Stats can remain single-row
- More breathing room between sections
- Still prefer stacked entity layouts over narrow tables

### Desktop
- Tables may remain tabular if they are comfortable
- Entity clickability should still work the same way

---

## Specific implementation notes for the coding agent

### 1. Header
- Remove logos on mobile breakpoints
- Match header background to app background exactly
- Replace truncation with wrapping
- Keep menu trigger aligned right

### 2. Stats
- Split stats into primary metrics and secondary metadata
- Reduce visual weight of refreshed timestamp
- Add consistent spacing and alignment

### 3. Collaborations
- Replace repeated Faculty A table rows with grouped Faculty A sections
- Render Faculty B + topic as child rows beneath each Faculty A
- Preserve desktop table if desired, but switch to grouped layout on mobile

### 4. Research Verticals
- Replace narrow table with stacked entity cards/list rows
- Use vertical name as heading
- Show sector and faculty below in readable lines

### 5. Platforms
- Normalize Platforms to the same visual language as Research Verticals
- Keep name, sector, description, faculty in a consistent stacked layout

### 6. Entity clickability
- Make faculty, verticals, and platforms clickable throughout Accessible View
- Implement smooth scrolling to relevant entity sections
- Add temporary focus/highlight state for selected entity
- Optionally add entity filtering mode with a clear reset action

### 7. Menu sheet
- Group actions into Display / Data / Help / Reset
- Improve row spacing and hierarchy
- Keep text-only action labels

---

## Acceptance criteria

The redesign is successful when:

- The mobile header feels seamless and compact
- The wordmark never truncates awkwardly
- Stats read as a composed summary, not a loose strip of text
- Accessible View feels like the primary mobile experience
- Collaborations no longer repeat Faculty A unnecessarily
- Research Verticals and Platforms use consistent mobile-friendly layouts
- Tapping any entity gives a useful point-of-view navigation result
- The menu sheet feels grouped and intentional
- The whole interface remains text-first, restrained, and academically appropriate

---

## Short prompt for the coding agent

```text
Redesign the mobile experience of the CeNSE Interactive Ecosystem Network Diagram with a Swiss-inspired, text-first, academic visual language.

Context:
- The app is informational and intranet-hosted
- Mobile should prioritize lookup, reading, and selective exploration
- Accessible View should be the default mobile exploration surface
- Avoid icon-heavy chrome and preserve the text-led interface

Required changes:

1. Header
- Remove logos on mobile
- Keep only the wordmark
- Match header background exactly to app background so no seam is visible
- Let the wordmark wrap instead of truncating

2. Stats bar
- Recompose the stats area into a clear hierarchy
- Keep primary metrics prominent: faculty, verticals, platforms, collaborations
- Demote “showing x/y” and “refreshed” metadata
- Make spacing and alignment feel deliberate

3. Accessible View tables
- Redesign Collaborations so Faculty A appears once as a group header, with Faculty B + project/topic rows nested below
- Redesign Research Verticals as stacked mobile-friendly entity rows/cards instead of narrow columns
- Normalize Platforms to the same design language as Research Verticals
- Make all three sections feel related and well-spaced

4. Entity clickability
- Make Faculty, Vertical, and Platform mentions clickable
- Clicking should smooth-scroll to the relevant section and apply a temporary focus/highlight state
- Ideally support an entity-focused point-of-view mode with a clear way to reset it

5. Hamburger/menu sheet
- Improve hierarchy and grouping
- Group actions into logical sections such as Display, Data, Help, Reset
- Keep the sheet text-first and calm

6. General mobile refinement
- Reduce awkward all-caps text usage
- Improve spacing rhythm and dividers
- Keep controls minimal and only expose what is needed at the top level
- Hide graph-specific controls unless graph view is active

Deliver:
- Updated mobile layout
- Improved Accessible View mobile components
- Entity navigation behavior
- Notes on any breakpoint-specific logic
```

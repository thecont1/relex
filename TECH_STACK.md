# Tech Stack Overview

## Core Framework & Build Tools

**React 18.3.1** - UI framework with hooks-based state management. Uses `StrictMode` for development checks and the new `createRoot` API for concurrent rendering.

**Vite 5.4.10** - Build tool and dev server. Configured with:
- Relative base path (`./`) for intranet deployment flexibility
- Dev server on port 5173 with Docker host support
- Preview server on port 4173
- ES2022 target for modern JavaScript features
- Source maps disabled for production builds

**TypeScript 5.6.3** - Type safety with strict mode enabled. Configured for:
- ES2022 target with DOM libraries
- React JSX transform
- Bundler module resolution
- Strict type checking including no unused locals/parameters

## Data Processing Layer

**XLSX (SheetJS) 0.18.5** - Parses the Excel workbook (`CeNSE_Master_Ecosystem_Dataset.xlsx`) containing faculty, platforms, verticals, and collaboration data.

**Data Pipeline Flow:**
1. [useWorkbookData](cci:1://file:///Users/home/DEV/tools/relexplorer/src/hooks/useWorkbookData.ts:15:0-57:1) hook fetches the Excel file from `/public/data/`
2. `loadWorkbook` parses the Excel into raw JavaScript objects
3. `validateWorkbook` checks data quality and reports issues
4. [buildGraph](cci:1://file:///Users/home/DEV/tools/relexplorer/src/lib/buildGraph.ts:12:0-171:1) transforms validated data into a canonical graph model with nodes (faculty, platforms, verticals) and edges (affiliations, collaborations)

## Graph Visualization

**Cytoscape 3.30.2** - Core graph rendering engine for the 2D flat view. Handles:
- Force-directed layout using fcose algorithm
- Interactive pan/zoom
- Node/edge styling and theming
- Event handling (click, hover, keyboard navigation)

**Cytoscape-fcose 2.2.0** - Fast layout algorithm that organizes nodes into aspect-aware bands (verticals top, faculty middle, platforms bottom) to prevent edge crossings and ensure all nodes fit without scrolling.

**Cytoscape-svg 0.4.0** - Enables SVG export functionality for the graph.

**3D Force Graph 1.80.0** - Alternative 3D globe renderer (via `GlobeCanvas` component) using Three.js for spherical network visualization.

**Three.js 0.185.1** - 3D rendering engine used by the globe view for WebGL-based visualization.

## Animation & Motion

**GSAP 3.12.5** - Animation library used for:
- Fade-in effects on app load
- Focus mode transitions
- Smooth UI state changes

## State Management Architecture

**Custom React Hooks** - No external state library; uses React's built-in hooks:

- [useWorkbookData](cci:1://file:///Users/home/DEV/tools/relexplorer/src/hooks/useWorkbookData.ts:15:0-57:1) - Manages data loading lifecycle (idle → loading → ready/error) with cancellation token pattern to prevent race conditions
- [useGraphState](cci:1://file:///Users/home/DEV/tools/relexplorer/src/hooks/useGraphState.ts:50:0-172:1) - Centralized UI state for filters, search, drawer, view mode, and focus mode. Computes visible node/edge sets based on current filters
- `useReducedMotion` - Respects user's motion preferences for accessibility

## Component Architecture

**App.tsx** - Root component orchestrating:
- Data loading and error handling
- Theme switching (dark/light mode)
- Export functionality (PNG/SVG)
- Live region announcements for screen readers
- Integration of all sub-components

**GraphCanvas.tsx** - 2D Cytoscape renderer with:
- Aspect-aware band layout
- Dynamic node sizing based on degree centrality
- Hub/peripheral classification for visual hierarchy
- Keyboard navigation (roving focus)
- Highlight controller for hover/pin states
- Inline label sizing for platforms/verticals

**GlobeCanvas.tsx** - 3D spherical view using 3D Force Graph

**ControlPanel.tsx** - Filter controls for toggling platforms, verticals, collaborations, and sector selection

**DetailDrawer.tsx** - Sidebar showing node details with ego network visualization

**AccessibleView.tsx** - Screen-reader-friendly text-based alternative to visual graph

## Key Integration Points

1. **Data Flow**: Excel → XLSX parser → validation → graph model → visual renderers
2. **State Flow**: User actions → [useGraphState](cci:1://file:///Users/home/DEV/tools/relexplorer/src/hooks/useGraphState.ts:50:0-172:1) → filter computation → visible sets → renderer updates
3. **Theme System**: CSS custom properties with data attributes for dark/light switching
4. **Accessibility**: Live regions announce state changes; keyboard navigation works in both visual and accessible views
5. **Export**: Cytoscape instance exposed via ref to export functions that generate PNG/SVG downloads

The architecture prioritizes separation of concerns: data processing, UI state, and rendering are distinct layers, making it easy to add new visualizations or modify the data pipeline without affecting other components.
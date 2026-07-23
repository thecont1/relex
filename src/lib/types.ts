// Shared graph & workbook types.
// Keep these as the single source of truth — they cross the loader/validator/normalizer/UI boundary.

export type NodeType = 'faculty' | 'platform' | 'vertical';
export type EdgeType = 'faculty-platform' | 'faculty-vertical' | 'faculty-faculty';

export interface GraphNode {
  id: string;            // canonical id (e.g. "faculty:Aditya Sadhanala")
  type: NodeType;
  label: string;         // display label
  category: string | null; // Sector for platform/vertical; null for faculty
  description?: string;
  /** Degree = total connected edges across all types. */
  degree: number;
  /** Per-edge-type counts. */
  counts: {
    platforms: number;
    verticals: number;
    collaborators: number;
  };
  /** IDs of directly connected nodes. */
  connectedIds: string[];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  /** number of underlying relationship rows merged into this edge */
  projectCount: number;
  /** merged project/topic strings */
  projects: string[];
  /** collaboration weight (>=1). Equal to projectCount for collab edges; 1 for affiliation. */
  weight: number;
  /** category/sector of the non-faculty endpoint, where applicable (for styling) */
  sector: string | null;
}

export interface GraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
  sectors: string[];          // distinct sectors, in order of first appearance
  counts: {
    faculty: number;
    platforms: number;
    verticals: number;
    edges: Record<EdgeType, number>;
  };
}

/** Lightweight view-state for the UI; not serialized into the graph model itself. */
export interface GraphFilters {
  showPlatforms: boolean;
  showVerticals: boolean;
  showCollaborations: boolean;
  showRelationships: boolean;
  /** Sector filter: empty set = no filter; otherwise only nodes/edges whose category matches */
  activeSectors: Set<string>;
}

export interface DrawerState {
  open: boolean;
  nodeId: string | null;
}

export interface SearchState {
  query: string;
  /** Node id currently focused (if any). */
  focusId: string | null;
}

export type ViewMode = 'visual' | 'accessible';

/** App chrome + graph background theme. */
export type ThemeMode = 'dark' | 'light';

/** Rendering mode for the visualization canvas. Accessible view is independent. */
export type RenderMode = 'flat' | 'globe';

// ---------- Workbook shapes ----------

export interface PlatformRow {
  'Platform ID': string;
  'Platform': string;
  'Description': string;
  'Sector': string;
}
export interface FacultyRow {
  'Faculty ID': string;
  'Faculty': string;
}
export interface FacultyPlatformRow {
  'Faculty': string;
  'Platform': string;
}
export interface VerticalRow {
  'Vertical ID': string;
  'Research Vertical': string;
  'Sector': string;
}
export interface FacultyVerticalRow {
  'Faculty': string;
  'Research Vertical': string;
}
export interface CollaborationRow {
  'Faculty A': string;
  'Faculty B': string;
  'Project/Topic': string;
}

export interface WorkbookData {
  platforms: PlatformRow[];
  faculty: FacultyRow[];
  facultyPlatforms: FacultyPlatformRow[];
  verticals: VerticalRow[];
  facultyVerticals: FacultyVerticalRow[];
  collaborations: CollaborationRow[];
}

// ---------- Validation result ----------

export type Severity = 'error' | 'warning';

export interface WorkbookIssue {
  severity: Severity;
  sheet: string;
  message: string;
  rowIndex?: number;
}

export interface ValidationResult {
  ok: boolean;
  issues: WorkbookIssue[];
}

export interface LoadedWorkbook {
  data: WorkbookData;
  validation: ValidationResult;
  /** ISO timestamp of when the workbook was fetched+parsed. */
  refreshedAt: string;
}
// Workbook schema validation.
//
// Sheet names and column names are read from the tenant config (injected at
// build time), not hardcoded. This allows future clients with different domain
// models to be supported without touching core code — they just provide their
// own tenant.config.json with the appropriate sheet/column mapping.
//
// Non-fatal data quality issues (blank sectors, unknown refs, duplicate rows,
// malformed collaboration rows) are surfaced as warnings.

import { tenantConfig } from '../tenant/config';
import type {
  WorkbookData,
  ValidationResult,
  WorkbookIssue,
  PlatformRow,
  FacultyRow,
  FacultyPlatformRow,
  VerticalRow,
  FacultyVerticalRow,
  CollaborationRow
} from './types';

// Raw sheet shapes produced by SheetJS — column keys are not type-narrowed yet.
type RawRows = Record<string, unknown>[];

// Resolve the sheet/column mapping from the tenant config.
// The config stores sheets as a map of sheet-name → required-columns.
// We need the reverse: given a logical role (platforms, faculty, etc.),
// find the sheet name and columns. For the standard schema, the sheet names
// are the keys. For custom schemas, the tenant config defines the mapping.
const schema = tenantConfig.schema;

// Build a lookup from the config's sheet map.
// The config maps sheet names to their required columns.
// We derive the logical roles from the sheet names themselves.
const SHEET_COLUMNS: Record<string, readonly string[]> = schema.sheets;

// Logical role → sheet name mapping. For the standard schema, these are
// the canonical sheet names. For custom schemas, the tenant config's
// sheet names are used directly.
const ROLE_TO_SHEET: Record<string, string> = {};
for (const sheetName of Object.keys(SHEET_COLUMNS)) {
  // Map common role names to sheet names. This is a best-effort mapping
  // that works for the standard schema. For custom schemas, the sheet
  // names in the config ARE the sheet names used in the workbook.
  const lower = sheetName.toLowerCase();
  if (lower.includes('platform') && !lower.includes('faculty')) {
    ROLE_TO_SHEET['platforms'] = sheetName;
  } else if (lower === 'faculty') {
    ROLE_TO_SHEET['faculty'] = sheetName;
  } else if (lower.includes('faculty_platform') || (lower.includes('faculty') && lower.includes('platform'))) {
    ROLE_TO_SHEET['facultyPlatforms'] = sheetName;
  } else if (lower.includes('vertical') && !lower.includes('faculty')) {
    ROLE_TO_SHEET['verticals'] = sheetName;
  } else if (lower.includes('faculty_vertical') || (lower.includes('faculty') && lower.includes('vertical'))) {
    ROLE_TO_SHEET['facultyVerticals'] = sheetName;
  } else if (lower.includes('collab')) {
    ROLE_TO_SHEET['collaborations'] = sheetName;
  }
}

// Helper: get the sheet name for a logical role, falling back to the
// config key name itself.
function sheetFor(role: string): string | undefined {
  return ROLE_TO_SHEET[role];
}

// Helper: get required columns for a sheet name.
function colsFor(sheetName: string): readonly string[] | undefined {
  return SHEET_COLUMNS[sheetName];
}

export interface RawWorkbook {
  [sheetName: string]: RawRows;
}

export function validateWorkbook(raw: RawWorkbook): { data: WorkbookData; validation: ValidationResult } {
  const issues: WorkbookIssue[] = [];

  // ---- Sheet presence (fatal) ----
  for (const name of Object.keys(SHEET_COLUMNS)) {
    if (!Object.prototype.hasOwnProperty.call(raw, name)) {
      issues.push({ severity: 'error', sheet: name, message: `Missing required sheet \"${name}\".` });
    }
  }
  if (issues.some(i => i.severity === 'error')) {
    return { data: emptyData(), validation: { ok: false, issues } };
  }

  // ---- Column presence (fatal) ----
  for (const name of Object.keys(SHEET_COLUMNS)) {
    const rows = raw[name] ?? [];
    const cols = colsFor(name);
    if (!cols) continue;
    if (rows.length === 0) {
      issues.push({ severity: 'error', sheet: name, message: `Sheet \"${name}\" is empty.` });
      continue;
    }
    const present = new Set(Object.keys(rows[0]));
    const missing = cols.filter(c => !present.has(c));
    if (missing.length) {
      issues.push({
        severity: 'error',
        sheet: name,
        message: `Sheet \"${name}\" is missing required column(s): ${missing.join(', ')}.`
      });
    }
  }
  if (issues.some(i => i.severity === 'error')) {
    return { data: emptyData(), validation: { ok: false, issues } };
  }

  // ---- Coerce and run row-level validation ----
  // Use the resolved sheet names from the config. For the standard schema,
  // these resolve to the canonical sheet names. For custom schemas, they
  // resolve to whatever the tenant configured.
  const platformsSheet = sheetFor('platforms') ?? 'Platforms';
  const facultySheet = sheetFor('faculty') ?? 'Faculty';
  const facultyPlatformsSheet = sheetFor('facultyPlatforms') ?? 'Faculty_Platforms';
  const verticalsSheet = sheetFor('verticals') ?? 'Research_Verticals';
  const facultyVerticalsSheet = sheetFor('facultyVerticals') ?? 'Faculty_Verticals';
  const collaborationsSheet = sheetFor('collaborations') ?? 'Collaborations';

  const platforms = (raw[platformsSheet] ?? []).map(toPlatformRow);
  const faculty = (raw[facultySheet] ?? []).map(toFacultyRow);
  const facultyPlatforms = (raw[facultyPlatformsSheet] ?? []).map(toFacultyPlatformRow);
  const verticals = (raw[verticalsSheet] ?? []).map(toVerticalRow);
  const facultyVerticals = (raw[facultyVerticalsSheet] ?? []).map(toFacultyVerticalRow);
  const collaborations = (raw[collaborationsSheet] ?? []).map(toCollaborationRow);

  const facultyNames = new Set(faculty.map(f => f.Faculty));
  const platformNames = new Set(platforms.map(p => p.Platform));
  const verticalNames = new Set(verticals.map(v => v['Research Vertical']));

  // Blank sectors — warnings
  platforms.forEach((row, i) => {
    if (!row.Sector || !row.Sector.trim()) {
      issues.push({ severity: 'warning', sheet: platformsSheet, rowIndex: i + 2, message: `Blank Sector for platform \"${row.Platform}\".` });
    }
  });
  verticals.forEach((row, i) => {
    if (!row.Sector || !row.Sector.trim()) {
      issues.push({ severity: 'warning', sheet: verticalsSheet, rowIndex: i + 2, message: `Blank Sector for vertical \"${row['Research Vertical']}\".` });
    }
  });

  // Duplicate exact rows
  warnOnDuplicates(issues, platformsSheet, platforms, ['Platform ID']);
  warnOnDuplicates(issues, facultySheet, faculty, ['Faculty ID']);
  warnOnDuplicates(issues, facultyPlatformsSheet, facultyPlatforms, ['Faculty', 'Platform']);
  warnOnDuplicates(issues, facultyVerticalsSheet, facultyVerticals, ['Faculty', 'Research Vertical']);

  // Duplicate collaborations (same faculty pair, same project) — informational
  warnOnDuplicates(issues, collaborationsSheet, collaborations, ['Faculty A', 'Faculty B', 'Project/Topic']);

  // Unknown entity references
  facultyPlatforms.forEach((row, i) => {
    if (!facultyNames.has(row.Faculty)) {
      issues.push({ severity: 'warning', sheet: facultyPlatformsSheet, rowIndex: i + 2, message: `Unknown faculty \"${row.Faculty}\" in Faculty_Platforms.` });
    }
    if (!platformNames.has(row.Platform)) {
      issues.push({ severity: 'warning', sheet: facultyPlatformsSheet, rowIndex: i + 2, message: `Unknown platform \"${row.Platform}\" in Faculty_Platforms.` });
    }
  });
  facultyVerticals.forEach((row, i) => {
    if (!facultyNames.has(row.Faculty)) {
      issues.push({ severity: 'warning', sheet: facultyVerticalsSheet, rowIndex: i + 2, message: `Unknown faculty \"${row.Faculty}\" in Faculty_Verticals.` });
    }
    if (!verticalNames.has(row['Research Vertical'])) {
      issues.push({ severity: 'warning', sheet: facultyVerticalsSheet, rowIndex: i + 2, message: `Unknown vertical \"${row['Research Vertical']}\" in Faculty_Verticals.` });
    }
  });

  // Malformed / self-loop collaborations
  collaborations.forEach((row, i) => {
    const rowNum = i + 2;
    if (!row['Faculty A'] || !row['Faculty B']) {
      issues.push({ severity: 'warning', sheet: collaborationsSheet, rowIndex: rowNum, message: 'Malformed collaboration row: missing faculty name(s).' });
      return;
    }
    if (row['Faculty A'].trim() === row['Faculty B'].trim()) {
      issues.push({ severity: 'warning', sheet: collaborationsSheet, rowIndex: rowNum, message: `Self-collaboration ignored: \"${row['Faculty A']}\" ↔ \"${row['Faculty B']}\".` });
    }
    if (!facultyNames.has(row['Faculty A'])) {
      issues.push({ severity: 'warning', sheet: collaborationsSheet, rowIndex: rowNum, message: `Unknown faculty \"${row['Faculty A']}\" in Collaborations.` });
    }
    if (!facultyNames.has(row['Faculty B'])) {
      issues.push({ severity: 'warning', sheet: collaborationsSheet, rowIndex: rowNum, message: `Unknown faculty \"${row['Faculty B']}\" in Collaborations.` });
    }
    if (!row['Project/Topic'] || !row['Project/Topic'].trim()) {
      issues.push({ severity: 'warning', sheet: collaborationsSheet, rowIndex: rowNum, message: 'Collaboration row has empty Project/Topic.' });
    }
  });

  return {
    data: { platforms, faculty, facultyPlatforms, verticals, facultyVerticals, collaborations },
    validation: { ok: issues.every(i => i.severity !== 'error'), issues }
  };
}

// ---------- coercion helpers ----------
// These use the column names from the standard schema. For custom schemas
// with different column names, the tenant config would need to specify
// column-name mappings. The current implementation assumes the standard
// column names (which are the defaults in the tenant config).

function toPlatformRow(r: RawRows[number]): PlatformRow {
  return {
    'Platform ID': String(r['Platform ID'] ?? '').trim(),
    'Platform': String(r['Platform'] ?? '').trim(),
    'Description': String(r['Description'] ?? '').trim(),
    'Sector': String(r['Sector'] ?? '').trim()
  };
}
function toFacultyRow(r: RawRows[number]): FacultyRow {
  return {
    'Faculty ID': String(r['Faculty ID'] ?? '').trim(),
    'Faculty': String(r['Faculty'] ?? '').trim()
  };
}
function toFacultyPlatformRow(r: RawRows[number]): FacultyPlatformRow {
  return {
    'Faculty': String(r['Faculty'] ?? '').trim(),
    'Platform': String(r['Platform'] ?? '').trim()
  };
}
function toVerticalRow(r: RawRows[number]): VerticalRow {
  return {
    'Vertical ID': String(r['Vertical ID'] ?? '').trim(),
    'Research Vertical': String(r['Research Vertical'] ?? '').trim(),
    'Sector': String(r['Sector'] ?? '').trim()
  };
}
function toFacultyVerticalRow(r: RawRows[number]): FacultyVerticalRow {
  return {
    'Faculty': String(r['Faculty'] ?? '').trim(),
    'Research Vertical': String(r['Research Vertical'] ?? '').trim()
  };
}
function toCollaborationRow(r: RawRows[number]): CollaborationRow {
  return {
    'Faculty A': String(r['Faculty A'] ?? '').trim(),
    'Faculty B': String(r['Faculty B'] ?? '').trim(),
    'Project/Topic': String(r['Project/Topic'] ?? '').trim()
  };
}

function emptyData(): WorkbookData {
  return { platforms: [], faculty: [], facultyPlatforms: [], verticals: [], facultyVerticals: [], collaborations: [] };
}

// ---------- duplicate detection ----------

function warnOnDuplicates<T extends object>(
  issues: WorkbookIssue[],
  sheet: string,
  rows: T[],
  cols: (keyof T)[]
): void {
  const seen = new Map<string, number>();
  rows.forEach((row, i) => {
    const key = cols.map(c => String((row as Record<string, unknown>)[c as string] ?? '').trim()).join('|');
    if (!key.replace(/\|/g, '')) return; // ignore rows where every key cell is empty
    if (seen.has(key)) {
      issues.push({
        severity: 'warning',
        sheet,
        rowIndex: i + 2,
        message: `Duplicate row (same as row ${seen.get(key)}): ${key.replace(/\|/g, ' / ')}.`
      });
    } else {
      seen.set(key, i + 2);
    }
  });
}

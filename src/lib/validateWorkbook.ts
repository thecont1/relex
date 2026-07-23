// Workbook schema validation.
// Sheet names and column names are exactly as specified. Any deviation is a fatal error.
// Non-fatal data quality issues (blank sectors, unknown refs, duplicate rows, malformed
// collaboration rows) are surfaced as warnings.

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

const REQUIRED_SHEETS = ['Platforms', 'Faculty', 'Faculty_Platforms', 'Research_Verticals', 'Faculty_Verticals', 'Collaborations'] as const;

const SHEET_COLUMNS: Record<typeof REQUIRED_SHEETS[number], readonly string[]> = {
  Platforms: ['Platform ID', 'Platform', 'Description', 'Sector'],
  Faculty: ['Faculty ID', 'Faculty'],
  Faculty_Platforms: ['Faculty', 'Platform'],
  Research_Verticals: ['Vertical ID', 'Research Vertical', 'Sector'],
  Faculty_Verticals: ['Faculty', 'Research Vertical'],
  Collaborations: ['Faculty A', 'Faculty B', 'Project/Topic']
};

export interface RawWorkbook {
  [sheetName: string]: RawRows;
}

export function validateWorkbook(raw: RawWorkbook): { data: WorkbookData; validation: ValidationResult } {
  const issues: WorkbookIssue[] = [];

  // ---- Sheet presence (fatal) ----
  for (const name of REQUIRED_SHEETS) {
    if (!Object.prototype.hasOwnProperty.call(raw, name)) {
      issues.push({ severity: 'error', sheet: name, message: `Missing required sheet "${name}".` });
    }
  }
  if (issues.some(i => i.severity === 'error')) {
    return { data: emptyData(), validation: { ok: false, issues } };
  }

  // ---- Column presence (fatal) ----
  for (const name of REQUIRED_SHEETS) {
    const rows = raw[name] ?? [];
    const cols = SHEET_COLUMNS[name];
    if (rows.length === 0) {
      issues.push({ severity: 'error', sheet: name, message: `Sheet "${name}" is empty.` });
      continue;
    }
    const present = new Set(Object.keys(rows[0]));
    const missing = cols.filter(c => !present.has(c));
    if (missing.length) {
      issues.push({
        severity: 'error',
        sheet: name,
        message: `Sheet "${name}" is missing required column(s): ${missing.join(', ')}.`
      });
    }
  }
  if (issues.some(i => i.severity === 'error')) {
    return { data: emptyData(), validation: { ok: false, issues } };
  }

  // ---- Coerce and run row-level validation ----
  const platforms = raw.Platforms.map(toPlatformRow);
  const faculty = raw.Faculty.map(toFacultyRow);
  const facultyPlatforms = raw.Faculty_Platforms.map(toFacultyPlatformRow);
  const verticals = raw.Research_Verticals.map(toVerticalRow);
  const facultyVerticals = raw.Faculty_Verticals.map(toFacultyVerticalRow);
  const collaborations = raw.Collaborations.map(toCollaborationRow);

  const facultyNames = new Set(faculty.map(f => f.Faculty));
  const platformNames = new Set(platforms.map(p => p.Platform));
  const verticalNames = new Set(verticals.map(v => v['Research Vertical']));

  // Blank sectors — warnings
  platforms.forEach((row, i) => {
    if (!row.Sector || !row.Sector.trim()) {
      issues.push({ severity: 'warning', sheet: 'Platforms', rowIndex: i + 2, message: `Blank Sector for platform "${row.Platform}".` });
    }
  });
  verticals.forEach((row, i) => {
    if (!row.Sector || !row.Sector.trim()) {
      issues.push({ severity: 'warning', sheet: 'Research_Verticals', rowIndex: i + 2, message: `Blank Sector for vertical "${row['Research Vertical']}".` });
    }
  });

  // Duplicate exact rows
  warnOnDuplicates(issues, 'Platforms', platforms, ['Platform ID']);
  warnOnDuplicates(issues, 'Faculty', faculty, ['Faculty ID']);
  warnOnDuplicates(issues, 'Faculty_Platforms', facultyPlatforms, ['Faculty', 'Platform']);
  warnOnDuplicates(issues, 'Faculty_Verticals', facultyVerticals, ['Faculty', 'Research Vertical']);

  // Duplicate collaborations (same faculty pair, same project) — informational
  warnOnDuplicates(issues, 'Collaborations', collaborations, ['Faculty A', 'Faculty B', 'Project/Topic']);

  // Unknown entity references
  facultyPlatforms.forEach((row, i) => {
    if (!facultyNames.has(row.Faculty)) {
      issues.push({ severity: 'warning', sheet: 'Faculty_Platforms', rowIndex: i + 2, message: `Unknown faculty "${row.Faculty}" in Faculty_Platforms.` });
    }
    if (!platformNames.has(row.Platform)) {
      issues.push({ severity: 'warning', sheet: 'Faculty_Platforms', rowIndex: i + 2, message: `Unknown platform "${row.Platform}" in Faculty_Platforms.` });
    }
  });
  facultyVerticals.forEach((row, i) => {
    if (!facultyNames.has(row.Faculty)) {
      issues.push({ severity: 'warning', sheet: 'Faculty_Verticals', rowIndex: i + 2, message: `Unknown faculty "${row.Faculty}" in Faculty_Verticals.` });
    }
    if (!verticalNames.has(row['Research Vertical'])) {
      issues.push({ severity: 'warning', sheet: 'Faculty_Verticals', rowIndex: i + 2, message: `Unknown vertical "${row['Research Vertical']}" in Faculty_Verticals.` });
    }
  });

  // Malformed / self-loop collaborations
  collaborations.forEach((row, i) => {
    const rowNum = i + 2;
    if (!row['Faculty A'] || !row['Faculty B']) {
      issues.push({ severity: 'warning', sheet: 'Collaborations', rowIndex: rowNum, message: 'Malformed collaboration row: missing faculty name(s).' });
      return;
    }
    if (row['Faculty A'].trim() === row['Faculty B'].trim()) {
      issues.push({ severity: 'warning', sheet: 'Collaborations', rowIndex: rowNum, message: `Self-collaboration ignored: "${row['Faculty A']}" ↔ "${row['Faculty B']}".` });
    }
    if (!facultyNames.has(row['Faculty A'])) {
      issues.push({ severity: 'warning', sheet: 'Collaborations', rowIndex: rowNum, message: `Unknown faculty "${row['Faculty A']}" in Collaborations.` });
    }
    if (!facultyNames.has(row['Faculty B'])) {
      issues.push({ severity: 'warning', sheet: 'Collaborations', rowIndex: rowNum, message: `Unknown faculty "${row['Faculty B']}" in Collaborations.` });
    }
    if (!row['Project/Topic'] || !row['Project/Topic'].trim()) {
      issues.push({ severity: 'warning', sheet: 'Collaborations', rowIndex: rowNum, message: 'Collaboration row has empty Project/Topic.' });
    }
  });

  return {
    data: { platforms, faculty, facultyPlatforms, verticals, facultyVerticals, collaborations },
    validation: { ok: issues.every(i => i.severity !== 'error'), issues }
  };
}

// ---------- coercion helpers ----------

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
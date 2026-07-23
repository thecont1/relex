// Fetches and parses the workbook fresh on each call. Returns parsed sheet rows
// keyed by sheet name. Throws on network/parse failure so the caller can surface
// a fatal banner.
//
// The data source path is read from the tenant config (injected at build time),
// so each tenant bundle fetches its own workbook. No hardcoded paths.

import * as XLSX from 'xlsx';
import { tenantConfig } from '../tenant/config';
import type { RawWorkbook } from './validateWorkbook';

export async function loadWorkbook(): Promise<RawWorkbook> {
  const ds = tenantConfig.dataSource;
  let url: string;
  let headers: Record<string, string> | undefined;

  if (ds.type === 'local') {
    url = ds.path;
  } else if (ds.type === 'remote') {
    url = ds.path;
    headers = ds.headers;
  } else {
    throw new Error(`Unknown data source type: ${ds.type}`);
  }

  const fetchOpts: RequestInit = { cache: 'no-store' };
  if (headers) {
    fetchOpts.headers = headers;
  }

  const res = await fetch(url, fetchOpts);
  if (!res.ok) {
    throw new Error(`Workbook fetch failed: HTTP ${res.status} ${res.statusText}`);
  }
  const buf = await res.arrayBuffer();
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: 'array' });
  } catch (e) {
    throw new Error(`Workbook parse failed: ${(e as Error).message}`);
  }
  const out: RawWorkbook = {};
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    // defval: null ensures missing columns produce empty cells rather than undefined keys
    out[sheetName] = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: false });
  }
  return out;
}

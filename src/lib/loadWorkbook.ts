// Fetches and parses the workbook fresh on each call. Returns parsed sheet rows
// keyed by sheet name. Throws on network/parse failure so the caller can surface
// a fatal banner.

import * as XLSX from 'xlsx';
import type { RawWorkbook } from './validateWorkbook';

const DEFAULT_PATH = './data/CeNSE_Master_Ecosystem_Dataset.xlsx';

export async function loadWorkbook(url: string = DEFAULT_PATH): Promise<RawWorkbook> {
  const res = await fetch(url, { cache: 'no-store' });
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
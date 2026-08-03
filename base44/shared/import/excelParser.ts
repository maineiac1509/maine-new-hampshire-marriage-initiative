// ============================================================
// Direct Excel/CSV Parser for FamilyLife Import Files
// ============================================================
//
// Replaces the AI-based ExtractDataFromUploadedFile integration
// with deterministic xlsx parsing. This handles multi-sheet files
// with metadata rows by detecting the correct sheet and header row
// automatically, then maps columns to canonical field names using
// the governance contract's sourceAliases.
//
// The AI extraction was unreliable for FamilyLife exports because:
// 1. Multi-sheet files: the AI often read the metadata sheet
//    instead of the data sheet.
// 2. Metadata rows: the AI couldn't distinguish title/metadata
//    rows from the actual column headers.
// 3. Column mapping: the AI couldn't reliably translate FamilyLife
//    column names to canonical field names.
//
// This parser solves all three issues deterministically.
// ============================================================

import * as XLSX from 'npm:xlsx@0.18.5';
import { mapHeader } from './parser.ts';

export interface ParseResult {
  rows: Record<string, any>[];
  unmappedHeaders: string[];
  sheetName: string;
  totalRows: number;
  headerRowIndex: number;
}

/**
 * Parse an Excel or CSV file from a URL, automatically detecting
 * the correct sheet and header row, then mapping columns to
 * canonical field names.
 */
export async function parseExcelFile(fileUrl: string): Promise<ParseResult> {
  // 1. Download the file
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to download file (HTTP ${response.status})`);
  }
  const buffer = await response.arrayBuffer();

  // 2. Parse with xlsx
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });

  if (!workbook.SheetNames.length) {
    throw new Error('The file contains no sheets.');
  }

  // 3. Find the data sheet — the one with the most mappable headers
  let targetSheet = '';
  let bestScore = 0;

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
    if (rawRows.length < 2) continue;

    // Score this sheet by counting mappable headers in the best header row
    let sheetBestMapped = 0;
    for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
      const candidateHeaders = rawRows[i].map((c: any) => String(c || '').trim());
      const count = candidateHeaders.filter(h => h && mapHeader(h) !== null).length;
      if (count > sheetBestMapped) sheetBestMapped = count;
    }

    if (sheetBestMapped > bestScore) {
      bestScore = sheetBestMapped;
      targetSheet = name;
    }
  }

  // Fallback: if no sheet had mappable headers, use the one with the most rows
  if (!targetSheet) {
    let maxRows = 0;
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
      if (rawRows.length > maxRows) {
        maxRows = rawRows.length;
        targetSheet = name;
      }
    }
  }

  if (!targetSheet) targetSheet = workbook.SheetNames[0];

  const sheet = workbook.Sheets[targetSheet];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];

  if (rawRows.length === 0) {
    return { rows: [], unmappedHeaders: [], sheetName: targetSheet, totalRows: 0, headerRowIndex: 0 };
  }

  // 4. Find the header row — first row where at least 3 columns map
  let headerRowIdx = 0;
  let headers: string[] = [];
  let mappedCount = 0;

  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const candidateHeaders = rawRows[i].map((c: any) => String(c || '').trim());
    const count = candidateHeaders.filter(h => h && mapHeader(h) !== null).length;
    if (count > mappedCount) {
      headerRowIdx = i;
      headers = candidateHeaders;
      mappedCount = count;
    }
  }

  // If no header row with mappable columns was found, use row 0
  if (mappedCount === 0) {
    headers = rawRows[0].map((c: any) => String(c || '').trim());
    headerRowIdx = 0;
  }

  // 5. Map headers to canonical field names
  const unmappedSet = new Set<string>();
  const salutationIdx = headers.findIndex(h => h && h.toLowerCase() === 'salutation');

  const mappedHeaders: (string | null)[] = headers.map((h, idx) => {
    if (!h) return null;

    // Special case: Salutation → account_salutation (not in governance contract)
    if (idx === salutationIdx && salutationIdx >= 0) {
      return 'account_salutation';
    }

    const canonical = mapHeader(h);
    if (!canonical) {
      unmappedSet.add(h);
    }
    return canonical;
  });

  // 6. Build rows from data rows (after the header row)
  const rows: Record<string, any>[] = [];
  for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
    const rawRow = rawRows[i];

    // Skip completely empty rows
    const hasData = rawRow.some((c: any) => c != null && c !== '');
    if (!hasData) continue;

    const row: Record<string, any> = {};
    for (let col = 0; col < mappedHeaders.length; col++) {
      const value = rawRow[col];
      if (value == null || value === '') continue;

      const canonical = mappedHeaders[col];
      if (canonical) {
        row[canonical] = typeof value === 'string' ? value.trim() : value;
      }
    }

    // Only include rows with at least a name or household
    if (row.first_name || row.last_name || row.household_name) {
      rows.push(row);
    }
  }

  return {
    rows,
    unmappedHeaders: Array.from(unmappedSet),
    sheetName: targetSheet,
    totalRows: rawRows.length - headerRowIdx - 1,
    headerRowIndex: headerRowIdx,
  };
}
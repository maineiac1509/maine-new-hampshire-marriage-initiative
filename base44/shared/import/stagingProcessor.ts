// ============================================================
// Staging Processor — orchestrates the full staging workflow
// ============================================================
//
// UPLOAD → PARSE → STAGE → VALIDATE → NORMALIZE → MATCH → COMPARE
//
// This phase STOPS after generating comparison results. No staged
// import change updates an existing production ChampionHousehold
// or HouseholdMember record. The batch is marked READY_FOR_REVIEW.
//
// Idempotency strategy: "clear and regenerate." Reprocessing a
// batch deletes all existing rows, comparisons, and issues for
// that batch, then regenerates them from the source file. The
// batch record itself is reused (its status is reset to PARSING).
// ============================================================

import {
  FIELD_GOVERNANCE, OWNERSHIP,
} from './governance.ts';
import {
  CHAMPION_EXTRACTION_SCHEMA, groupRowsIntoHouseholds, normalizeExtractOutput,
  parsePastedData, mapHeader, findUnmappedColumns, HOUSEHOLD_FIELDS, MEMBER_FIELDS,
} from './parser.ts';
import { parseExcelFile } from './excelParser.ts';
import { normalizeAndValidateField, normalizeMappedRow } from './normalizer.ts';
import {
  buildMatchIndexes, matchHousehold, matchMember,
  MATCH_STATUS, type MatchIndexes, type ProductionHousehold, type ProductionMember,
} from './matcher.ts';
import { compareAllFields, COMPARISON_RESULT, RECOMMENDED_ACTION } from './comparator.ts';

const GOVERNANCE_VERSION = '2025-01-staging-v1';
const MAPPING_VERSION = '2025-01-staging-v1';
const BULK_LIMIT = 500;

export interface ProcessParams {
  mode: 'file' | 'paste';
  file_url?: string;
  file_name: string;
  file_size?: number;
  file_type?: string;
  source_period?: string;
  raw_text?: string;
  reprocess_batch_id?: string;
}

export interface ProcessResult {
  batch_id: string;
  status: string;
  summary: Record<string, any>;
  is_possible_duplicate: boolean;
  previous_batch_id?: string;
}

// ------------------------------------------------------------
// Simple deterministic content signature (not cryptographic)
// ------------------------------------------------------------
function computeSignature(
  fileName: string,
  rowCount: number,
  sourcePeriod: string,
  groups: Array<{ household: Record<string, any>; members: Record<string, any>[] }>,
): string {
  const parts = [fileName || '', String(rowCount), sourcePeriod || ''];
  // Sample the first 50 household names + their first member emails for a stable fingerprint
  groups.slice(0, 50).forEach((g) => {
    parts.push(g.household.household_name || '');
    const firstMember = g.members[0];
    if (firstMember) parts.push(firstMember.email || `${firstMember.first_name || ''}${firstMember.last_name || ''}`);
  });
  const joined = parts.join('||');
  // FNV-1a-ish hash → hex string
  let h = 0x811c9dc5;
  for (let i = 0; i < joined.length; i++) {
    h ^= joined.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ------------------------------------------------------------
// Bulk create helper (chunks by BULK_LIMIT)
// ------------------------------------------------------------
async function bulkCreate(base44: any, entity: string, records: any[]): Promise<any[]> {
  const created: any[] = [];
  for (let i = 0; i < records.length; i += BULK_LIMIT) {
    const chunk = records.slice(i, i + BULK_LIMIT);
    const res = await base44.asServiceRole.entities[entity].bulkCreate(chunk);
    if (Array.isArray(res)) created.push(...res);
  }
  return created;
}

async function bulkUpdate(base44: any, entity: string, records: any[]): Promise<void> {
  for (let i = 0; i < records.length; i += BULK_LIMIT) {
    const chunk = records.slice(i, i + BULK_LIMIT);
    await base44.asServiceRole.entities[entity].bulkUpdate(chunk);
  }
}

async function deleteForBatch(base44: any, entity: string, batchId: string): Promise<void> {
  await base44.asServiceRole.entities[entity].deleteMany({ import_batch_id: batchId });
}

// ------------------------------------------------------------
// Load all production households + members (paginated)
// ------------------------------------------------------------
async function loadProductionData(base44: any): Promise<{ households: ProductionHousehold[]; members: ProductionMember[] }> {
  const households: any[] = [];
  const members: any[] = [];
  // High-limit retrieval; for very large datasets true pagination would be needed.
  // Noted as a known limitation for this phase.
  const hh = await base44.asServiceRole.entities.ChampionHousehold.list('-created_date', 10000);
  if (Array.isArray(hh)) households.push(...hh);
  const mm = await base44.asServiceRole.entities.HouseholdMember.list('-created_date', 10000);
  if (Array.isArray(mm)) members.push(...mm);
  return { households, members };
}

// ------------------------------------------------------------
// Main entry point
// ------------------------------------------------------------
export async function processImportBatch(base44: any, params: ProcessParams): Promise<ProcessResult> {
  const now = new Date().toISOString();
  let batchId = params.reprocess_batch_id;
  let isReprocess = !!params.reprocess_batch_id;

  // 1. Create or reset the batch record
  let batch: any;
  if (isReprocess) {
    batch = await base44.asServiceRole.entities.FamilyLifeImportBatch.get(batchId!);
    if (!batch) throw new Error('Reprocess requested but batch not found.');
    // Clear existing staging data (idempotency: clear + regenerate)
    await deleteForBatch(base44, 'FamilyLifeImportRow', batchId!);
    await deleteForBatch(base44, 'FamilyLifeImportFieldComparison', batchId!);
    await deleteForBatch(base44, 'FamilyLifeImportIssue', batchId!);
    batch = await base44.asServiceRole.entities.FamilyLifeImportBatch.update(batchId!, {
      status: 'PARSING', processing_started_at: now, processing_completed_at: null,
      failure_reason: null,
    });
  } else {
    batch = await base44.asServiceRole.entities.FamilyLifeImportBatch.create({
      file_name: params.file_name,
      original_file_name: params.file_name,
      file_type: params.file_type || (params.mode === 'paste' ? 'pasted' : 'unknown'),
      file_size: params.file_size || 0,
      status: 'PARSING',
      source_period: params.source_period || '',
      processing_started_at: now,
      total_rows: 0, valid_rows: 0, invalid_rows: 0,
      matched_rows: 0, unmatched_rows: 0,
      new_record_rows: 0, possible_duplicate_rows: 0,
      no_change_rows: 0, safe_update_rows: 0, conflict_rows: 0,
      blocked_field_count: 0, warning_count: 0, error_count: 0, blocking_error_count: 0,
      governance_version: GOVERNANCE_VERSION,
      mapping_version: MAPPING_VERSION,
      summary: {},
    });
    batchId = batch.id;
  }

  try {
    // 2. Extract / parse source rows
    let sourceRows: Record<string, any>[] = [];
    let rawUnmappedHeaders: string[] = [];
    if (params.mode === 'file' && params.file_url) {
      // Parse the file directly with xlsx for deterministic, reliable extraction.
      // Falls back to AI-based extraction only if the direct parser fails.
      try {
        const parseResult = await parseExcelFile(params.file_url);
        sourceRows = parseResult.rows;
        rawUnmappedHeaders = parseResult.unmappedHeaders;
      } catch (parseError) {
        // Fall back to AI extraction if direct parsing fails
        const res = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
          file_url: params.file_url,
          json_schema: CHAMPION_EXTRACTION_SCHEMA,
        });
        if (res?.status === 'error') {
          throw new Error(res.details || parseError.message || 'Could not read the file.');
        }
        sourceRows = normalizeExtractOutput(res?.output);
      }
    } else if (params.mode === 'paste' && params.raw_text != null) {
      sourceRows = parsePastedData(params.raw_text);
    } else {
      throw new Error('Either file_url (file mode) or raw_text (paste mode) is required.');
    }

    if (!sourceRows.length) {
      throw new Error('No records found in the source.');
    }

    // 3. Detect unmapped columns (from original headers if available)
    const unmappedColumns: string[] = [];
    if (sourceRows.length > 0) {
      const firstRow = sourceRows[0];
      // The extractor returns canonical field names as keys, so we check
      // for keys not in the governance contract.
      for (const key of Object.keys(firstRow)) {
        const isHH = FIELD_GOVERNANCE.ChampionHousehold?.[key];
        const isMem = FIELD_GOVERNANCE.HouseholdMember?.[key];
        if (!isHH && !isMem && key !== 'account_salutation') {
          unmappedColumns.push(key);
        }
      }
    }

    // 4. Group into households
    const { groups, unmappedColumns: groupUnmapped } = groupRowsIntoHouseholds(sourceRows);
    const allUnmapped = Array.from(new Set([...unmappedColumns, ...groupUnmapped, ...rawUnmappedHeaders]));

    // 5. Compute content signature + duplicate detection
    const signature = computeSignature(params.file_name, sourceRows.length, params.source_period || '', groups);
    let previousBatchId: string | undefined;
    let isPossibleDuplicate = false;
    if (!isReprocess) {
      const existing = await base44.asServiceRole.entities.FamilyLifeImportBatch.filter({ file_hash: signature });
      if (Array.isArray(existing) && existing.length > 0) {
        const prior = existing.find((b: any) => b.id !== batchId && b.status !== 'DISCARDED');
        if (prior) {
          isPossibleDuplicate = true;
          previousBatchId = prior.id;
        }
      }
    }
    batch = await base44.asServiceRole.entities.FamilyLifeImportBatch.update(batchId!, {
      file_hash: signature,
      total_rows: sourceRows.length,
      possible_duplicate_batch_id: previousBatchId || null,
    });

    // 6. Stage rows + validate
    const rowRecords: any[] = [];
    const issueRecords: any[] = [];
    let validRows = 0;
    let invalidRows = 0;
    let rowNumber = 0;

    for (const group of groups) {
      const groupRepresentativeRowNumber = rowNumber + 1;

      // Normalize household-level fields
      const hhNorm = normalizeMappedRow(group.household, 'ChampionHousehold');

      // Record household validation errors as batch issues
      for (const err of hhNorm.errors) {
        issueRecords.push({
          import_batch_id: batchId,
          import_row_id: null,
          severity: 'WARNING',
          issue_type: 'INVALID_VALUE',
          canonical_field_name: err.field,
          message: `Household "${group.household.household_name}": ${err.message}`,
          raw_value: hhNorm.errors.some(() => false) ? undefined : String(err.rawValue ?? ''),
        });
      }

      for (const member of group.members) {
        rowNumber++;
        const memNorm = normalizeMappedRow(member, 'HouseholdMember');

        const rowErrors: string[] = [];
        const rowWarnings: string[] = [];

        // Household validation errors apply to the representative row
        if (rowNumber === groupRepresentativeRowNumber) {
          for (const err of hhNorm.errors) {
            rowErrors.push(`${err.field}: ${err.message}`);
          }
        }
        for (const err of memNorm.errors) {
          rowErrors.push(`${err.field}: ${err.message}`);
        }

        const validationStatus = rowErrors.length ? 'invalid' : (rowWarnings.length ? 'warning' : 'valid');
        if (validationStatus === 'invalid') invalidRows++;
        else validRows++;

        // Build normalized_source_data: household fields (representative only carries them) + member fields
        const normalizedSource: Record<string, any> = {};
        if (rowNumber === groupRepresentativeRowNumber) {
          Object.assign(normalizedSource, hhNorm.normalized);
        }
        Object.assign(normalizedSource, memNorm.normalized);

        rowRecords.push({
          import_batch_id: batchId,
          row_number: rowNumber,
          household_group_key: group.householdGroupKey,
          is_household_representative: rowNumber === groupRepresentativeRowNumber,
          raw_source_data: sourceRows[rowNumber - 1] || {},
          mapped_source_data: { ...group.household, ...member },
          normalized_source_data: normalizedSource,
          validation_status: validationStatus,
          validation_errors: rowErrors,
          validation_warnings: rowWarnings,
          match_status: MATCH_STATUS.NO_MATCH,
          match_confidence: 'none',
          record_classification: 'UNMATCHED',
          processing_status: 'pending',
          source_external_id: group.household.familylife_external_id || '',
          source_household_identifier: group.household.household_name || '',
          member_first_name: member.first_name || '',
          member_last_name: member.last_name || '',
          member_email: member.email || '',
          household_name: group.household.household_name || '',
        });

        // Per-row validation issues
        for (const err of memNorm.errors) {
          issueRecords.push({
            import_batch_id: batchId,
            import_row_id: null, // linked after bulk create
            severity: 'WARNING',
            issue_type: 'INVALID_VALUE',
            canonical_field_name: err.field,
            message: `${member.first_name || ''} ${member.last_name || ''}: ${err.message}`,
            raw_value: String(err.rawValue ?? ''),
          });
        }
      }
    }

    // Bulk create staged rows
    const createdRows = await bulkCreate(base44, 'FamilyLifeImportRow', rowRecords);

    // Link issue rows to their row IDs + create issues
    // Map issues by matching the message prefix; simpler: create issues without row_id for now
    // (issue records already have batch_id). We can link row_id later if needed.
    if (issueRecords.length) {
      await bulkCreate(base44, 'FamilyLifeImportIssue', issueRecords.map((r) => ({
        ...r,
        raw_value: r.raw_value && r.raw_value.length > 200 ? r.raw_value.slice(0, 200) : r.raw_value,
      })));
    }

    // Record unmapped columns as issues
    for (const col of allUnmapped) {
      await base44.asServiceRole.entities.FamilyLifeImportIssue.create({
        import_batch_id: batchId,
        import_row_id: null,
        severity: 'INFO',
        issue_type: 'UNMAPPED_COLUMN',
        source_column: col,
        message: `Source column "${col}" is not mapped to any known field.`,
      });
    }

    // 7. Update batch stats → STAGED
    batch = await base44.asServiceRole.entities.FamilyLifeImportBatch.update(batchId!, {
      status: 'STAGED',
      valid_rows: validRows,
      invalid_rows: invalidRows,
    });

    // 8. Load production data + build match indexes
    const { households: prodHH, members: prodMembers } = await loadProductionData(base44);
    const indexes = buildMatchIndexes(prodHH as ProductionHousehold[], prodMembers as ProductionMember[]);

    // 9. Match each household group + each member
    batch = await base44.asServiceRole.entities.FamilyLifeImportBatch.update(batchId!, { status: 'COMPARING' });

    const rowUpdates: any[] = [];
    const comparisonRecords: any[] = [];
    let matchedRows = 0, unmatchedRows = 0, newRecordRows = 0;
    let possibleDuplicateRows = 0, noChangeRows = 0, safeUpdateRows = 0, conflictRows = 0;
    let blockedFieldCount = 0, restrictiveAdded = 0, protectedIgnored = 0, unknownBlocked = 0;
    const fieldsImported: Record<string, number> = {};

    // Track field coverage
    for (const row of rowRecords) {
      for (const key of Object.keys(row.normalized_source_data || {})) {
        const val = row.normalized_source_data[key];
        if (val != null && val !== '') fieldsImported[key] = (fieldsImported[key] || 0) + 1;
      }
    }

    // Index created rows by group key for updates
    const rowsByGroup = new Map<string, any[]>();
    for (const cr of createdRows) {
      const gk = cr.household_group_key;
      if (!rowsByGroup.has(gk)) rowsByGroup.set(gk, []);
      rowsByGroup.get(gk)!.push(cr);
    }

    for (const group of groups) {
      const incomingHH = {
        household_name: group.household.household_name,
        email: group.household.email,
        home_phone: group.household.home_phone,
        address: group.household.address,
        city: group.household.city,
        familylife_external_id: group.household.familylife_external_id,
        source_household_identifier: group.household.household_name,
      };
      const incomingMembers = group.members.map((m) => ({
        first_name: m.first_name, last_name: m.last_name,
        email: m.email, mobile_phone: m.mobile_phone, work_phone: m.work_phone,
      }));

      const hhMatch = matchHousehold(incomingHH, incomingMembers, indexes);
      const groupRows = rowsByGroup.get(group.householdGroupKey) || [];

      let householdClassification = 'UNMATCHED';
      let matchedHouseholdId: string | null = null;

      if (hhMatch.matchedHousehold) {
        matchedHouseholdId = hhMatch.matchedHousehold.id;
        matchedRows += groupRows.length;
        // Determine classification after comparison
      } else if (hhMatch.status === MATCH_STATUS.MULTIPLE_MATCHES || hhMatch.status === MATCH_STATUS.WEAK_POSSIBLE_MATCH) {
        possibleDuplicateRows += groupRows.length;
        householdClassification = 'POSSIBLE_DUPLICATE';
      } else {
        // NO_MATCH or INVALID_MATCH_DATA
        unmatchedRows += groupRows.length;
        householdClassification = hhMatch.status === MATCH_STATUS.INVALID_MATCH_DATA ? 'INVALID' : 'NEW_RECORD';
        if (householdClassification === 'NEW_RECORD') newRecordRows += groupRows.length;
      }

      // For each row in the group: match member + compare
      const existingHousehold = hhMatch.matchedHousehold;
      const houseMembers = existingHousehold?.members || [];
      let groupHasConflicts = false;
      let groupHasSafeChanges = false;
      let groupHasNoChange = true;

      for (const rowRecord of groupRows) {
        const member = {
          first_name: rowRecord.member_first_name,
          last_name: rowRecord.member_last_name,
          email: rowRecord.member_email,
          mobile_phone: rowRecord.mapped_source_data?.mobile_phone,
          work_phone: rowRecord.mapped_source_data?.work_phone,
        };

        let matchedMemberId: string | null = null;
        let memberClassification = householdClassification;

        if (existingHousehold) {
          const memMatch = matchMember(member, houseMembers);
          matchedMemberId = memMatch.matchedMember?.id || null;
        }

        // Build comparison context
        // Household fields: only for representative row
        const validationErrors: Record<string, boolean> = {};
        for (const err of rowRecord.validation_errors || []) {
          const field = err.split(':')[0];
          validationErrors[field] = true;
        }

        if (rowRecord.is_household_representative) {
          const hhComparisons = compareAllFields({
            entityType: 'ChampionHousehold',
            incoming: rowRecord.normalized_source_data,
            existing: existingHousehold || null,
            validationErrors,
          });
          for (const cmp of hhComparisons) {
            if (cmp.comparison_result === COMPARISON_RESULT.PROTECTED_FIELD_IGNORED) protectedIgnored++;
            if (cmp.comparison_result === COMPARISON_RESULT.UNKNOWN_FIELD_BLOCKED) unknownBlocked++;
            if (cmp.comparison_result === COMPARISON_RESULT.RESTRICTIVE_VALUE_ADDED) restrictiveAdded++;
            if (cmp.comparison_result === COMPARISON_RESULT.SHARED_VALUE_CONFLICT) groupHasConflicts = true;
            if (cmp.can_auto_apply && cmp.recommended_action !== RECOMMENDED_ACTION.NO_ACTION) groupHasSafeChanges = true;
            if (cmp.recommended_action !== RECOMMENDED_ACTION.NO_ACTION &&
                cmp.recommended_action !== RECOMMENDED_ACTION.BLOCK_UPDATE) groupHasNoChange = false;
            if (cmp.recommended_action === RECOMMENDED_ACTION.BLOCK_UPDATE) blockedFieldCount++;

            comparisonRecords.push({
              import_batch_id: batchId,
              import_row_id: rowRecord.id,
              entity_type: 'ChampionHousehold',
              entity_id: existingHousehold?.id || '',
              ...cmp,
            });
          }
        }

        // Member fields: for all rows
        const memComparisons = compareAllFields({
          entityType: 'HouseholdMember',
          incoming: rowRecord.normalized_source_data,
          existing: matchedMemberId ? (houseMembers.find((m) => m.id === matchedMemberId) as any) : null,
          validationErrors,
        });
        for (const cmp of memComparisons) {
          if (cmp.comparison_result === COMPARISON_RESULT.PROTECTED_FIELD_IGNORED) protectedIgnored++;
          if (cmp.comparison_result === COMPARISON_RESULT.UNKNOWN_FIELD_BLOCKED) unknownBlocked++;
          if (cmp.comparison_result === COMPARISON_RESULT.SHARED_VALUE_CONFLICT) groupHasConflicts = true;
          if (cmp.can_auto_apply && cmp.recommended_action !== RECOMMENDED_ACTION.NO_ACTION) groupHasSafeChanges = true;
          if (cmp.recommended_action !== RECOMMENDED_ACTION.NO_ACTION &&
              cmp.recommended_action !== RECOMMENDED_ACTION.BLOCK_UPDATE) groupHasNoChange = false;
          if (cmp.recommended_action === RECOMMENDED_ACTION.BLOCK_UPDATE) blockedFieldCount++;

          comparisonRecords.push({
            import_batch_id: batchId,
            import_row_id: rowRecord.id,
            entity_type: 'HouseholdMember',
            entity_id: matchedMemberId || '',
            ...cmp,
          });
        }

        // Finalize row classification
        let finalClassification = householdClassification;
        if (existingHousehold) {
          if (groupHasConflicts) {
            finalClassification = 'MATCHED_WITH_CONFLICTS';
          } else if (groupHasSafeChanges) {
            finalClassification = 'MATCHED_SAFE_CHANGES';
          } else if (groupHasNoChange) {
            finalClassification = 'MATCHED_NO_CHANGE';
          }
        }

        rowUpdates.push({
          id: rowRecord.id,
          match_status: hhMatch.status,
          matched_household_id: matchedHouseholdId || null,
          matched_member_id: matchedMemberId || null,
          match_method: hhMatch.method,
          match_confidence: hhMatch.confidence,
          possible_match_ids: hhMatch.possibleMatches,
          record_classification: finalClassification,
          processing_status: 'processed',
        });

        // Aggregate counts (only count per group, not per member, for household-level stats)
        // We'll recompute classification-based counts at the group level below
      }

      // Group-level classification counting
      if (existingHousehold) {
        if (groupHasConflicts) conflictRows += groupRows.length;
        else if (groupHasSafeChanges) safeUpdateRows += groupRows.length;
        else noChangeRows += groupRows.length;
      }
    }

    // Bulk update rows with match results
    if (rowUpdates.length) await bulkUpdate(base44, 'FamilyLifeImportRow', rowUpdates);

    // Bulk create comparison records
    if (comparisonRecords.length) await bulkCreate(base44, 'FamilyLifeImportFieldComparison', comparisonRecords);

    // 10. Update batch summary + status → READY_FOR_REVIEW
    const warningCount = issueRecords.filter((i) => i.severity === 'WARNING').length + allUnmapped.length;
    const summary = {
      restrictive_preferences_added: restrictiveAdded,
      protected_fields_ignored: protectedIgnored,
      unknown_fields_blocked: unknownBlocked,
      unmapped_columns: allUnmapped,
      fields_imported: fieldsImported,
      notes: isPossibleDuplicate ? 'Possible duplicate of a previous batch — review before applying.' : '',
    };

    batch = await base44.asServiceRole.entities.FamilyLifeImportBatch.update(batchId!, {
      status: 'READY_FOR_REVIEW',
      processing_completed_at: new Date().toISOString(),
      total_rows: rowRecords.length,
      valid_rows: validRows,
      invalid_rows: invalidRows,
      matched_rows: matchedRows,
      unmatched_rows: unmatchedRows,
      new_record_rows: newRecordRows,
      possible_duplicate_rows: possibleDuplicateRows,
      no_change_rows: noChangeRows,
      safe_update_rows: safeUpdateRows,
      conflict_rows: conflictRows,
      blocked_field_count: blockedFieldCount,
      warning_count: warningCount,
      error_count: issueRecords.filter((i) => i.severity === 'ERROR').length,
      blocking_error_count: issueRecords.filter((i) => i.severity === 'BLOCKING').length,
      summary,
    });

    return {
      batch_id: batchId!,
      status: 'READY_FOR_REVIEW',
      summary,
      is_possible_duplicate: isPossibleDuplicate,
      previous_batch_id: previousBatchId,
    };
  } catch (error: any) {
    // Mark the batch as failed but preserve staged data for diagnosis
    await base44.asServiceRole.entities.FamilyLifeImportBatch.update(batchId!, {
      status: 'PROCESSING_FAILED',
      failure_reason: error?.message || 'Unknown processing error',
      processing_completed_at: new Date().toISOString(),
    });
    throw error;
  }
}
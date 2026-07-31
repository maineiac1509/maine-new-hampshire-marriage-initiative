import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// FamilyLife Import — Resolution Workflow Endpoint
// ============================================================
// Admin-only HTTP entry point for the administrator resolution
// layer. Handles:
//   - generate_defaults: auto-resolve non-conflicting comparisons
//   - save: persist a single resolution decision (with audit)
//   - bulk: apply a bulk resolution action (with audit + bulk record)
//   - manual_match: re-match a row to a chosen production target
//   - discard_new_record: discard a proposed new record
//   - skip_row: skip a source row
//   - block_row: block a source row
//   - check_readiness: deterministic readiness check + batch update
//
// This endpoint NEVER updates production ChampionHousehold or
// HouseholdMember records. It only creates/updates resolution,
// audit, bulk-resolution, row, and batch records.
// ============================================================

import {
  RESOLUTION_TYPE, RESOLUTION_STATUS, RESOLUTION_SOURCE,
  getDefaultResolutionType, isResolutionTypeAllowed, getResolvedValue,
  validateCustomValue, isRestrictionRemovalAttempt,
  computeReadiness, getBulkResolutionType,
} from '../../shared/import/resolver.ts';
import { compareAllFields, COMPARISON_RESULT } from '../../shared/import/comparator.ts';
import { bulkCreateSafe, bulkUpdateSafe, loadBatchData } from '../../shared/import/backendHelpers.ts';

const BULK_LIMIT = 500;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — administrators only.' }, { status: 403 });

    let body;
    try { body = await req.json(); } catch (_) {
      return Response.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const { action, batch_id } = body;
    if (!action || !batch_id) {
      return Response.json({ error: 'action and batch_id are required.' }, { status: 400 });
    }

    // Verify the batch exists and is in a reviewable state
    const batch = await base44.asServiceRole.entities.FamilyLifeImportBatch.get(batch_id);
    if (!batch) return Response.json({ error: 'Batch not found.' }, { status: 404 });
    if (['DISCARDED', 'APPLIED', 'APPLYING'].includes(batch.status)) {
      return Response.json({ error: `Batch is ${batch.status} — resolution is locked.` }, { status: 409 });
    }

    switch (action) {
      case 'generate_defaults':
        return await handleGenerateDefaults(base44, user, batch_id);
      case 'save':
        return await handleSave(base44, user, batch_id, body);
      case 'bulk':
        return await handleBulk(base44, user, batch_id, body);
      case 'manual_match':
        return await handleManualMatch(base44, user, batch_id, body);
      case 'discard_new_record':
        return await handleRowAction(base44, user, batch_id, body, 'DISCARDED', 'NEW_RECORD_DISCARDED');
      case 'skip_row':
        return await handleRowAction(base44, user, batch_id, body, 'SKIPPED', 'ROW_SKIPPED');
      case 'block_row':
        return await handleRowAction(base44, user, batch_id, body, 'BLOCKED', 'ROW_BLOCKED');
      case 'check_readiness':
        return await handleCheckReadiness(base44, user, batch_id);
      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message || 'Resolution operation failed.' }, { status: 500 });
  }
}

// ============================================================
// Helpers
// ============================================================
async function createAudit(base44, entry) {
  await base44.asServiceRole.entities.FamilyLifeImportResolutionAudit.create({
    event_at: new Date().toISOString(),
    ...entry,
  });
}

// ============================================================
// generate_defaults
// ============================================================
async function handleGenerateDefaults(base44, user, batchId) {
  const { comparisons, resolutions } = await loadBatchData(base44, batchId);

  // Index existing resolutions by comparison ID to skip already-resolved
  const existing = new Set(resolutions.map((r) => r.field_comparison_id));

  const toCreate = [];
  let created = 0;
  let skipped = 0;

  for (const cmp of comparisons) {
    if (existing.has(cmp.id)) { skipped++; continue; }

    const defaultType = getDefaultResolutionType(cmp);
    if (!defaultType) { skipped++; continue; } // Requires manual review — no default

    toCreate.push({
      import_batch_id: batchId,
      import_row_id: cmp.import_row_id,
      field_comparison_id: cmp.id,
      entity_type: cmp.entity_type,
      target_entity_id: cmp.entity_id || '',
      canonical_field_name: cmp.canonical_field_name,
      ownership_category: cmp.ownership_category,
      resolution_type: defaultType,
      current_value_snapshot: cmp.current_normalized_value || '',
      incoming_value_snapshot: cmp.incoming_normalized_value || '',
      resolved_value: getResolvedValue(cmp, defaultType),
      resolution_source: RESOLUTION_SOURCE.DEFAULT,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
      resolved_by_name: user.full_name || user.email || '',
      last_modified_at: new Date().toISOString(),
      last_modified_by: user.id,
      status: RESOLUTION_STATUS.PENDING,
    });
  }

  if (toCreate.length) {
    await bulkCreateSafe(base44, 'FamilyLifeImportResolution', toCreate);
    created = toCreate.length;
  }

  return Response.json({ created, skipped, total_comparisons: comparisons.length });
}

// ============================================================
// save — single resolution
// ============================================================
async function handleSave(base44, user, batchId, body) {
  const { comparison_id, resolution_type, custom_value, reason } = body;
  if (!comparison_id || !resolution_type) {
    return Response.json({ error: 'comparison_id and resolution_type are required.' }, { status: 400 });
  }

  // Load the comparison — verify it belongs to this batch
  const comparison = await base44.asServiceRole.entities.FamilyLifeImportFieldComparison.get(comparison_id);
  if (!comparison || comparison.import_batch_id !== batchId) {
    return Response.json({ error: 'Comparison not found in this batch.' }, { status: 404 });
  }

  // Validate resolution type is allowed for this ownership category
  if (!isResolutionTypeAllowed(comparison, resolution_type)) {
    return Response.json({
      error: `Resolution type "${resolution_type}" is not allowed for ${comparison.ownership_category} fields.`,
    }, { status: 400 });
  }

  // Block restriction removal through the import workflow (safer design)
  if (isRestrictionRemovalAttempt(comparison, resolution_type)) {
    await createAudit(base44, {
      import_batch_id: batchId,
      import_row_id: comparison.import_row_id,
      field_comparison_id: comparison_id,
      canonical_field_name: comparison.canonical_field_name,
      event_type: 'RESTRICTION_REDUCTION_ATTEMPTED',
      prior_decision: 'APPLY_RESTRICTION',
      new_decision: resolution_type,
      reason: reason || '',
      admin_user_id: user.id,
      admin_user_name: user.full_name || user.email || '',
    });
    return Response.json({
      error: 'Removing a communication restriction through an import is not permitted. Please edit the Champion record directly to adjust the communication preference.',
    }, { status: 400 });
  }

  // Validate custom value if provided
  let resolvedValue = '';
  let normalizedCustom = '';
  if (resolution_type === RESOLUTION_TYPE.USE_CUSTOM_VALUE) {
    if (!custom_value || String(custom_value).trim() === '') {
      return Response.json({ error: 'A custom value is required for USE_CUSTOM_VALUE.' }, { status: 400 });
    }
    const validation = validateCustomValue(comparison, custom_value);
    if (!validation.valid) {
      return Response.json({ error: `Invalid custom value: ${validation.error}` }, { status: 400 });
    }
    normalizedCustom = validation.normalized;
    resolvedValue = normalizedCustom;
  } else {
    resolvedValue = getResolvedValue(comparison, resolution_type, normalizedCustom);
  }

  // Check for existing active resolution (idempotent — one active per comparison)
  const existing = await base44.asServiceRole.entities.FamilyLifeImportResolution.filter({
    import_batch_id: batchId,
    field_comparison_id: comparison_id,
    status: { $in: [RESOLUTION_STATUS.PENDING, RESOLUTION_STATUS.RESOLVED] },
  });

  const now = new Date().toISOString();
  const priorDecision = existing.length > 0 ? existing[0].resolution_type : null;
  const priorValue = existing.length > 0 ? existing[0].resolved_value : '';

  let resolutionId;
  if (existing.length > 0) {
    // Update existing resolution (supersede, not duplicate)
    const existingRes = existing[0];
    await base44.asServiceRole.entities.FamilyLifeImportResolution.update(existingRes.id, {
      resolution_type,
      resolved_value: resolvedValue,
      resolution_source: RESOLUTION_SOURCE.MANUAL,
      resolution_reason: reason || '',
      last_modified_at: now,
      last_modified_by: user.id,
      resolved_at: now,
      resolved_by: user.id,
      resolved_by_name: user.full_name || user.email || '',
      status: RESOLUTION_STATUS.RESOLVED,
      is_bulk_resolution: false,
      bulk_resolution_id: '',
    });
    resolutionId = existingRes.id;

    // Audit: changed
    if (priorDecision !== resolution_type || priorValue !== resolvedValue) {
      await createAudit(base44, {
        import_batch_id: batchId,
        import_row_id: comparison.import_row_id,
        field_comparison_id: comparison_id,
        resolution_id: resolutionId,
        canonical_field_name: comparison.canonical_field_name,
        event_type: 'RESOLUTION_CHANGED',
        prior_decision: priorDecision || 'NONE',
        new_decision: resolution_type,
        prior_value: priorValue || '',
        new_value: resolvedValue,
        reason: reason || '',
        admin_user_id: user.id,
        admin_user_name: user.full_name || user.email || '',
      });
    }
  } else {
    // Create new resolution
    const created = await base44.asServiceRole.entities.FamilyLifeImportResolution.create({
      import_batch_id: batchId,
      import_row_id: comparison.import_row_id,
      field_comparison_id: comparison_id,
      entity_type: comparison.entity_type,
      target_entity_id: comparison.entity_id || '',
      canonical_field_name: comparison.canonical_field_name,
      ownership_category: comparison.ownership_category,
      resolution_type,
      current_value_snapshot: comparison.current_normalized_value || '',
      incoming_value_snapshot: comparison.incoming_normalized_value || '',
      resolved_value: resolvedValue,
      resolution_source: RESOLUTION_SOURCE.MANUAL,
      resolution_reason: reason || '',
      resolved_at: now,
      resolved_by: user.id,
      resolved_by_name: user.full_name || user.email || '',
      last_modified_at: now,
      last_modified_by: user.id,
      status: RESOLUTION_STATUS.RESOLVED,
    });
    resolutionId = created.id;

    // Audit: created
    await createAudit(base44, {
      import_batch_id: batchId,
      import_row_id: comparison.import_row_id,
      field_comparison_id: comparison_id,
      resolution_id: resolutionId,
      canonical_field_name: comparison.canonical_field_name,
      event_type: 'RESOLUTION_CREATED',
      prior_decision: 'NONE',
      new_decision: resolution_type,
      prior_value: '',
      new_value: resolvedValue,
      reason: reason || '',
      admin_user_id: user.id,
      admin_user_name: user.full_name || user.email || '',
    });
  }

  return Response.json({
    resolution_id: resolutionId,
    resolution_type,
    resolved_value: resolvedValue,
    status: RESOLUTION_STATUS.RESOLVED,
  });
}

// ============================================================
// bulk — bulk resolution action
// ============================================================
async function handleBulk(base44, user, batchId, body) {
  const { action_type, filter, comparison_ids, reason } = body;
  if (!action_type) {
    return Response.json({ error: 'action_type is required.' }, { status: 400 });
  }

  const { comparisons, resolutions } = await loadBatchData(base44, batchId);

  // Build resolution lookup by comparison ID
  const resolutionByCmpId = new Map();
  for (const r of resolutions) {
    if (r.status === RESOLUTION_STATUS.PENDING || r.status === RESOLUTION_STATUS.RESOLVED) {
      resolutionByCmpId.set(r.field_comparison_id, r);
    }
  }

  // Determine which comparisons to act on
  let targetComparisons = comparisons;
  if (comparison_ids && Array.isArray(comparison_ids) && comparison_ids.length > 0) {
    // Explicit selection (for USE_INCOMING_FOR_SELECTED_CONFLICTS, SKIP_SELECTED_FIELDS)
    const idSet = new Set(comparison_ids);
    targetComparisons = comparisons.filter((c) => idSet.has(c.id));
  } else if (filter) {
    // Apply filter criteria
    targetComparisons = applyComparisonFilter(comparisons, filter);
  }

  // Create the bulk resolution record
  const bulkRecord = await base44.asServiceRole.entities.FamilyLifeImportBulkResolution.create({
    import_batch_id: batchId,
    action_type,
    filter_snapshot: filter || {},
    selected_comparison_ids: comparison_ids || [],
    selected_row_ids: [],
    affected_resolution_count: 0,
    reason: reason || '',
    status: 'COMPLETED',
    created_by: user.id,
    created_by_name: user.full_name || user.email || '',
  });

  const now = new Date().toISOString();
  const toCreate = [];
  const toUpdate = [];
  const auditEntries = [];
  let affected = 0;

  for (const cmp of targetComparisons) {
    const bulkType = getBulkResolutionType(action_type, cmp);
    if (!bulkType) continue;

    // Validate the type is allowed
    if (!isResolutionTypeAllowed(cmp, bulkType)) continue;

    // Skip restriction removal attempts
    if (isRestrictionRemovalAttempt(cmp, bulkType)) continue;

    const resolvedValue = getResolvedValue(cmp, bulkType);
    const existing = resolutionByCmpId.get(cmp.id);

    if (existing) {
      const priorType = existing.resolution_type;
      toUpdate.push({
        id: existing.id,
        resolution_type: bulkType,
        resolved_value: resolvedValue,
        resolution_source: RESOLUTION_SOURCE.BULK,
        resolution_reason: reason || '',
        last_modified_at: now,
        last_modified_by: user.id,
        resolved_at: now,
        resolved_by: user.id,
        resolved_by_name: user.full_name || user.email || '',
        status: RESOLUTION_STATUS.RESOLVED,
        is_bulk_resolution: true,
        bulk_resolution_id: bulkRecord.id,
      });
      auditEntries.push({
        import_batch_id: batchId,
        import_row_id: cmp.import_row_id,
        field_comparison_id: cmp.id,
        resolution_id: existing.id,
        canonical_field_name: cmp.canonical_field_name,
        event_type: 'BULK_RESOLUTION_APPLIED',
        prior_decision: priorType || 'NONE',
        new_decision: bulkType,
        prior_value: existing.resolved_value || '',
        new_value: resolvedValue,
        reason: reason || '',
        bulk_resolution_id: bulkRecord.id,
        admin_user_id: user.id,
        admin_user_name: user.full_name || user.email || '',
        event_at: now,
      });
    } else {
      toCreate.push({
        import_batch_id: batchId,
        import_row_id: cmp.import_row_id,
        field_comparison_id: cmp.id,
        entity_type: cmp.entity_type,
        target_entity_id: cmp.entity_id || '',
        canonical_field_name: cmp.canonical_field_name,
        ownership_category: cmp.ownership_category,
        resolution_type: bulkType,
        current_value_snapshot: cmp.current_normalized_value || '',
        incoming_value_snapshot: cmp.incoming_normalized_value || '',
        resolved_value: resolvedValue,
        resolution_source: RESOLUTION_SOURCE.BULK,
        resolution_reason: reason || '',
        resolved_at: now,
        resolved_by: user.id,
        resolved_by_name: user.full_name || user.email || '',
        last_modified_at: now,
        last_modified_by: user.id,
        status: RESOLUTION_STATUS.RESOLVED,
        is_bulk_resolution: true,
        bulk_resolution_id: bulkRecord.id,
      });
      auditEntries.push({
        import_batch_id: batchId,
        import_row_id: cmp.import_row_id,
        field_comparison_id: cmp.id,
        canonical_field_name: cmp.canonical_field_name,
        event_type: 'BULK_RESOLUTION_APPLIED',
        prior_decision: 'NONE',
        new_decision: bulkType,
        prior_value: '',
        new_value: resolvedValue,
        reason: reason || '',
        bulk_resolution_id: bulkRecord.id,
        admin_user_id: user.id,
        admin_user_name: user.full_name || user.email || '',
        event_at: now,
      });
    }
    affected++;
  }

  // Execute bulk writes
  if (toCreate.length) await bulkCreateSafe(base44, 'FamilyLifeImportResolution', toCreate);
  if (toUpdate.length) await bulkUpdateSafe(base44, 'FamilyLifeImportResolution', toUpdate);

  // Create audit entries in chunks
  for (let i = 0; i < auditEntries.length; i += BULK_LIMIT) {
    const chunk = auditEntries.slice(i, i + BULK_LIMIT);
    await bulkCreateSafe(base44, 'FamilyLifeImportResolutionAudit', chunk);
  }

  // Update the bulk record with the actual affected count
  await base44.asServiceRole.entities.FamilyLifeImportBulkResolution.update(bulkRecord.id, {
    affected_resolution_count: affected,
  });

  return Response.json({
    bulk_resolution_id: bulkRecord.id,
    affected_count: affected,
    created_count: toCreate.length,
    updated_count: toUpdate.length,
  });
}

function applyComparisonFilter(comparisons, filter) {
  return comparisons.filter((c) => {
    if (filter.entity_type && c.entity_type !== filter.entity_type) return false;
    if (filter.ownership_category && c.ownership_category !== filter.ownership_category) return false;
    if (filter.record_classification && c.record_classification !== filter.record_classification) return false;
    return true;
  });
}

// ============================================================
// Row actions: discard, skip, block
// ============================================================
async function handleRowAction(base44, user, batchId, body, rowStatus, auditEventType) {
  const { row_id } = body;
  if (!row_id) return Response.json({ error: 'row_id is required.' }, { status: 400 });

  const row = await base44.asServiceRole.entities.FamilyLifeImportRow.get(row_id);
  if (!row || row.import_batch_id !== batchId) {
    return Response.json({ error: 'Row not found in this batch.' }, { status: 404 });
  }

  const priorStatus = row.row_resolution_status || 'PENDING';
  await base44.asServiceRole.entities.FamilyLifeImportRow.update(row_id, {
    row_resolution_status: rowStatus,
  });

  // Invalidate resolutions for this row (mark as INVALIDATED) since the row
  // is no longer being applied
  const rowResolutions = await base44.asServiceRole.entities.FamilyLifeImportResolution.filter({
    import_batch_id: batchId,
    import_row_id: row_id,
    status: { $in: [RESOLUTION_STATUS.PENDING, RESOLUTION_STATUS.RESOLVED] },
  });

  const invalidationUpdates = rowResolutions.map((r) => ({
    id: r.id,
    status: RESOLUTION_STATUS.INVALIDATED,
    last_modified_at: new Date().toISOString(),
    last_modified_by: user.id,
  }));

  if (invalidationUpdates.length) {
    await bulkUpdateSafe(base44, 'FamilyLifeImportResolution', invalidationUpdates);
  }

  // Audit entry
  await createAudit(base44, {
    import_batch_id: batchId,
    import_row_id: row_id,
    event_type: auditEventType,
    prior_decision: priorStatus,
    new_decision: rowStatus,
    admin_user_id: user.id,
    admin_user_name: user.full_name || user.email || '',
  });

  return Response.json({ row_id, row_resolution_status: rowStatus, invalidated_resolutions: invalidationUpdates.length });
}

// ============================================================
// manual_match — re-match a row to a chosen production target
// ============================================================
async function handleManualMatch(base44, user, batchId, body) {
  const { row_id, target_type, target_id } = body;
  if (!row_id || !target_type) {
    return Response.json({ error: 'row_id and target_type are required.' }, { status: 400 });
  }

  const row = await base44.asServiceRole.entities.FamilyLifeImportRow.get(row_id);
  if (!row || row.import_batch_id !== batchId) {
    return Response.json({ error: 'Row not found in this batch.' }, { status: 404 });
  }

  let matchedHouseholdId = '';
  let matchedMemberId = '';
  let existingHousehold = null;
  let existingMember = null;

  switch (target_type) {
    case 'HOUSEHOLD': {
      if (!target_id) return Response.json({ error: 'target_id is required for HOUSEHOLD match.' }, { status: 400 });
      existingHousehold = await base44.asServiceRole.entities.ChampionHousehold.get(target_id);
      if (!existingHousehold) return Response.json({ error: 'Target household not found.' }, { status: 404 });
      matchedHouseholdId = target_id;
      // Load members for this household
      const members = await base44.asServiceRole.entities.HouseholdMember.filter({ household_id: target_id });
      existingHousehold.members = members || [];
      break;
    }
    case 'MEMBER': {
      if (!target_id) return Response.json({ error: 'target_id is required for MEMBER match.' }, { status: 400 });
      existingMember = await base44.asServiceRole.entities.HouseholdMember.get(target_id);
      if (!existingMember) return Response.json({ error: 'Target member not found.' }, { status: 404 });
      matchedMemberId = target_id;
      matchedHouseholdId = existingMember.household_id;
      existingHousehold = await base44.asServiceRole.entities.ChampionHousehold.get(existingMember.household_id);
      const members = await base44.asServiceRole.entities.HouseholdMember.filter({ household_id: existingMember.household_id });
      if (existingHousehold) existingHousehold.members = members || [];
      break;
    }
    case 'NEW_HOUSEHOLD':
      // Treat as new record — no existing target
      break;
    case 'NEW_MEMBER_IN_EXISTING_HOUSEHOLD': {
      if (!target_id) return Response.json({ error: 'target_id (household_id) is required.' }, { status: 400 });
      existingHousehold = await base44.asServiceRole.entities.ChampionHousehold.get(target_id);
      if (!existingHousehold) return Response.json({ error: 'Target household not found.' }, { status: 404 });
      matchedHouseholdId = target_id;
      const members = await base44.asServiceRole.entities.HouseholdMember.filter({ household_id: target_id });
      existingHousehold.members = members || [];
      break;
    }
    default:
      return Response.json({ error: `Unknown target_type: ${target_type}` }, { status: 400 });
  }

  // 1. Invalidate existing comparisons and resolutions for this row
  const oldComparisons = await base44.asServiceRole.entities.FamilyLifeImportFieldComparison.filter({
    import_batch_id: batchId,
    import_row_id: row_id,
  });
  const oldResolutions = await base44.asServiceRole.entities.FamilyLifeImportResolution.filter({
    import_batch_id: batchId,
    import_row_id: row_id,
    status: { $in: [RESOLUTION_STATUS.PENDING, RESOLUTION_STATUS.RESOLVED] },
  });

  if (oldResolutions.length) {
    const now = new Date().toISOString();
    await bulkUpdateSafe(base44, 'FamilyLifeImportResolution', oldResolutions.map((r) => ({
      id: r.id,
      status: RESOLUTION_STATUS.INVALIDATED,
      last_modified_at: now,
      last_modified_by: user.id,
    })));
  }

  // Delete old comparisons for this row (clear-and-regenerate)
  if (oldComparisons.length) {
    await base44.asServiceRole.entities.FamilyLifeImportFieldComparison.deleteMany({
      import_batch_id: batchId,
      import_row_id: row_id,
    });
  }

  // 2. Re-run comparisons against the new target
  const validationErrors = {};
  for (const err of row.validation_errors || []) {
    const field = err.split(':')[0];
    validationErrors[field] = true;
  }

  const newComparisons = [];
  const now = new Date().toISOString();

  // Household-level comparisons (for representative rows only)
  if (row.is_household_representative) {
    const hhComparisons = compareAllFields({
      entityType: 'ChampionHousehold',
      incoming: row.normalized_source_data || {},
      existing: existingHousehold || null,
      validationErrors,
    });
    for (const cmp of hhComparisons) {
      newComparisons.push({
        import_batch_id: batchId,
        import_row_id: row_id,
        entity_type: 'ChampionHousehold',
        entity_id: existingHousehold?.id || '',
        ...cmp,
      });
    }
  }

  // Member-level comparisons
  const memberForComparison = existingHousehold?.members?.find((m) => m.id === matchedMemberId) || null;
  const memComparisons = compareAllFields({
    entityType: 'HouseholdMember',
    incoming: row.normalized_source_data || {},
    existing: memberForComparison,
    validationErrors,
  });
  for (const cmp of memComparisons) {
    newComparisons.push({
      import_batch_id: batchId,
      import_row_id: row_id,
      entity_type: 'HouseholdMember',
      entity_id: matchedMemberId || '',
      ...cmp,
    });
  }

  // 3. Create new comparison records
  let createdComparisons = [];
  if (newComparisons.length) {
    createdComparisons = await bulkCreateSafe(base44, 'FamilyLifeImportFieldComparison', newComparisons);
  }

  // 4. Generate default resolutions for the new comparisons
  const defaultResolutions = [];
  for (let i = 0; i < createdComparisons.length; i++) {
    const cmp = createdComparisons[i];
    const defaultType = getDefaultResolutionType(cmp);
    if (!defaultType) continue;
    defaultResolutions.push({
      import_batch_id: batchId,
      import_row_id: row_id,
      field_comparison_id: cmp.id,
      entity_type: cmp.entity_type,
      target_entity_id: cmp.entity_id || '',
      canonical_field_name: cmp.canonical_field_name,
      ownership_category: cmp.ownership_category,
      resolution_type: defaultType,
      current_value_snapshot: cmp.current_normalized_value || '',
      incoming_value_snapshot: cmp.incoming_normalized_value || '',
      resolved_value: getResolvedValue(cmp, defaultType),
      resolution_source: RESOLUTION_SOURCE.DEFAULT,
      resolved_at: now,
      resolved_by: user.id,
      resolved_by_name: user.full_name || user.email || '',
      last_modified_at: now,
      last_modified_by: user.id,
      status: RESOLUTION_STATUS.PENDING,
    });
  }
  if (defaultResolutions.length) {
    await bulkCreateSafe(base44, 'FamilyLifeImportResolution', defaultResolutions);
  }

  // 5. Update the row with the new match info
  let newClassification = row.record_classification;
  if (target_type === 'NEW_HOUSEHOLD') {
    newClassification = 'NEW_RECORD';
  } else if (target_type === 'NEW_MEMBER_IN_EXISTING_HOUSEHOLD') {
    newClassification = 'MATCHED_SAFE_CHANGES'; // Will be refined after comparison
  } else {
    newClassification = 'MATCHED_SAFE_CHANGES'; // Will be refined
  }

  await base44.asServiceRole.entities.FamilyLifeImportRow.update(row_id, {
    matched_household_id: matchedHouseholdId || null,
    matched_member_id: matchedMemberId || null,
    match_status: 'EXACT_EXTERNAL_ID', // Manual match is treated as high-confidence
    match_method: `Manual match by ${user.full_name || user.email}: ${target_type}${target_id ? ` (${target_id})` : ''}`,
    match_confidence: 'high',
    record_classification: newClassification,
    row_resolution_status: 'MANUALLY_MATCHED',
  });

  // 6. Audit entry
  await createAudit(base44, {
    import_batch_id: batchId,
    import_row_id: row_id,
    event_type: 'MANUAL_MATCH_SELECTED',
    prior_decision: row.match_status || 'NO_MATCH',
    new_decision: target_type,
    manual_match_target_id: target_id || '',
    manual_match_target_type: target_type,
    admin_user_id: user.id,
    admin_user_name: user.full_name || user.email || '',
  });

  return Response.json({
    row_id,
    target_type,
    target_id: target_id || '',
    new_comparisons: createdComparisons.length,
    new_default_resolutions: defaultResolutions.length,
    invalidated_resolutions: oldResolutions.length,
  });
}

// ============================================================
// check_readiness
// ============================================================
async function handleCheckReadiness(base44, user, batchId) {
  const { comparisons, resolutions, rows, issues } = await loadBatchData(base44, batchId);
  const batch = await base44.asServiceRole.entities.FamilyLifeImportBatch.get(batchId);

  const result = computeReadiness(comparisons, resolutions, rows, issues, batch);

  const now = new Date().toISOString();
  const wasReady = batch.readiness_status === 'READY_TO_APPLY';

  // Update batch with readiness result
  const updateData = {
    readiness_status: result.status,
    readiness_reason: result.reason,
    resolution_summary: result.summary,
  };

  if (result.ready && !wasReady) {
    updateData.ready_to_apply_at = now;
    updateData.ready_to_apply_by = user.id;
    updateData.status = 'READY_TO_APPLY';
  } else if (!result.ready && wasReady) {
    updateData.ready_to_apply_at = null;
    updateData.ready_to_apply_by = '';
    updateData.status = 'READY_FOR_REVIEW';
  }

  await base44.asServiceRole.entities.FamilyLifeImportBatch.update(batchId, updateData);

  // Audit: readiness granted or revoked
  if (result.ready && !wasReady) {
    await createAudit(base44, {
      import_batch_id: batchId,
      event_type: 'BATCH_READINESS_GRANTED',
      prior_decision: batch.readiness_status || 'NOT_READY',
      new_decision: 'READY_TO_APPLY',
      admin_user_id: user.id,
      admin_user_name: user.full_name || user.email || '',
    });
  } else if (!result.ready && wasReady) {
    await createAudit(base44, {
      import_batch_id: batchId,
      event_type: 'BATCH_READINESS_REVOKED',
      prior_decision: 'READY_TO_APPLY',
      new_decision: result.status,
      reason: result.reason,
      admin_user_id: user.id,
      admin_user_name: user.full_name || user.email || '',
    });
  }

  return Response.json(result);
}
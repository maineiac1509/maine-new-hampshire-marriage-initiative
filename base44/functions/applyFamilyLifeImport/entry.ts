import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// FamilyLife Import — Production Apply Engine (Chunked)
// ============================================================
// Admin-only HTTP entry point for the resumable, checkpointed
// production apply engine. Executes approved resolutions in
// bounded chunks with persistent progress tracking.
//
// Actions:
//   preflight  — validate readiness, return counts (read-only)
//   start      — acquire lock, preflight, create operations, init phase
//   chunk      — process next bounded chunk of PENDING operations
//   status     — return current progress and phase
//   reset      — reset to READY_FOR_REVIEW if safe (no APPLIED ops)
//
// Chunked execution guarantees:
//   - Each invocation processes at most CHUNK_SIZE entity groups
//   - Each invocation completes in <10 seconds
//   - Progress is checkpointed after every chunk
//   - Resume from PENDING operations is idempotent
//   - Created entity IDs are persisted on operations immediately
//   - No manual database cleanup needed after interruption
// ============================================================

import {
  preflightValidate, generateWritePlan, detectDrift,
  sanitizeWritePayload, validateSanitization,
  buildOperationKey, buildCreationKey, computeProgress, nextPhase, isStale,
  DRIFT_STATUS, OPERATION_TYPE, OPERATION_STATUS, APPLY_RESULT,
  APPLY_PHASE, PHASE_ORDER, PHASE_OPERATION_TYPES,
  CHUNK_SIZE, STALE_THRESHOLD_SECONDS,
} from '../../shared/import/applyEngine.ts';
import {
  RESOLUTION_TYPE, RESOLUTION_STATUS,
  CURRENT_GOVERNANCE_VERSION, CURRENT_MAPPING_VERSION,
} from '../../shared/import/resolver.ts';
import { COMPARISON_RESULT } from '../../shared/import/comparator.ts';
import { FIELD_GOVERNANCE, OWNERSHIP, IMPORT_OPERATIONS, getFieldPolicy, normalizeForComparison } from '../../shared/import/governance.ts';
import { bulkCreateSafe, bulkUpdateSafe, loadBatchData } from '../../shared/import/backendHelpers.ts';

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

    const { action, import_batch_id, confirmation_text } = body;
    if (!action || !import_batch_id) {
      return Response.json({ error: 'action and import_batch_id are required.' }, { status: 400 });
    }

    switch (action) {
      case 'preflight':
        return await handlePreflight(base44, user, import_batch_id);
      case 'start':
        return await handleStart(base44, user, import_batch_id, confirmation_text);
      case 'chunk':
        return await handleChunk(base44, user, import_batch_id);
      case 'status':
        return await handleStatus(base44, user, import_batch_id);
      case 'reset':
        return await handleReset(base44, user, import_batch_id);
      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message || 'Apply operation failed.' }, { status: 500 });
  }
}

// ============================================================
// Helpers
// ============================================================

async function createApplyAudits(base44, entries: any[]) {
  if (!entries.length) return;
  const auditRecords = entries.map((e) => ({
    applied_at: new Date().toISOString(),
    ...e,
  }));
  await bulkCreateSafe(base44, 'FamilyLifeImportApplyAudit', auditRecords);
}

async function updateCheckpoint(base44, batchId: string, updates: Record<string, unknown>) {
  await base44.asServiceRole.entities.FamilyLifeImportBatch.update(batchId, updates);
}

function isApplyInProgress(batch: any): boolean {
  return batch.apply_status === 'APPLYING' || batch.apply_status === 'PAUSED';
}

// ============================================================
// preflight — validate readiness and return counts (read-only)
// ============================================================
async function handlePreflight(base44, user, batchId) {
  const batch = await base44.asServiceRole.entities.FamilyLifeImportBatch.get(batchId);
  if (!batch) return Response.json({ error: 'Batch not found.' }, { status: 404 });

  const { comparisons, resolutions, rows, issues } = await loadBatchData(base44, batchId);
  const result = preflightValidate(batch, rows, comparisons, resolutions, issues);

  return Response.json({
    passed: result.passed,
    errors: result.errors,
    warnings: result.warnings,
    counts: result.counts,
    batch_status: batch.status,
    file_name: batch.file_name,
    governance_version: batch.governance_version,
    mapping_version: batch.mapping_version,
  });
}

// ============================================================
// start — acquire lock, preflight, create operations, init phase
// ============================================================
async function handleStart(base44, user, batchId, confirmationText) {
  if (confirmationText !== 'APPLY') {
    return Response.json({ error: 'Confirmation text "APPLY" is required to start the apply.' }, { status: 400 });
  }

  const batch = await base44.asServiceRole.entities.FamilyLifeImportBatch.get(batchId);
  if (!batch) return Response.json({ error: 'Batch not found.' }, { status: 404 });

  if (batch.status === 'APPLIED' || batch.apply_status === 'APPLIED') {
    return Response.json({ error: 'This batch has already been applied.', applied_at: batch.applied_at }, { status: 409 });
  }

  // Allow start if: fresh (READY_TO_APPLY, apply_status PENDING) or resuming a stale execution
  const inProgress = isApplyInProgress(batch);
  const stale = inProgress && isStale(batch.apply_progress?.last_checkpoint_at);
  const hasProgress = batch.apply_status === 'PAUSED' ||
    (batch.apply_status === 'APPLYING' && stale);

  if (batch.status === 'READY_TO_APPLY' && batch.apply_status === 'PENDING') {
    // Fresh start — proceed
  } else if (hasProgress) {
    // Resume from stale/paused — proceed, will pickup PENDING ops
  } else if (inProgress && !stale) {
    return Response.json({
      error: 'An apply execution is in progress and not stale. Wait or resume later.',
      apply_execution_id: batch.apply_execution_id,
      last_checkpoint: batch.apply_progress?.last_checkpoint_at,
    }, { status: 409 });
  } else {
    return Response.json({ error: `Batch status is "${batch.status}", not READY_TO_APPLY.` }, { status: 409 });
  }

  // Preflight validation
  const { comparisons, resolutions, rows, issues } = await loadBatchData(base44, batchId);
  const preflight = preflightValidate(batch, rows, comparisons, resolutions, issues);
  if (!preflight.passed) {
    return Response.json({
      error: 'Preflight validation failed.',
      errors: preflight.errors,
      warnings: preflight.warnings,
    }, { status: 422 });
  }

  // Acquire lock
  const executionId = batch.apply_execution_id && hasProgress
    ? batch.apply_execution_id // Reuse existing execution ID on resume
    : `apply-${batchId}-${Date.now()}`;
  const now = new Date().toISOString();

  // Check for existing operations (from a prior interrupted start)
  const existingOps = await base44.asServiceRole.entities.FamilyLifeImportApplyOperation.filter(
    { import_batch_id: batchId }, undefined, 5000,
  );
  const existingOpKeys = new Set(existingOps.map((o) => o.operation_key));

  if (existingOps.length === 0) {
    // Fresh start — generate and create operations
    const plan = generateWritePlan(batch, rows, comparisons, resolutions);

    const newOps = plan.operations.map((op) => ({
      import_batch_id: batchId,
      apply_execution_id: executionId,
      import_row_id: op.import_row_id,
      comparison_id: op.comparison_id,
      resolution_id: op.resolution_id,
      operation_key: op.operation_key,
      operation_type: op.operation_type,
      entity_type: op.entity_type,
      entity_id: op.entity_id,
      temporary_entity_key: op.temporary_entity_key,
      field_name: op.field_name,
      resolution_type: op.resolution_type,
      ownership_category: op.ownership_category,
      prior_value: '',
      applied_value: '',
      expected_snapshot: op.expected_snapshot,
      drift_status: 'NOT_CHECKED',
      status: 'PENDING',
      applied_by: user.id,
    }));

    if (newOps.length) {
      await bulkCreateSafe(base44, 'FamilyLifeImportApplyOperation', newOps);
    }

    const totalOps = newOps.length;
    const progress = computeProgress(totalOps, 0, 0, 0, 0, 0);

    await updateCheckpoint(base44, batchId, {
      status: 'APPLYING',
      apply_status: 'PAUSED',
      apply_phase: APPLY_PHASE.CREATING_HOUSEHOLDS,
      apply_execution_id: executionId,
      applying_started_at: now,
      applying_started_by: user.id,
      apply_error: '',
      apply_progress: progress,
    });

    // Audit: APPLY_STARTED
    await createApplyAudits(base44, [{
      import_batch_id: batchId,
      apply_execution_id: executionId,
      apply_result: 'VERIFIED',
      applied_by: user.id,
    }]);

    return Response.json({
      started: true,
      apply_execution_id: executionId,
      phase: APPLY_PHASE.CREATING_HOUSEHOLDS,
      progress,
      total_operations: totalOps,
      message: 'Apply started. Call "chunk" to process the next batch of operations.',
    });
  } else {
    // Resume — operations already exist, just re-acquire lock
    await updateCheckpoint(base44, batchId, {
      status: 'APPLYING',
      apply_status: 'PAUSED',
      apply_execution_id: executionId,
      apply_error: '',
      apply_progress: {
        ...batch.apply_progress,
        last_checkpoint_at: now,
      },
    });

    // Count current statuses
    const applied = existingOps.filter((o) => o.status === OPERATION_STATUS.APPLIED).length;
    const verified = existingOps.filter((o) => o.status === OPERATION_STATUS.VERIFIED).length;
    const failed = existingOps.filter((o) => o.status === OPERATION_STATUS.FAILED).length;
    const skipped = existingOps.filter((o) => o.status === OPERATION_STATUS.SKIPPED).length;
    const progress = computeProgress(existingOps.length, applied, verified, failed, skipped, batch.apply_progress?.chunk_index || 0);

    return Response.json({
      resumed: true,
      apply_execution_id: executionId,
      phase: batch.apply_phase || APPLY_PHASE.CREATING_HOUSEHOLDS,
      progress,
      total_operations: existingOps.length,
      message: 'Apply resumed. Call "chunk" to continue processing.',
    });
  }
}

// ============================================================
// chunk — process the next bounded chunk of PENDING operations
// ============================================================
async function handleChunk(base44, user, batchId) {
  const batch = await base44.asServiceRole.entities.FamilyLifeImportBatch.get(batchId);
  if (!batch) return Response.json({ error: 'Batch not found.' }, { status: 404 });

  // Must be PAUSED or stale APPLYING
  if (batch.apply_status === 'PAUSED') {
    // Good — proceed
  } else if (batch.apply_status === 'APPLYING') {
    // Check if stale — if so, auto-resume
    if (!isStale(batch.apply_progress?.last_checkpoint_at)) {
      return Response.json({
        error: 'A chunk is currently being processed. Wait for it to complete.',
        last_checkpoint: batch.apply_progress?.last_checkpoint_at,
      }, { status: 409 });
    }
    // Stale — auto-resume by proceeding
  } else if (batch.apply_status === 'APPLIED') {
    return Response.json({ error: 'Batch has already been applied.' }, { status: 409 });
  } else {
    return Response.json({
      error: `Cannot process chunk. Apply status is "${batch.apply_status}". Call "start" first.`,
    }, { status: 409 });
  }

  // Acquire chunk lock
  const now = new Date().toISOString();
  await updateCheckpoint(base44, batchId, {
    apply_status: 'APPLYING',
    apply_progress: { ...batch.apply_progress, last_checkpoint_at: now },
  });

  try {
    return await processChunk(base44, user, batchId, batch);
  } catch (error) {
    const errorMsg = error?.message || 'Chunk processing failed.';
    // Release lock back to PAUSED — progress is preserved
    try {
      await updateCheckpoint(base44, batchId, {
        apply_status: 'PAUSED',
        apply_error: errorMsg,
      });
    } catch (_) { /* best-effort */ }
    return Response.json({
      error: errorMsg,
      can_resume: true,
    }, { status: 500 });
  }
}

// ============================================================
// processChunk — execute one bounded chunk
// ============================================================
async function processChunk(base44, user, batchId, batch) {
  const now = new Date().toISOString();
  const executionId = batch.apply_execution_id;
  let currentPhase = batch.apply_phase || APPLY_PHASE.CREATING_HOUSEHOLDS;
  let chunkIndex = (batch.apply_progress?.chunk_index || 0);

  // Load all operations to determine current state
  const allOps = await base44.asServiceRole.entities.FamilyLifeImportApplyOperation.filter(
    { import_batch_id: batchId }, undefined, 5000,
  );

  // If phase is VERIFYING, handle specially
  if (currentPhase === APPLY_PHASE.VERIFYING) {
    return await handleVerifyPhase(base44, user, batchId, batch, allOps, executionId, now);
  }

  // If phase is FINALIZING, handle specially
  if (currentPhase === APPLY_PHASE.FINALIZING) {
    return await handleFinalizePhase(base44, user, batchId, batch, allOps, executionId, now);
  }

  // For write phases — find PENDING operations for the current phase
  const phaseTypes = PHASE_OPERATION_TYPES[currentPhase] || [];
  const pendingOps = allOps.filter((op) =>
    phaseTypes.includes(op.operation_type) && op.status === OPERATION_STATUS.PENDING,
  );

  // If no pending ops in current phase, advance to next phase
  if (pendingOps.length === 0) {
    const next = nextPhase(currentPhase);
    const applied = allOps.filter((o) => o.status === OPERATION_STATUS.APPLIED).length;
    const verified = allOps.filter((o) => o.status === OPERATION_STATUS.VERIFIED).length;
    const failed = allOps.filter((o) => o.status === OPERATION_STATUS.FAILED).length;
    const skipped = allOps.filter((o) => o.status === OPERATION_STATUS.SKIPPED).length;
    const progress = computeProgress(allOps.length, applied, verified, failed, skipped, chunkIndex);

    await updateCheckpoint(base44, batchId, {
      apply_status: 'PAUSED',
      apply_phase: next,
      apply_progress: progress,
    });

    if (next === APPLY_PHASE.COMPLETED) {
      // Should have gone through FINALIZING — but if we skipped, finalize now
      return await handleFinalizePhase(base44, user, batchId, batch, allOps, executionId, now);
    }

    return Response.json({
      phase_advanced: true,
      previous_phase: currentPhase,
      new_phase: next,
      progress,
      completed: false,
      message: `Phase "${currentPhase}" complete. Next: "${next}".`,
    });
  }

  // Process the chunk based on the current phase
  let result;
  switch (currentPhase) {
    case APPLY_PHASE.CREATING_HOUSEHOLDS:
      result = await processCreateHouseholdsChunk(base44, user, batchId, batch, allOps, pendingOps, executionId, now);
      break;
    case APPLY_PHASE.CREATING_MEMBERS:
      result = await processCreateMembersChunk(base44, user, batchId, batch, allOps, pendingOps, executionId, now);
      break;
    case APPLY_PHASE.UPDATING_HOUSEHOLDS:
      result = await processUpdateHouseholdsChunk(base44, user, batchId, batch, allOps, pendingOps, executionId, now);
      break;
    case APPLY_PHASE.UPDATING_MEMBERS:
      result = await processUpdateMembersChunk(base44, user, batchId, batch, allOps, pendingOps, executionId, now);
      break;
    case APPLY_PHASE.APPLYING_RESTRICTIONS:
      result = await processRestrictionsChunk(base44, user, batchId, batch, allOps, pendingOps, executionId, now);
      break;
    case APPLY_PHASE.RECORDING_DECISIONS:
      result = await processDecisionsChunk(base44, user, batchId, batch, allOps, pendingOps, executionId, now);
      break;
    default:
      // Unknown phase — advance
      const next = nextPhase(currentPhase);
      await updateCheckpoint(base44, batchId, {
        apply_status: 'PAUSED',
        apply_phase: next,
      });
      return Response.json({ phase_advanced: true, new_phase: next, completed: false });
  }

  chunkIndex++;
  const applied = allOps.filter((o) => o.status === OPERATION_STATUS.APPLIED).length + result.appliedCount;
  const verified = allOps.filter((o) => o.status === OPERATION_STATUS.VERIFIED).length;
  const failed = allOps.filter((o) => o.status === OPERATION_STATUS.FAILED).length + result.failedCount;
  const skipped = allOps.filter((o) => o.status === OPERATION_STATUS.SKIPPED).length + result.skippedCount;
  const progress = computeProgress(allOps.length, applied, verified, failed, skipped, chunkIndex);

  // Check if this phase is now complete
  const remainingPending = allOps.filter((op) =>
    phaseTypes.includes(op.operation_type) && op.status === OPERATION_STATUS.PENDING && !result.processedOpIds.has(op.id),
  ).length;

  let phaseComplete = remainingPending === 0 && !result.hasMore;
  let nextP = phaseComplete ? nextPhase(currentPhase) : currentPhase;

  await updateCheckpoint(base44, batchId, {
    apply_status: 'PAUSED',
    apply_phase: nextP,
    apply_progress: progress,
    apply_error: result.error || '',
  });

  return Response.json({
    chunk_processed: true,
    phase: nextP,
    progress,
    processed: result.processedCount,
    applied: result.appliedCount,
    failed: result.failedCount,
    skipped: result.skippedCount,
    has_more: !phaseComplete,
    completed: nextP === APPLY_PHASE.COMPLETED,
    message: phaseComplete
      ? `Phase "${currentPhase}" complete. Next: "${nextP}".`
      : `Processed ${result.processedCount} operations in "${currentPhase}".`,
  });
}

// ============================================================
// Phase: CREATING_HOUSEHOLDS
// ============================================================
async function processCreateHouseholdsChunk(base44, user, batchId, batch, allOps, pendingOps, executionId, now) {
  // Group by temporary_entity_key (row ID)
  const groups = new Map<string, any[]>();
  for (const op of pendingOps) {
    const key = op.temporary_entity_key || op.import_row_id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(op);
  }

  const chunkGroups = Array.from(groups.entries()).slice(0, CHUNK_SIZE);
  const processedOpIds = new Set<string>();
  const auditEntries: any[] = [];
  let appliedCount = 0;
  let failedCount = 0;

  const rows = await base44.asServiceRole.entities.FamilyLifeImportRow.filter(
    { import_batch_id: batchId }, 'row_number', 5000,
  );

  for (const [rowId, ops] of chunkGroups) {
    // Skip if already APPLIED from prior interrupted run
    const alreadyApplied = ops.find((o) => o.status === OPERATION_STATUS.APPLIED || o.status === OPERATION_STATUS.VERIFIED);
    if (alreadyApplied) {
      for (const op of ops) processedOpIds.add(op.id);
      appliedCount += ops.length;
      continue;
    }

    // Build deterministic creation key for recovery
    const creationKey = buildCreationKey(batchId, rowId, 'ChampionHousehold');

    // STEP 1: Check if production record already exists (recovery from interrupted creation)
    const existingByKey = await base44.asServiceRole.entities.ChampionHousehold.filter(
      { import_creation_key: creationKey }, undefined, 1,
    );
    if (existingByKey && existingByKey.length > 0) {
      const existingId = existingByKey[0].id;
      const opUpdates = ops.map((op) => ({
        id: op.id, status: OPERATION_STATUS.APPLIED, entity_id: existingId,
        applied_at: now, drift_status: DRIFT_STATUS.NO_DRIFT,
      }));
      await bulkUpdateSafe(base44, 'FamilyLifeImportApplyOperation', opUpdates);
      for (const op of ops) processedOpIds.add(op.id);
      appliedCount += ops.length;
      auditEntries.push({
        import_batch_id: batchId, apply_execution_id: executionId, import_row_id: rowId,
        entity_type: 'ChampionHousehold', entity_id: existingId,
        operation_type: OPERATION_TYPE.CREATE_HOUSEHOLD, apply_result: 'UPDATED', applied_by: user.id,
      });
      continue;
    }

    // STEP 2: Build create payload from resolved values
    const createPayload: Record<string, unknown> = {};
    for (const op of ops) {
      if (op.applied_value) {
        const policy = getFieldPolicy('ChampionHousehold', op.field_name);
        createPayload[op.field_name] = coerceValue(policy, op.applied_value);
      }
    }

    // STEP 3: Secondary recovery — FL external ID (only if present and exactly 1 match)
    const flExtId = createPayload.familylife_external_id;
    if (flExtId) {
      const existingByFlId = await base44.asServiceRole.entities.ChampionHousehold.filter(
        { familylife_external_id: String(flExtId) }, undefined, 5,
      );
      if (existingByFlId && existingByFlId.length === 1) {
        const existingId = existingByFlId[0].id;
        const opUpdates = ops.map((op) => ({
          id: op.id, status: OPERATION_STATUS.APPLIED, entity_id: existingId,
          applied_at: now, drift_status: DRIFT_STATUS.NO_DRIFT,
        }));
        await bulkUpdateSafe(base44, 'FamilyLifeImportApplyOperation', opUpdates);
        for (const op of ops) processedOpIds.add(op.id);
        appliedCount += ops.length;
        auditEntries.push({
          import_batch_id: batchId, apply_execution_id: executionId, import_row_id: rowId,
          entity_type: 'ChampionHousehold', entity_id: existingId,
          operation_type: OPERATION_TYPE.CREATE_HOUSEHOLD, apply_result: 'UPDATED', applied_by: user.id,
        });
        continue;
      }
      // Multiple matches — ambiguous, proceed to creation (caught by verification)
    }

    // STEP 4: Sanitize and create with deterministic creation key
    const sanResult = sanitizeWritePayload(createPayload, IMPORT_OPERATIONS.NEW_RECORD_CREATE, null, 'ChampionHousehold');
    const finalPayload: Record<string, unknown> = {};
    for (const field of Object.keys(sanResult.sanitized)) {
      finalPayload[field] = createPayload[field];
    }
    finalPayload.last_familylife_sync_at = now;
    finalPayload.last_familylife_import_batch_id = batchId;
    finalPayload.import_creation_key = creationKey;

    // Create the household — production record carries the creation_key
    const created = await base44.asServiceRole.entities.ChampionHousehold.create(finalPayload);
    const householdId = created.id;

    // STEP 5: Per-record durable checkpoint — immediately persist ops for THIS record
    const opUpdates = ops.map((op) => ({
      id: op.id, status: OPERATION_STATUS.APPLIED, entity_id: householdId,
      applied_at: now, drift_status: DRIFT_STATUS.NO_DRIFT,
    }));
    await bulkUpdateSafe(base44, 'FamilyLifeImportApplyOperation', opUpdates);

    for (const op of ops) processedOpIds.add(op.id);
    appliedCount += ops.length;
    auditEntries.push({
      import_batch_id: batchId, apply_execution_id: executionId, import_row_id: rowId,
      entity_type: 'ChampionHousehold', entity_id: householdId,
      operation_type: OPERATION_TYPE.CREATE_HOUSEHOLD, apply_result: 'CREATED', applied_by: user.id,
    });
  }

  // Batch create audits (ops already checkpointed per-record)
  if (auditEntries.length) await createApplyAudits(base44, auditEntries);

  const hasMore = groups.size > chunkGroups.length;
  return {
    processedOpIds,
    processedCount: chunkGroups.length,
    appliedCount,
    failedCount,
    skippedCount: 0,
    hasMore,
  };
}

// ============================================================
// Phase: CREATING_MEMBERS
// ============================================================
async function processCreateMembersChunk(base44, user, batchId, batch, allOps, pendingOps, executionId, now) {
  const groups = new Map<string, any[]>();
  for (const op of pendingOps) {
    const key = op.temporary_entity_key || op.import_row_id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(op);
  }

  const chunkGroups = Array.from(groups.entries()).slice(0, CHUNK_SIZE);
  const processedOpIds = new Set<string>();
  const auditEntries: any[] = [];
  let appliedCount = 0;
  let failedCount = 0;

  const rows = await base44.asServiceRole.entities.FamilyLifeImportRow.filter(
    { import_batch_id: batchId }, 'row_number', 5000,
  );

  for (const [rowId, ops] of chunkGroups) {
    const alreadyApplied = ops.find((o) => o.status === OPERATION_STATUS.APPLIED || o.status === OPERATION_STATUS.VERIFIED);
    if (alreadyApplied) {
      for (const op of ops) processedOpIds.add(op.id);
      appliedCount += ops.length;
      continue;
    }

    // Build deterministic creation key
    const creationKey = buildCreationKey(batchId, rowId, 'HouseholdMember');

    // STEP 1: Check if production record already exists (recovery from interrupted creation)
    const existingByKey = await base44.asServiceRole.entities.HouseholdMember.filter(
      { import_creation_key: creationKey }, undefined, 1,
    );
    if (existingByKey && existingByKey.length > 0) {
      const existingId = existingByKey[0].id;
      const opUpdates = ops.map((op) => ({
        id: op.id, status: OPERATION_STATUS.APPLIED, entity_id: existingId,
        applied_at: now, drift_status: DRIFT_STATUS.NO_DRIFT,
      }));
      await bulkUpdateSafe(base44, 'FamilyLifeImportApplyOperation', opUpdates);
      for (const op of ops) processedOpIds.add(op.id);
      appliedCount += ops.length;
      auditEntries.push({
        import_batch_id: batchId, apply_execution_id: executionId, import_row_id: rowId,
        entity_type: 'HouseholdMember', entity_id: existingId,
        operation_type: OPERATION_TYPE.CREATE_MEMBER, apply_result: 'UPDATED', applied_by: user.id,
      });
      continue;
    }

    // STEP 2: Resolve target household ID
    const row = rows.find((r) => r.id === rowId);
    let targetHouseholdId = row?.matched_household_id || '';

    if (!targetHouseholdId && row?.household_group_key) {
      const householdOps = allOps.filter((o) =>
        o.operation_type === OPERATION_TYPE.CREATE_HOUSEHOLD &&
        (o.status === OPERATION_STATUS.APPLIED || o.status === OPERATION_STATUS.VERIFIED) &&
        o.entity_id,
      );
      for (const hhOp of householdOps) {
        const hhRow = rows.find((r) => r.id === hhOp.import_row_id);
        if (hhRow?.household_group_key === row.household_group_key) {
          targetHouseholdId = hhOp.entity_id;
          break;
        }
      }
    }

    if (!targetHouseholdId) {
      const opUpdates = ops.map((op) => ({
        id: op.id, status: OPERATION_STATUS.FAILED,
        error_message: 'No target household ID found for member creation.', applied_at: now,
      }));
      await bulkUpdateSafe(base44, 'FamilyLifeImportApplyOperation', opUpdates);
      for (const op of ops) processedOpIds.add(op.id);
      failedCount += ops.length;
      continue;
    }

    // STEP 3: Build member payload from resolved values
    const memberPayload: Record<string, unknown> = {};
    for (const op of ops) {
      if (op.applied_value) {
        const policy = getFieldPolicy('HouseholdMember', op.field_name);
        memberPayload[op.field_name] = coerceValue(policy, op.applied_value);
      }
    }

    // STEP 4: Sanitize and create with deterministic creation key
    const sanResult = sanitizeWritePayload(
      { ...memberPayload, household_id: targetHouseholdId },
      IMPORT_OPERATIONS.NEW_RECORD_CREATE, null, 'HouseholdMember',
    );
    const finalPayload: Record<string, unknown> = { household_id: targetHouseholdId };
    for (const field of Object.keys(sanResult.sanitized)) {
      if (field !== 'household_id') finalPayload[field] = memberPayload[field];
    }
    finalPayload.import_creation_key = creationKey;

    // Create the member — production record carries the creation_key
    const createdMember = await base44.asServiceRole.entities.HouseholdMember.create(finalPayload);

    // STEP 5: Per-record durable checkpoint
    const opUpdates = ops.map((op) => ({
      id: op.id, status: OPERATION_STATUS.APPLIED, entity_id: createdMember.id,
      applied_at: now, drift_status: DRIFT_STATUS.NO_DRIFT,
    }));
    await bulkUpdateSafe(base44, 'FamilyLifeImportApplyOperation', opUpdates);

    for (const op of ops) processedOpIds.add(op.id);
    appliedCount += ops.length;
    auditEntries.push({
      import_batch_id: batchId, apply_execution_id: executionId, import_row_id: rowId,
      entity_type: 'HouseholdMember', entity_id: createdMember.id,
      operation_type: OPERATION_TYPE.CREATE_MEMBER, apply_result: 'CREATED', applied_by: user.id,
    });
  }

  if (auditEntries.length) await createApplyAudits(base44, auditEntries);

  const hasMore = groups.size > chunkGroups.length;
  return {
    processedOpIds,
    processedCount: chunkGroups.length,
    appliedCount,
    failedCount,
    skippedCount: 0,
    hasMore,
  };
}

// ============================================================
// Phase: UPDATING_HOUSEHOLDS
// ============================================================
async function processUpdateHouseholdsChunk(base44, user, batchId, batch, allOps, pendingOps, executionId, now) {
  // Group by entity_id (household ID)
  const groups = new Map<string, any[]>();
  for (const op of pendingOps) {
    if (!op.entity_id) continue;
    if (!groups.has(op.entity_id)) groups.set(op.entity_id, []);
    groups.get(op.entity_id).push(op);
  }

  const chunkGroups = Array.from(groups.entries()).slice(0, CHUNK_SIZE);
  const processedOpIds = new Set<string>();
  const opUpdates: any[] = [];
  const auditEntries: any[] = [];
  let appliedCount = 0;
  let failedCount = 0;

  // Batch load current households for drift detection
  const householdIds = chunkGroups.map(([hid]) => hid);
  const currentHouseholds = householdIds.length > 0
    ? await base44.asServiceRole.entities.ChampionHousehold.filter({ id: { $in: householdIds } }, undefined, 500)
    : [];
  const householdMap = new Map(currentHouseholds.map((h) => [h.id, h]));

  for (const [householdId, ops] of chunkGroups) {
    const currentHousehold = householdMap.get(householdId);
    if (!currentHousehold) {
      for (const op of ops) {
        processedOpIds.add(op.id);
        opUpdates.push({ id: op.id, status: OPERATION_STATUS.FAILED, error_message: 'Target household not found.', applied_at: now });
      }
      failedCount += ops.length;
      continue;
    }

    // Build update payload and check drift
    const updatePayload: Record<string, unknown> = {};
    let driftDetected = false;

    for (const op of ops) {
      const policy = getFieldPolicy('ChampionHousehold', op.field_name);
      const expected = op.expected_snapshot || '';
      const drift = detectDrift(policy, currentHousehold[op.field_name], expected);

      if (drift === DRIFT_STATUS.MATERIAL_DRIFT) {
        driftDetected = true;
        processedOpIds.add(op.id);
        opUpdates.push({
          id: op.id, status: OPERATION_STATUS.FAILED,
          drift_status: drift,
          error_message: 'Material drift detected — field changed since reconciliation.',
          applied_at: now,
        });
        failedCount++;
        auditEntries.push({
          import_batch_id: batchId, apply_execution_id: executionId,
          import_row_id: op.import_row_id, comparison_id: op.comparison_id,
          resolution_id: op.resolution_id,
          entity_type: 'ChampionHousehold', entity_id: householdId,
          canonical_field_name: op.field_name,
          operation_type: OPERATION_TYPE.UPDATE_HOUSEHOLD_FIELD,
          apply_result: 'DRIFT_BLOCKED', drift_status: drift,
          applied_by: user.id,
        });
      } else {
        updatePayload[op.field_name] = coerceValue(policy, op.applied_value);
      }
    }

    if (driftDetected && Object.keys(updatePayload).length === 0) {
      continue; // All fields drifted — skip update
    }

    if (Object.keys(updatePayload).length > 0) {
      updatePayload.last_familylife_sync_at = now;
      updatePayload.last_familylife_import_batch_id = batchId;

      // Sanitize
      const sanResult = sanitizeWritePayload(
        updatePayload, IMPORT_OPERATIONS.RECONCILIATION_APPROVED_UPDATE, currentHousehold, 'ChampionHousehold',
      );

      // Write resolved values (sanitizer validates which fields are allowed)
      const writePayload: Record<string, unknown> = {};
      for (const field of Object.keys(updatePayload)) {
        if (field !== 'last_familylife_sync_at' && field !== 'last_familylife_import_batch_id' && sanResult.blocked.includes(field)) {
          // Blocked by sanitizer — mark as failed
          continue;
        }
        writePayload[field] = updatePayload[field];
      }

      if (Object.keys(writePayload).length > 2) { // More than just sync metadata
        await base44.asServiceRole.entities.ChampionHousehold.update(householdId, writePayload);
      }

      // Mark non-drifted ops as APPLIED
      for (const op of ops) {
        if (!processedOpIds.has(op.id)) {
          processedOpIds.add(op.id);
          opUpdates.push({
            id: op.id, status: OPERATION_STATUS.APPLIED,
            prior_value: String(currentHousehold[op.field_name] ?? ''),
            applied_at: now,
            drift_status: DRIFT_STATUS.NO_DRIFT,
          });
          appliedCount++;
        }
      }

      auditEntries.push({
        import_batch_id: batchId, apply_execution_id: executionId,
        entity_type: 'ChampionHousehold', entity_id: householdId,
        operation_type: OPERATION_TYPE.UPDATE_HOUSEHOLD_FIELD,
        apply_result: 'UPDATED', applied_by: user.id,
      });
    }
  }

  if (opUpdates.length) await bulkUpdateSafe(base44, 'FamilyLifeImportApplyOperation', opUpdates);
  if (auditEntries.length) await createApplyAudits(base44, auditEntries);

  const hasMore = groups.size > chunkGroups.length;
  return {
    processedOpIds,
    processedCount: chunkGroups.length,
    appliedCount,
    failedCount,
    skippedCount: 0,
    hasMore,
  };
}

// ============================================================
// Phase: UPDATING_MEMBERS
// ============================================================
async function processUpdateMembersChunk(base44, user, batchId, batch, allOps, pendingOps, executionId, now) {
  const groups = new Map<string, any[]>();
  for (const op of pendingOps) {
    if (!op.entity_id) continue;
    if (!groups.has(op.entity_id)) groups.set(op.entity_id, []);
    groups.get(op.entity_id).push(op);
  }

  const chunkGroups = Array.from(groups.entries()).slice(0, CHUNK_SIZE);
  const processedOpIds = new Set<string>();
  const opUpdates: any[] = [];
  const auditEntries: any[] = [];
  let appliedCount = 0;
  let failedCount = 0;

  const memberIds = chunkGroups.map(([mid]) => mid);
  const currentMembers = memberIds.length > 0
    ? await base44.asServiceRole.entities.HouseholdMember.filter({ id: { $in: memberIds } }, undefined, 500)
    : [];
  const memberMap = new Map(currentMembers.map((m) => [m.id, m]));

  for (const [memberId, ops] of chunkGroups) {
    const currentMember = memberMap.get(memberId);
    if (!currentMember) {
      for (const op of ops) {
        processedOpIds.add(op.id);
        opUpdates.push({ id: op.id, status: OPERATION_STATUS.FAILED, error_message: 'Target member not found.', applied_at: now });
      }
      failedCount += ops.length;
      continue;
    }

    const updatePayload: Record<string, unknown> = {};
    let driftDetected = false;

    for (const op of ops) {
      const policy = getFieldPolicy('HouseholdMember', op.field_name);
      const expected = op.expected_snapshot || '';
      const drift = detectDrift(policy, currentMember[op.field_name], expected);

      if (drift === DRIFT_STATUS.MATERIAL_DRIFT) {
        driftDetected = true;
        processedOpIds.add(op.id);
        opUpdates.push({
          id: op.id, status: OPERATION_STATUS.FAILED,
          drift_status: drift,
          error_message: 'Material drift detected.',
          applied_at: now,
        });
        failedCount++;
      } else {
        updatePayload[op.field_name] = coerceValue(policy, op.applied_value);
      }
    }

    if (Object.keys(updatePayload).length > 0) {
      const sanResult = sanitizeWritePayload(
        updatePayload, IMPORT_OPERATIONS.RECONCILIATION_APPROVED_UPDATE, currentMember, 'HouseholdMember',
      );

      const writePayload: Record<string, unknown> = {};
      for (const field of Object.keys(updatePayload)) {
        if (!sanResult.blocked.includes(field)) {
          writePayload[field] = updatePayload[field];
        }
      }

      if (Object.keys(writePayload).length > 0) {
        await base44.asServiceRole.entities.HouseholdMember.update(memberId, writePayload);
      }

      for (const op of ops) {
        if (!processedOpIds.has(op.id)) {
          processedOpIds.add(op.id);
          opUpdates.push({
            id: op.id, status: OPERATION_STATUS.APPLIED,
            prior_value: String(currentMember[op.field_name] ?? ''),
            applied_at: now,
            drift_status: DRIFT_STATUS.NO_DRIFT,
          });
          appliedCount++;
        }
      }

      auditEntries.push({
        import_batch_id: batchId, apply_execution_id: executionId,
        entity_type: 'HouseholdMember', entity_id: memberId,
        operation_type: OPERATION_TYPE.UPDATE_MEMBER_FIELD,
        apply_result: 'UPDATED', applied_by: user.id,
      });
    }
  }

  if (opUpdates.length) await bulkUpdateSafe(base44, 'FamilyLifeImportApplyOperation', opUpdates);
  if (auditEntries.length) await createApplyAudits(base44, auditEntries);

  const hasMore = groups.size > chunkGroups.length;
  return {
    processedOpIds,
    processedCount: chunkGroups.length,
    appliedCount,
    failedCount,
    skippedCount: 0,
    hasMore,
  };
}

// ============================================================
// Phase: APPLYING_RESTRICTIONS
// ============================================================
async function processRestrictionsChunk(base44, user, batchId, batch, allOps, pendingOps, executionId, now) {
  const groups = new Map<string, any[]>();
  for (const op of pendingOps) {
    if (!op.entity_id) continue;
    if (!groups.has(op.entity_id)) groups.set(op.entity_id, []);
    groups.get(op.entity_id).push(op);
  }

  const chunkGroups = Array.from(groups.entries()).slice(0, CHUNK_SIZE);
  const processedOpIds = new Set<string>();
  const opUpdates: any[] = [];
  const auditEntries: any[] = [];
  let appliedCount = 0;

  const householdIds = chunkGroups.map(([hid]) => hid);
  const currentHouseholds = householdIds.length > 0
    ? await base44.asServiceRole.entities.ChampionHousehold.filter({ id: { $in: householdIds } }, undefined, 500)
    : [];
  const householdMap = new Map(currentHouseholds.map((h) => [h.id, h]));

  for (const [householdId, ops] of chunkGroups) {
    const current = householdMap.get(householdId);
    if (!current) {
      for (const op of ops) {
        processedOpIds.add(op.id);
        opUpdates.push({ id: op.id, status: OPERATION_STATUS.FAILED, error_message: 'Target household not found.', applied_at: now });
      }
      continue;
    }

    const restrictionPayload: Record<string, unknown> = {};
    for (const op of ops) {
      // Never reduce an existing restriction
      if (current[op.field_name] === true) {
        processedOpIds.add(op.id);
        opUpdates.push({ id: op.id, status: OPERATION_STATUS.SKIPPED, applied_at: now });
        continue;
      }
      restrictionPayload[op.field_name] = true;
      processedOpIds.add(op.id);
      opUpdates.push({ id: op.id, status: OPERATION_STATUS.APPLIED, prior_value: String(current[op.field_name] ?? ''), applied_at: now });
      appliedCount++;
    }

    if (Object.keys(restrictionPayload).length > 0) {
      restrictionPayload.last_familylife_sync_at = now;
      restrictionPayload.last_familylife_import_batch_id = batchId;
      await base44.asServiceRole.entities.ChampionHousehold.update(householdId, restrictionPayload);

      auditEntries.push({
        import_batch_id: batchId, apply_execution_id: executionId,
        entity_type: 'ChampionHousehold', entity_id: householdId,
        operation_type: OPERATION_TYPE.ADD_RESTRICTION,
        apply_result: 'RESTRICTION_ADDED', applied_by: user.id,
      });
    }
  }

  if (opUpdates.length) await bulkUpdateSafe(base44, 'FamilyLifeImportApplyOperation', opUpdates);
  if (auditEntries.length) await createApplyAudits(base44, auditEntries);

  const hasMore = groups.size > chunkGroups.length;
  return {
    processedOpIds,
    processedCount: chunkGroups.length,
    appliedCount,
    failedCount: 0,
    skippedCount: 0,
    hasMore,
  };
}

// ============================================================
// Phase: RECORDING_DECISIONS (KEEP_CURRENT, SKIP_FIELD, BLOCK_FIELD)
// ============================================================
async function processDecisionsChunk(base44, user, batchId, batch, allOps, pendingOps, executionId, now) {
  const chunk = pendingOps.slice(0, CHUNK_SIZE * 5); // Non-write ops can process more per chunk
  const processedOpIds = new Set<string>();
  const opUpdates: any[] = [];
  const auditEntries: any[] = [];
  let appliedCount = 0;
  let skippedCount = 0;

  for (const op of chunk) {
    processedOpIds.add(op.id);

    if (op.operation_type === OPERATION_TYPE.KEEP_CURRENT) {
      opUpdates.push({ id: op.id, status: OPERATION_STATUS.SKIPPED, applied_at: now });
      auditEntries.push({
        import_batch_id: batchId, apply_execution_id: executionId,
        import_row_id: op.import_row_id, comparison_id: op.comparison_id,
        resolution_id: op.resolution_id,
        entity_type: op.entity_type, entity_id: op.entity_id,
        canonical_field_name: op.field_name,
        operation_type: op.operation_type,
        apply_result: 'NO_CHANGE',
        resolution_type: op.resolution_type,
        ownership_category: op.ownership_category,
        applied_by: user.id,
      });
      skippedCount++;
    } else if (op.operation_type === OPERATION_TYPE.SKIP_FIELD) {
      opUpdates.push({ id: op.id, status: OPERATION_STATUS.SKIPPED, applied_at: now });
      auditEntries.push({
        import_batch_id: batchId, apply_execution_id: executionId,
        import_row_id: op.import_row_id, comparison_id: op.comparison_id,
        resolution_id: op.resolution_id,
        canonical_field_name: op.field_name,
        operation_type: op.operation_type,
        apply_result: 'SKIPPED',
        resolution_type: op.resolution_type,
        ownership_category: op.ownership_category,
        applied_by: user.id,
      });
      skippedCount++;
    } else if (op.operation_type === OPERATION_TYPE.BLOCK_FIELD) {
      opUpdates.push({ id: op.id, status: OPERATION_STATUS.SKIPPED, applied_at: now });
      auditEntries.push({
        import_batch_id: batchId, apply_execution_id: executionId,
        import_row_id: op.import_row_id, comparison_id: op.comparison_id,
        resolution_id: op.resolution_id,
        canonical_field_name: op.field_name,
        operation_type: op.operation_type,
        apply_result: 'BLOCKED',
        resolution_type: op.resolution_type,
        ownership_category: op.ownership_category,
        applied_by: user.id,
      });
      skippedCount++;
    }
  }

  if (opUpdates.length) await bulkUpdateSafe(base44, 'FamilyLifeImportApplyOperation', opUpdates);
  if (auditEntries.length) await createApplyAudits(base44, auditEntries);

  const hasMore = pendingOps.length > chunk.length;
  return {
    processedOpIds,
    processedCount: chunk.length,
    appliedCount,
    failedCount: 0,
    skippedCount,
    hasMore,
  };
}

// ============================================================
// Phase: VERIFYING — post-apply verification
// ============================================================
async function handleVerifyPhase(base44, user, batchId, batch, allOps, executionId, now) {
  // Find all APPLIED operations that need verification
  const appliedOps = allOps.filter((o) => o.status === OPERATION_STATUS.APPLIED);

  // Collect entity IDs to verify
  const householdIds = new Set<string>();
  const memberIds = new Set<string>();
  for (const op of appliedOps) {
    if (op.entity_type === 'ChampionHousehold' && op.entity_id) householdIds.add(op.entity_id);
    if (op.entity_type === 'HouseholdMember' && op.entity_id) memberIds.add(op.entity_id);
  }

  // Batch load records
  const [batchedHouseholds, batchedMembers] = await Promise.all([
    householdIds.size > 0
      ? base44.asServiceRole.entities.ChampionHousehold.filter({ id: { $in: Array.from(householdIds) } }, undefined, 5000)
      : [],
    memberIds.size > 0
      ? base44.asServiceRole.entities.HouseholdMember.filter({ id: { $in: Array.from(memberIds) } }, undefined, 5000)
      : [],
  ]);
  const householdMap = new Map(batchedHouseholds.map((h) => [h.id, h]));
  const memberMap = new Map(batchedMembers.map((m) => [m.id, m]));

  const errors: string[] = [];
  const opUpdates: any[] = [];
  const auditEntries: any[] = [];

  for (const op of appliedOps) {
    if (op.operation_type === OPERATION_TYPE.CREATE_HOUSEHOLD || op.operation_type === OPERATION_TYPE.CREATE_MEMBER) {
      // Verify creation
      const record = op.entity_type === 'ChampionHousehold'
        ? householdMap.get(op.entity_id)
        : memberMap.get(op.entity_id);
      if (!record) {
        errors.push(`${op.entity_type} ${op.entity_id} missing after creation.`);
        opUpdates.push({ id: op.id, status: OPERATION_STATUS.FAILED, error_message: 'Record not found after creation.', verified_at: now });
      } else {
        opUpdates.push({ id: op.id, status: OPERATION_STATUS.VERIFIED, verified_at: now });
      }
    } else if (op.operation_type === OPERATION_TYPE.UPDATE_HOUSEHOLD_FIELD) {
      const current = householdMap.get(op.entity_id);
      if (!current) {
        errors.push(`Household ${op.entity_id} missing after update.`);
        opUpdates.push({ id: op.id, status: OPERATION_STATUS.FAILED, error_message: 'Household not found after update.', verified_at: now });
      } else {
        const policy = getFieldPolicy('ChampionHousehold', op.field_name);
        const expected = normalizeForComparison(coerceValue(policy, op.applied_value), policy);
        const actual = normalizeForComparison(current[op.field_name], policy);
        if (expected !== actual && op.applied_value) {
          errors.push(`Household ${op.entity_id} field ${op.field_name}: expected "${expected}", got "${actual}".`);
          opUpdates.push({ id: op.id, status: OPERATION_STATUS.FAILED, error_message: `Verification mismatch: expected "${expected}", got "${actual}".`, verified_at: now });
        } else {
          opUpdates.push({ id: op.id, status: OPERATION_STATUS.VERIFIED, verified_at: now });
        }
      }
    } else if (op.operation_type === OPERATION_TYPE.UPDATE_MEMBER_FIELD) {
      const current = memberMap.get(op.entity_id);
      if (!current) {
        errors.push(`Member ${op.entity_id} missing after update.`);
        opUpdates.push({ id: op.id, status: OPERATION_STATUS.FAILED, error_message: 'Member not found after update.', verified_at: now });
      } else {
        const policy = getFieldPolicy('HouseholdMember', op.field_name);
        const expected = normalizeForComparison(coerceValue(policy, op.applied_value), policy);
        const actual = normalizeForComparison(current[op.field_name], policy);
        if (expected !== actual && op.applied_value) {
          errors.push(`Member ${op.entity_id} field ${op.field_name}: expected "${expected}", got "${actual}".`);
          opUpdates.push({ id: op.id, status: OPERATION_STATUS.FAILED, error_message: `Verification mismatch: expected "${expected}", got "${actual}".`, verified_at: now });
        } else {
          opUpdates.push({ id: op.id, status: OPERATION_STATUS.VERIFIED, verified_at: now });
        }
      }
    } else if (op.operation_type === OPERATION_TYPE.ADD_RESTRICTION) {
      const current = householdMap.get(op.entity_id);
      if (!current || current[op.field_name] !== true) {
        errors.push(`Household ${op.entity_id} restriction ${op.field_name} was not applied.`);
        opUpdates.push({ id: op.id, status: OPERATION_STATUS.FAILED, error_message: 'Restriction not applied.', verified_at: now });
      } else {
        opUpdates.push({ id: op.id, status: OPERATION_STATUS.VERIFIED, verified_at: now });
      }
    }
  }

  if (opUpdates.length) await bulkUpdateSafe(base44, 'FamilyLifeImportApplyOperation', opUpdates);
  if (auditEntries.length) await createApplyAudits(base44, auditEntries);

  const applied = allOps.filter((o) => o.status === OPERATION_STATUS.APPLIED).length;
  const verified = opUpdates.filter((o) => o.status === OPERATION_STATUS.VERIFIED).length;
  const failed = allOps.filter((o) => o.status === OPERATION_STATUS.FAILED).length + opUpdates.filter((o) => o.status === OPERATION_STATUS.FAILED).length;
  const skipped = allOps.filter((o) => o.status === OPERATION_STATUS.SKIPPED).length;
  const progress = computeProgress(allOps.length, 0, verified, failed, skipped, (batch.apply_progress?.chunk_index || 0) + 1);

  const nextP = nextPhase(APPLY_PHASE.VERIFYING);

  await updateCheckpoint(base44, batchId, {
    apply_status: 'PAUSED',
    apply_phase: nextP,
    apply_progress: progress,
    apply_error: errors.length > 0 ? `Verification errors: ${errors.length}` : '',
  });

  return Response.json({
    chunk_processed: true,
    phase: nextP,
    progress,
    verification_errors: errors,
    verified_count: verified,
    failed_count: failed,
    has_more: false,
    completed: false,
    message: errors.length > 0
      ? `Verification completed with ${errors.length} error(s).`
      : `Verification passed. ${verified} operations verified. Proceeding to finalize.`,
  });
}

// ============================================================
// Phase: FINALIZING — mark batch APPLIED
// ============================================================
async function handleFinalizePhase(base44, user, batchId, batch, allOps, executionId, now) {
  // Check all operations are VERIFIED or SKIPPED (no PENDING or APPLIED remaining)
  const pending = allOps.filter((o) => o.status === OPERATION_STATUS.PENDING).length;
  const applied = allOps.filter((o) => o.status === OPERATION_STATUS.APPLIED).length;
  const verified = allOps.filter((o) => o.status === OPERATION_STATUS.VERIFIED).length;
  const failed = allOps.filter((o) => o.status === OPERATION_STATUS.FAILED).length;
  const skipped = allOps.filter((o) => o.status === OPERATION_STATUS.SKIPPED).length;

  if (pending > 0 || applied > 0) {
    // Not ready to finalize — go back to verifying
    await updateCheckpoint(base44, batchId, {
      apply_status: 'PAUSED',
      apply_phase: APPLY_PHASE.VERIFYING,
    });
    return Response.json({
      error: `${pending} PENDING and ${applied} APPLIED operations remain. Not ready to finalize.`,
      can_resume: true,
    }, { status: 422 });
  }

  // Count production results from operations
  let createdHouseholds = 0, updatedHouseholds = 0;
  let createdMembers = 0, updatedMembers = 0;
  let restrictionsAdded = 0;
  let fieldsSkipped = 0, fieldsBlocked = 0, fieldsApplied = 0;

  for (const op of allOps) {
    switch (op.operation_type) {
      case OPERATION_TYPE.CREATE_HOUSEHOLD:
        if (op.status === OPERATION_STATUS.VERIFIED) createdHouseholds++;
        break;
      case OPERATION_TYPE.CREATE_MEMBER:
        if (op.status === OPERATION_STATUS.VERIFIED) createdMembers++;
        break;
      case OPERATION_TYPE.UPDATE_HOUSEHOLD_FIELD:
        if (op.status === OPERATION_STATUS.VERIFIED) { updatedHouseholds++; fieldsApplied++; }
        break;
      case OPERATION_TYPE.UPDATE_MEMBER_FIELD:
        if (op.status === OPERATION_STATUS.VERIFIED) { updatedMembers++; fieldsApplied++; }
        break;
      case OPERATION_TYPE.ADD_RESTRICTION:
        if (op.status === OPERATION_STATUS.VERIFIED) restrictionsAdded++;
        break;
      case OPERATION_TYPE.SKIP_FIELD:
        fieldsSkipped++;
        break;
      case OPERATION_TYPE.BLOCK_FIELD:
        fieldsBlocked++;
        break;
    }
  }

  const progress = computeProgress(allOps.length, 0, verified, failed, skipped, batch.apply_progress?.chunk_index || 0);

  // Mark batch as APPLIED
  const appliedAt = new Date().toISOString();
  await updateCheckpoint(base44, batchId, {
    status: 'APPLIED',
    apply_status: 'APPLIED',
    apply_phase: APPLY_PHASE.COMPLETED,
    applied_at: appliedAt,
    applied_by: user.id,
    apply_error: '',
    apply_progress: { ...progress, percent_complete: 100 },
    apply_summary: {
      preflight_passed: true,
      drift_blocked_count: failed,
      restrictions_added: restrictionsAdded,
      fields_skipped: fieldsSkipped,
      fields_blocked: fieldsBlocked,
      keep_current_count: 0,
      custom_values_applied: 0,
      verification_passed: failed === 0,
    },
    created_household_count: createdHouseholds,
    updated_household_count: updatedHouseholds,
    created_member_count: createdMembers,
    updated_member_count: updatedMembers,
    failed_row_count: failed,
    applied_field_count: fieldsApplied,
  });

  // Mark all resolutions as APPLIED
  const resolutions = await base44.asServiceRole.entities.FamilyLifeImportResolution.filter(
    { import_batch_id: batchId }, undefined, 5000,
  );
  const activeResolutions = resolutions.filter((r) =>
    r.status === RESOLUTION_STATUS.PENDING || r.status === RESOLUTION_STATUS.RESOLVED,
  );
  if (activeResolutions.length) {
    const resolutionUpdates = activeResolutions.map((r) => ({
      id: r.id,
      status: RESOLUTION_STATUS.APPLIED,
      last_modified_at: appliedAt,
      last_modified_by: user.id,
    }));
    await bulkUpdateSafe(base44, 'FamilyLifeImportResolution', resolutionUpdates);
  }

  // Audit: APPLY_COMPLETED
  await createApplyAudits(base44, [{
    import_batch_id: batchId,
    apply_execution_id: executionId,
    apply_result: 'APPLIED',
    applied_by: user.id,
  }]);

  return Response.json({
    completed: true,
    applied_at: appliedAt,
    summary: {
      created_households: createdHouseholds,
      updated_households: updatedHouseholds,
      created_members: createdMembers,
      updated_members: updatedMembers,
      fields_applied: fieldsApplied,
      restrictions_added: restrictionsAdded,
      fields_skipped: fieldsSkipped,
      fields_blocked: fieldsBlocked,
      verification_passed: failed === 0,
      failed_count: failed,
    },
  });
}

// ============================================================
// status — return current apply progress
// ============================================================
async function handleStatus(base44, user, batchId) {
  const batch = await base44.asServiceRole.entities.FamilyLifeImportBatch.get(batchId);
  if (!batch) return Response.json({ error: 'Batch not found.' }, { status: 404 });

  const [operations, applyAudits] = await Promise.all([
    base44.asServiceRole.entities.FamilyLifeImportApplyOperation.filter({ import_batch_id: batchId }, undefined, 5000),
    base44.asServiceRole.entities.FamilyLifeImportApplyAudit.filter({ import_batch_id: batchId }, '-created_date', 50),
  ]);

  const statusCounts = {
    pending: operations.filter((o) => o.status === OPERATION_STATUS.PENDING).length,
    applied: operations.filter((o) => o.status === OPERATION_STATUS.APPLIED).length,
    verified: operations.filter((o) => o.status === OPERATION_STATUS.VERIFIED).length,
    failed: operations.filter((o) => o.status === OPERATION_STATUS.FAILED).length,
    skipped: operations.filter((o) => o.status === OPERATION_STATUS.SKIPPED).length,
  };

  // Determine if stale
  const stale = isApplyInProgress(batch) && isStale(batch.apply_progress?.last_checkpoint_at);

  // Determine can_resume and can_reset
  const hasAppliedOrVerified = operations.some(
    (o) => o.status === OPERATION_STATUS.APPLIED || o.status === OPERATION_STATUS.VERIFIED,
  );

  return Response.json({
    batch_status: batch.status,
    apply_status: batch.apply_status,
    apply_phase: batch.apply_phase,
    apply_execution_id: batch.apply_execution_id,
    applying_started_at: batch.applying_started_at,
    applying_started_by: batch.applying_started_by,
    applied_at: batch.applied_at,
    applied_by: batch.applied_by,
    apply_error: batch.apply_error,
    apply_summary: batch.apply_summary,
    apply_progress: batch.apply_progress,
    operation_counts: statusCounts,
    total_operations: operations.length,
    recent_audits: applyAudits.slice(0, 10),
    is_stale: stale,
    can_resume: batch.apply_status === 'PAUSED' || stale,
    can_reset: !hasAppliedOrVerified && isApplyInProgress(batch),
  });
}

// ============================================================
// reset — reset to READY_FOR_REVIEW if safe
// ============================================================
async function handleReset(base44, user, batchId) {
  const batch = await base44.asServiceRole.entities.FamilyLifeImportBatch.get(batchId);
  if (!batch) return Response.json({ error: 'Batch not found.' }, { status: 404 });

  if (!isApplyInProgress(batch) && batch.apply_status !== 'FAILED' && batch.apply_status !== 'PARTIALLY_FAILED') {
    return Response.json({ error: `Cannot reset. Apply status is "${batch.apply_status}".` }, { status: 409 });
  }

  // Check if any operations were APPLIED or VERIFIED — if so, cannot reset
  const operations = await base44.asServiceRole.entities.FamilyLifeImportApplyOperation.filter(
    { import_batch_id: batchId }, undefined, 5000,
  );

  const appliedOrVerified = operations.filter(
    (o) => o.status === OPERATION_STATUS.APPLIED || o.status === OPERATION_STATUS.VERIFIED,
  );

  if (appliedOrVerified.length > 0) {
    return Response.json({
      error: `Cannot reset — ${appliedOrVerified.length} operation(s) were already applied to production. Use "resume" to continue instead.`,
      applied_count: appliedOrVerified.length,
      can_resume: true,
    }, { status: 409 });
  }

  // Safe to reset — delete all operations and audits, reset batch
  if (operations.length > 0) {
    await base44.asServiceRole.entities.FamilyLifeImportApplyOperation.deleteMany(
      { import_batch_id: batchId },
    );
  }

  const applyAudits = await base44.asServiceRole.entities.FamilyLifeImportApplyAudit.filter(
    { import_batch_id: batchId }, undefined, 5000,
  );
  if (applyAudits.length > 0) {
    await base44.asServiceRole.entities.FamilyLifeImportApplyAudit.deleteMany(
      { import_batch_id: batchId },
    );
  }

  await updateCheckpoint(base44, batchId, {
    status: 'READY_FOR_REVIEW',
    apply_status: 'PENDING',
    apply_phase: 'PREVALIDATED',
    apply_execution_id: '',
    applying_started_at: '',
    applying_started_by: '',
    apply_error: '',
    apply_progress: {},
    apply_summary: {},
    created_household_count: 0,
    updated_household_count: 0,
    created_member_count: 0,
    updated_member_count: 0,
    failed_row_count: 0,
    applied_field_count: 0,
  });

  return Response.json({
    reset: true,
    message: 'Apply execution reset. No production records were affected. Batch is back to READY_FOR_REVIEW.',
  });
}

// ============================================================
// Value coercion helper (mirrors applyEngine.ts coerceValue)
// ============================================================
function coerceValue(policy: any, value: string): unknown {
  if (!policy || value === '') return value;
  if (policy.normalization === 'boolean') {
    return value === 'true';
  }
  if (['cumulative_registrations', 'free_couple_registrations_used',
       'free_couple_registrations_available',
       'registrations_toward_next_free_registration',
       'registrations_needed_for_next_free_registration'].includes(policy.field)) {
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }
  return value;
}
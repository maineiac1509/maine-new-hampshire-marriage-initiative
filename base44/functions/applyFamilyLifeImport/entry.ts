import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// FamilyLife Import — Production Apply Engine Endpoint
// ============================================================
// Admin-only HTTP entry point for the final production apply
// engine. Executes approved resolutions against production
// ChampionHousehold and HouseholdMember records.
//
// Request body (JSON):
//   {
//     action: 'preflight' | 'apply' | 'status',
//     import_batch_id: string,
//     confirmation_text?: string  // must be 'APPLY' for apply action
//   }
//
// The frontend sends ONLY import_batch_id and optional confirmation.
// The backend independently loads all batch data, resolutions,
// comparisons, and production records. It does NOT trust
// frontend-provided field values, entity IDs, or write instructions.
//
// Flow:
//   READY_TO_APPLY BATCH
//   → PRE-APPLY VALIDATION
//   → DRIFT DETECTION
//   → WRITE-PLAN GENERATION
//   → SANITIZATION
//   → CHECKPOINTED EXECUTION
//   → AUDIT RECORDING
//   → POST-APPLY VERIFICATION
//   → APPLIED
// ============================================================

import {
  preflightValidate, generateWritePlan, detectDrift,
  sanitizeWritePayload, validateSanitization,
  buildOperationKey,
  DRIFT_STATUS, OPERATION_TYPE, OPERATION_STATUS, APPLY_RESULT,
  type WritePlan, type WriteOperation,
} from '../../shared/import/applyEngine.ts';
import {
  RESOLUTION_TYPE, RESOLUTION_STATUS,
  CURRENT_GOVERNANCE_VERSION, CURRENT_MAPPING_VERSION,
  isRestrictionRemovalAttempt,
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
      case 'apply':
        return await handleApply(base44, user, import_batch_id, confirmation_text);
      case 'status':
        return await handleStatus(base44, user, import_batch_id);
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
async function createApplyAudit(base44, entry) {
  await base44.asServiceRole.entities.FamilyLifeImportApplyAudit.create({
    applied_at: new Date().toISOString(),
    ...entry,
  });
}

// ============================================================
// preflight — validate readiness and return counts for confirmation
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
// apply — execute the full apply pipeline
// ============================================================
async function handleApply(base44, user, batchId, confirmationText) {
  // Require explicit confirmation
  if (confirmationText !== 'APPLY') {
    return Response.json({ error: 'Confirmation text "APPLY" is required to execute the apply.' }, { status: 400 });
  }

  // 1. Load batch
  const batch = await base44.asServiceRole.entities.FamilyLifeImportBatch.get(batchId);
  if (!batch) return Response.json({ error: 'Batch not found.' }, { status: 404 });

  // 2. Check batch is not already applied
  if (batch.status === 'APPLIED' || batch.apply_status === 'APPLIED') {
    return Response.json({ error: 'This batch has already been applied.', applied_at: batch.applied_at }, { status: 409 });
  }

  // 3. Check for concurrent apply (lock check)
  if (batch.status === 'APPLYING' || batch.apply_status === 'APPLYING') {
    return Response.json({
      error: 'Another apply execution is in progress for this batch.',
      apply_execution_id: batch.apply_execution_id,
      applying_started_at: batch.applying_started_at,
      applying_started_by: batch.applying_started_by,
    }, { status: 409 });
  }

  // 4. Check status is READY_TO_APPLY
  if (batch.status !== 'READY_TO_APPLY') {
    return Response.json({ error: `Batch status is "${batch.status}", not READY_TO_APPLY.` }, { status: 409 });
  }

  // 5. Acquire apply lock
  const executionId = `apply-${batchId}-${Date.now()}`;
  const now = new Date().toISOString();
  await base44.asServiceRole.entities.FamilyLifeImportBatch.update(batchId, {
    status: 'APPLYING',
    apply_status: 'APPLYING',
    applying_started_at: now,
    applying_started_by: user.id,
    apply_execution_id: executionId,
    apply_error: '',
  });

  // Audit: APPLY_STARTED
  await createApplyAudit(base44, {
    import_batch_id: batchId,
    apply_execution_id: executionId,
    apply_result: 'VERIFIED',
    applied_by: user.id,
  });

  // Wrap the rest in a try/catch to handle failures and release the lock.
  // The catch block is defensive: its own DB calls are wrapped so a
  // secondary failure (e.g. timeout during lock release) cannot mask
  // the original error.
  try {
    return await executeApply(base44, user, batchId, batch, executionId);
  } catch (error) {
    const errorMsg = error?.message || 'Apply execution failed.';
    // Record failure and release lock back to READY_FOR_REVIEW
    try {
      await base44.asServiceRole.entities.FamilyLifeImportBatch.update(batchId, {
        status: 'READY_FOR_REVIEW',
        apply_status: 'FAILED',
        apply_error: errorMsg,
      });
    } catch (_) {
      // If the lock release itself fails, the batch remains APPLYING.
      // The error is still reported to the caller below.
    }
    try {
      await createApplyAudit(base44, {
        import_batch_id: batchId,
        apply_execution_id: executionId,
        apply_result: 'FAILED',
        error_message: errorMsg,
        applied_by: user.id,
      });
    } catch (_) { /* audit is best-effort during failure */ }
    return Response.json({
      error: errorMsg,
      apply_execution_id: executionId,
      needs_review: true,
      retry_safe: false,
    }, { status: 500 });
  }
}

// ============================================================
// executeApply — the main pipeline
// ============================================================
async function executeApply(base44, user, batchId, batch, executionId) {
  const now = new Date().toISOString();

  // Load all batch data
  const { comparisons, resolutions, rows, issues } = await loadBatchData(base44, batchId);

  // --- PHASE 1: PREFLIGHT VALIDATION ---
  const preflight = preflightValidate(batch, rows, comparisons, resolutions, issues);
  if (!preflight.passed) {
    await createApplyAudit(base44, {
      import_batch_id: batchId,
      apply_execution_id: executionId,
      apply_result: 'FAILED',
      error_message: `Preflight validation failed: ${preflight.errors.join('; ')}`,
      applied_by: user.id,
    });
    // Release lock — determine if readiness should be revoked
    const staleErrors = preflight.errors.some((e) =>
      e.includes('Governance version') || e.includes('Mapping version'),
    );
    if (staleErrors) {
      await base44.asServiceRole.entities.FamilyLifeImportBatch.update(batchId, {
        status: 'READY_FOR_REVIEW',
        apply_status: 'FAILED',
        readiness_status: preflight.errors.some((e) => e.includes('Governance')) ? 'STALE_GOVERNANCE' : 'STALE_MAPPING',
        readiness_reason: preflight.errors.join('; '),
        apply_error: `Preflight validation failed: ${preflight.errors.join('; ')}`,
      });
    } else {
      await base44.asServiceRole.entities.FamilyLifeImportBatch.update(batchId, {
        status: 'READY_TO_APPLY',
        apply_status: 'FAILED',
        apply_error: `Preflight validation failed: ${preflight.errors.join('; ')}`,
      });
    }
    return Response.json({
      error: 'Preflight validation failed.',
      errors: preflight.errors,
      warnings: preflight.warnings,
      apply_execution_id: executionId,
      needs_review: staleErrors,
      retry_safe: !staleErrors,
    }, { status: 422 });
  }

  // Audit: PREVALIDATION_PASSED
  await createApplyAudit(base44, {
    import_batch_id: batchId,
    apply_execution_id: executionId,
    apply_result: 'VERIFIED',
    applied_by: user.id,
  });

  // --- PHASE 2: GENERATE WRITE PLAN ---
  const plan = generateWritePlan(batch, rows, comparisons, resolutions);

  // --- PHASE 3: CREATE/RESOLVE APPLY OPERATIONS (idempotent) ---
  // Check for existing operations from a prior interrupted apply
  const existingOps = await base44.asServiceRole.entities.FamilyLifeImportApplyOperation.filter(
    { import_batch_id: batchId }, undefined, 5000,
  );
  const existingOpKeys = new Set(existingOps.map((o) => o.operation_key));
  const opByOperationKey = new Map(existingOps.map((o) => [o.operation_key, o]));

  // Create new operations that don't exist yet
  const newOps = plan.operations
    .filter((op) => !existingOpKeys.has(op.operation_key))
    .map((op) => ({
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

  // Reload all operations (existing + new) for execution
  const allOps = await base44.asServiceRole.entities.FamilyLifeImportApplyOperation.filter(
    { import_batch_id: batchId }, undefined, 5000,
  );
  const opMap = new Map(allOps.map((o) => [o.operation_key, o]));

  // --- PHASE 3.5: PRE-WRITE DRIFT CHECK ---
  // Verify NO existing record has drifted before ANY production writes.
  // This prevents partial-apply orphaning: if drift is found here, zero
  // records have been created or updated.
  //
  // BATCH LOAD: Load all production records in two filter calls instead
  // of N sequential get calls. The loaded records are stored in maps and
  // reused throughout the update phase to avoid redundant database reads.
  const preWriteSnapshots = new Map<string, string>();
  for (const op of plan.operations) {
    if (op.entity_id) {
      preWriteSnapshots.set(`${op.entity_type}:${op.entity_id}:${op.field_name}`, op.expected_snapshot || '');
    }
  }

  const householdIdsToCheck = Array.from(plan.householdUpdates.keys());
  const memberIdsToCheck = Array.from(plan.memberUpdates.keys());

  const [batchedHouseholds, batchedMembers] = await Promise.all([
    householdIdsToCheck.length > 0
      ? base44.asServiceRole.entities.ChampionHousehold.filter({ id: { $in: householdIdsToCheck } }, undefined, 5000)
      : [],
    memberIdsToCheck.length > 0
      ? base44.asServiceRole.entities.HouseholdMember.filter({ id: { $in: memberIdsToCheck } }, undefined, 5000)
      : [],
  ]);

  // Store for reuse in the update phase (eliminates ~250 sequential get calls)
  const preloadedHouseholds = new Map<string, any>(batchedHouseholds.map((h) => [h.id, h]));
  const preloadedMembers = new Map<string, any>(batchedMembers.map((m) => [m.id, m]));

  for (const [householdId, fieldUpdates] of plan.householdUpdates) {
    const currentHousehold = preloadedHouseholds.get(householdId);
    if (!currentHousehold) {
      await base44.asServiceRole.entities.FamilyLifeImportBatch.update(batchId, {
        status: 'READY_FOR_REVIEW', apply_status: 'FAILED',
        apply_error: `Target household ${householdId} not found during pre-write drift check.`,
      });
      return Response.json({
        error: `Target household ${householdId} was deleted since reconciliation.`,
        needs_review: true, retry_safe: false,
      }, { status: 409 });
    }
    const driftFields: string[] = [];
    for (const [fieldName] of Object.entries(fieldUpdates)) {
      const policy = getFieldPolicy('ChampionHousehold', fieldName);
      const expected = preWriteSnapshots.get(`ChampionHousehold:${householdId}:${fieldName}`) || '';
      if (detectDrift(policy, currentHousehold[fieldName], expected) === DRIFT_STATUS.MATERIAL_DRIFT) {
        driftFields.push(fieldName);
      }
    }
    if (driftFields.length > 0) {
      await base44.asServiceRole.entities.FamilyLifeImportBatch.update(batchId, {
        status: 'READY_FOR_REVIEW', apply_status: 'FAILED',
        apply_error: `Material drift on household ${householdId}: ${driftFields.join(', ')}`,
        readiness_status: 'NOT_READY',
        readiness_reason: `Production data changed on fields: ${driftFields.join(', ')}`,
      });
      return Response.json({
        error: 'Production data changed since reconciliation.',
        drift_fields: driftFields, household_id: householdId,
        needs_review: true, retry_safe: false,
      }, { status: 409 });
    }
  }

  for (const [memberId, fieldUpdates] of plan.memberUpdates) {
    const currentMember = preloadedMembers.get(memberId);
    if (!currentMember) {
      await base44.asServiceRole.entities.FamilyLifeImportBatch.update(batchId, {
        status: 'READY_FOR_REVIEW', apply_status: 'FAILED',
        apply_error: `Target member ${memberId} not found during pre-write drift check.`,
      });
      return Response.json({
        error: `Target member ${memberId} was deleted since reconciliation.`,
        needs_review: true, retry_safe: false,
      }, { status: 409 });
    }
    const driftFields: string[] = [];
    for (const [fieldName] of Object.entries(fieldUpdates)) {
      const policy = getFieldPolicy('HouseholdMember', fieldName);
      const expected = preWriteSnapshots.get(`HouseholdMember:${memberId}:${fieldName}`) || '';
      if (detectDrift(policy, currentMember[fieldName], expected) === DRIFT_STATUS.MATERIAL_DRIFT) {
        driftFields.push(fieldName);
      }
    }
    if (driftFields.length > 0) {
      await base44.asServiceRole.entities.FamilyLifeImportBatch.update(batchId, {
        status: 'READY_FOR_REVIEW', apply_status: 'FAILED',
        apply_error: `Material drift on member ${memberId}: ${driftFields.join(', ')}`,
        readiness_status: 'NOT_READY',
        readiness_reason: `Production data changed on member fields: ${driftFields.join(', ')}`,
      });
      return Response.json({
        error: 'Production data changed since reconciliation.',
        drift_fields: driftFields, member_id: memberId,
        needs_review: true, retry_safe: false,
      }, { status: 409 });
    }
  }

  // --- PHASE 4: EXECUTE WRITE PLAN ---
  let appliedFieldCount = 0;
  let createdHouseholdCount = 0;
  let updatedHouseholdCount = 0;
  let createdMemberCount = 0;
  let updatedMemberCount = 0;
  let restrictionsAdded = 0;
  let fieldsSkipped = 0;
  let fieldsBlocked = 0;
  let failedCount = 0;
  let driftBlockedCount = 0;
  let customValuesApplied = 0;

  // Track created household IDs for linking members
  const createdHouseholdIds = new Map(); // rowId → householdId

  // 4a. Execute NEW HOUSEHOLD CREATIONS first
  for (const [rowId, creation] of plan.newHouseholdCreations) {
    // Check if this household was already created in a prior interrupted run
    const existingCreationOps = allOps.filter((o) =>
      o.temporary_entity_key === rowId && o.operation_type === OPERATION_TYPE.CREATE_HOUSEHOLD,
    );
    const alreadyCreated = existingCreationOps.some((o) => o.status === OPERATION_STATUS.APPLIED || o.status === OPERATION_STATUS.VERIFIED);

    let householdId;

    if (alreadyCreated) {
      // Find the existing created household ID from the operation
      const appliedOp = existingCreationOps.find((o) => o.status === OPERATION_STATUS.APPLIED || o.status === OPERATION_STATUS.VERIFIED);
      householdId = appliedOp.entity_id;
      createdHouseholdIds.set(rowId, householdId);
      createdHouseholdCount++;
    } else {
      // Recheck for duplicates before creation
      const flExtId = creation.fields.familylife_external_id;
      const email = creation.fields.email;

      // Check FL external ID uniqueness
      if (flExtId) {
        const existing = await base44.asServiceRole.entities.ChampionHousehold.filter(
          { familylife_external_id: flExtId }, undefined, 1,
        );
        if (existing && existing.length > 0) {
          // A matching production record now exists — stop and require review
          await base44.asServiceRole.entities.FamilyLifeImportBatch.update(batchId, {
            status: 'READY_FOR_REVIEW',
            apply_status: 'FAILED',
            apply_error: `Duplicate FamilyLife external ID "${flExtId}" detected before creation of row ${rowId}.`,
          });
          return Response.json({
            error: `A production record with FamilyLife external ID "${flExtId}" now exists. The batch requires re-review.`,
            needs_review: true,
            retry_safe: false,
          }, { status: 409 });
        }
      }

      // Check email uniqueness (if email is provided)
      if (email) {
        const existingByEmail = await base44.asServiceRole.entities.ChampionHousehold.filter(
          { email: String(email).toLowerCase() }, undefined, 1,
        );
        if (existingByEmail && existingByEmail.length > 0) {
          await base44.asServiceRole.entities.FamilyLifeImportBatch.update(batchId, {
            status: 'READY_FOR_REVIEW',
            apply_status: 'FAILED',
            apply_error: `Duplicate email detected before creation of row ${rowId}.`,
          });
          return Response.json({
            error: `A production record with email "${email}" now exists. The batch requires re-review.`,
            needs_review: true,
            retry_safe: false,
          }, { status: 409 });
        }
      }

      // Sanitize through NEW_RECORD_CREATE
      const sanResult = sanitizeWritePayload(creation.fields, IMPORT_OPERATIONS.NEW_RECORD_CREATE, null, 'ChampionHousehold');
      if (sanResult.blocked.length > 0 || sanResult.conflicts.length > 0) {
        // Sanitizer rejected fields the plan expected to write
        const plannedFields = Object.keys(creation.fields);
        const validation = validateSanitization(plannedFields, sanResult.sanitized, sanResult.blocked);
        if (!validation.valid) {
          await base44.asServiceRole.entities.FamilyLifeImportBatch.update(batchId, {
            status: 'READY_FOR_REVIEW',
            apply_status: 'FAILED',
            apply_error: `Sanitizer rejected fields for new household: ${validation.discrepancies.join('; ')}`,
          });
          return Response.json({
            error: 'Sanitizer rejected fields during new household creation.',
            discrepancies: validation.discrepancies,
            needs_review: true,
            retry_safe: false,
          }, { status: 422 });
        }
      }

      // Create the household — use original resolved values for sanitizer-allowed fields
      // (the sanitizer validates which fields are permitted, but the admin's resolved
      // value is authoritative — normalization is for comparison, not for display)
      const createPayload: Record<string, unknown> = {};
      for (const field of Object.keys(sanResult.sanitized)) {
        createPayload[field] = creation.fields[field];
      }
      // Include sync metadata in the create payload to avoid a separate update call
      createPayload.last_familylife_sync_at = now;
      createPayload.last_familylife_import_batch_id = batchId;
      const created = await base44.asServiceRole.entities.ChampionHousehold.create(createPayload);
      householdId = created.id;
      createdHouseholdIds.set(rowId, householdId);
      createdHouseholdCount++;

      // Audit: RECORD_CREATED
      await createApplyAudit(base44, {
        import_batch_id: batchId,
        apply_execution_id: executionId,
        import_row_id: rowId,
        entity_type: 'ChampionHousehold',
        entity_id: householdId,
        operation_type: OPERATION_TYPE.CREATE_HOUSEHOLD,
        apply_result: 'CREATED',
        applied_by: user.id,
      });

      // Mark operations as APPLIED (batched)
      if (existingCreationOps.length) {
        const creationOpUpdates = existingCreationOps.map((op) => ({
          id: op.id,
          status: OPERATION_STATUS.APPLIED,
          entity_id: householdId,
          applied_value: op.applied_value || '',
          applied_at: now,
          drift_status: 'NO_DRIFT',
        }));
        await bulkUpdateSafe(base44, 'FamilyLifeImportApplyOperation', creationOpUpdates);
      }
    }

    appliedFieldCount += existingCreationOps.length;
  }

  // 4b. Execute NEW MEMBER CREATIONS (linked to new or existing households)
  for (const [rowId, creation] of plan.newMemberCreations) {
    const existingCreationOps = allOps.filter((o) =>
      o.temporary_entity_key === rowId && o.operation_type === OPERATION_TYPE.CREATE_MEMBER,
    );
    const alreadyCreated = existingCreationOps.some((o) => o.status === OPERATION_STATUS.APPLIED || o.status === OPERATION_STATUS.VERIFIED);

    if (alreadyCreated) {
      createdMemberCount++;
      appliedFieldCount += existingCreationOps.length;
      continue;
    }

    // Determine target household
    let targetHouseholdId = creation.householdId || createdHouseholdIds.get(rowId);
    if (!targetHouseholdId) {
      // This member belongs to a new household — find it via the row's household group
      // Try to find a created household from the same household group
      const row = rows.find((r) => r.id === rowId);
      if (row?.household_group_key) {
        for (const [hhRowId, hhId] of createdHouseholdIds) {
          const hhRow = rows.find((r) => r.id === hhRowId);
          if (hhRow?.household_group_key === row.household_group_key) {
            targetHouseholdId = hhId;
            break;
          }
        }
      }
    }

    if (!targetHouseholdId) {
      failedCount++;
      for (const op of existingCreationOps) {
        await base44.asServiceRole.entities.FamilyLifeImportApplyOperation.update(op.id, {
          status: OPERATION_STATUS.FAILED,
          error_message: 'No target household ID found for member creation.',
          applied_at: now,
        });
      }
      continue;
    }

    // Verify target household still exists
    const targetHousehold = await base44.asServiceRole.entities.ChampionHousehold.get(targetHouseholdId);
    if (!targetHousehold) {
      await base44.asServiceRole.entities.FamilyLifeImportBatch.update(batchId, {
        status: 'READY_FOR_REVIEW',
        apply_status: 'FAILED',
        apply_error: `Target household ${targetHouseholdId} not found for new member creation (row ${rowId}).`,
      });
      return Response.json({
        error: 'Target household was deleted before member creation.',
        needs_review: true,
        retry_safe: false,
      }, { status: 409 });
    }

    // Check for duplicate member (same email in same household)
    const memberEmail = creation.fields.email;
    if (memberEmail) {
      const existingMembers = await base44.asServiceRole.entities.HouseholdMember.filter(
        { household_id: targetHouseholdId }, undefined, 500,
      );
      const dup = existingMembers.find((m) =>
        m.email && m.email.toLowerCase() === String(memberEmail).toLowerCase(),
      );
      if (dup) {
        await base44.asServiceRole.entities.FamilyLifeImportBatch.update(batchId, {
          status: 'READY_FOR_REVIEW',
          apply_status: 'FAILED',
          apply_error: `Duplicate member email in household ${targetHouseholdId} detected before creation.`,
        });
        return Response.json({
          error: 'A member with this email already exists in the target household.',
          needs_review: true,
          retry_safe: false,
        }, { status: 409 });
      }
    }

    // Sanitize member fields — use original values for sanitizer-allowed fields
    const memberPayload = { ...creation.fields, household_id: targetHouseholdId };
    const sanResult = sanitizeWritePayload(
      memberPayload,
      IMPORT_OPERATIONS.NEW_RECORD_CREATE,
      null,
      'HouseholdMember',
    );

    // Create the member with original resolved values
    const memberCreatePayload: Record<string, unknown> = { household_id: targetHouseholdId };
    for (const field of Object.keys(sanResult.sanitized)) {
      if (field !== 'household_id') {
        memberCreatePayload[field] = creation.fields[field];
      }
    }
    const createdMember = await base44.asServiceRole.entities.HouseholdMember.create(memberCreatePayload);
    createdMemberCount++;

    // Audit: RECORD_CREATED
    await createApplyAudit(base44, {
      import_batch_id: batchId,
      apply_execution_id: executionId,
      import_row_id: rowId,
      entity_type: 'HouseholdMember',
      entity_id: createdMember.id,
      operation_type: OPERATION_TYPE.CREATE_MEMBER,
      apply_result: 'CREATED',
      applied_by: user.id,
    });

    // Mark operations as APPLIED (batched)
    if (existingCreationOps.length) {
      const memberCreationUpdates = existingCreationOps.map((op) => ({
        id: op.id,
        status: OPERATION_STATUS.APPLIED,
        entity_id: createdMember.id,
        applied_at: now,
        drift_status: 'NO_DRIFT',
      }));
      await bulkUpdateSafe(base44, 'FamilyLifeImportApplyOperation', memberCreationUpdates);
    }
    appliedFieldCount += existingCreationOps.length;
  }

  // 4c. Execute EXISTING HOUSEHOLD UPDATES (grouped by household)
  // Build expected-snapshot lookup from plan operations (entityId+field → snapshot)
  const householdSnapshots = new Map<string, string>();
  for (const op of plan.operations) {
    if (op.entity_type === 'ChampionHousehold' && op.entity_id) {
      householdSnapshots.set(`${op.entity_id}:${op.field_name}`, op.expected_snapshot || '');
    }
  }

  for (const [householdId, fieldUpdates] of plan.householdUpdates) {
    // Reuse the preloaded record from the pre-write drift check
    const currentHousehold = preloadedHouseholds.get(householdId);

    // TARGET_RECORD_MISSING check
    if (!currentHousehold) {
      await base44.asServiceRole.entities.FamilyLifeImportBatch.update(batchId, {
        status: 'READY_FOR_REVIEW',
        apply_status: 'FAILED',
        apply_error: `Target household ${householdId} not found during apply.`,
      });
      return Response.json({
        error: `Target household ${householdId} was deleted since reconciliation.`,
        needs_review: true,
        retry_safe: false,
      }, { status: 409 });
    }

    // Drift detection per field
    const sanitizedPayload: Record<string, unknown> = {};
    let materialDrift = false;
    let driftFields: string[] = [];

    for (const [fieldName, resolvedValue] of Object.entries(fieldUpdates)) {
      const policy = getFieldPolicy('ChampionHousehold', fieldName);
      const expectedSnapshot = householdSnapshots.get(`${householdId}:${fieldName}`) || '';
      const drift = detectDrift(policy, currentHousehold[fieldName], expectedSnapshot);

      if (drift === DRIFT_STATUS.MATERIAL_DRIFT) {
        materialDrift = true;
        driftFields.push(fieldName);
        driftBlockedCount++;

        // Record drift audit
        const cmp = comparisons.find((c) => c.entity_id === householdId && c.canonical_field_name === fieldName);
        const res = resolutions.find((r) => r.field_comparison_id === cmp?.id);
        await createApplyAudit(base44, {
          import_batch_id: batchId,
          apply_execution_id: executionId,
          import_row_id: cmp?.import_row_id || '',
          comparison_id: cmp?.id || '',
          resolution_id: res?.id || '',
          entity_type: 'ChampionHousehold',
          entity_id: householdId,
          canonical_field_name: fieldName,
          operation_type: OPERATION_TYPE.UPDATE_HOUSEHOLD_FIELD,
          apply_result: 'DRIFT_BLOCKED',
          drift_status: drift,
          applied_by: user.id,
        });

        // Mark operation as FAILED
        const ops = allOps.filter((o) => o.entity_id === householdId && o.field_name === fieldName);
        for (const op of ops) {
          await base44.asServiceRole.entities.FamilyLifeImportApplyOperation.update(op.id, {
            status: OPERATION_STATUS.FAILED,
            drift_status: drift,
            error_message: 'Material drift detected — field changed since reconciliation.',
            applied_at: now,
          });
        }
      } else if (drift === DRIFT_STATUS.NORMALIZATION_ONLY_DRIFT) {
        // Normalization-only drift — continue if normalized value is unchanged
        // Record in audit but proceed
        sanitizedPayload[fieldName] = resolvedValue;
      } else {
        sanitizedPayload[fieldName] = resolvedValue;
      }
    }

    if (materialDrift) {
      // Stop the batch — material drift requires re-review
      await base44.asServiceRole.entities.FamilyLifeImportBatch.update(batchId, {
        status: 'READY_FOR_REVIEW',
        apply_status: 'FAILED',
        apply_error: `Material drift detected on household ${householdId} fields: ${driftFields.join(', ')}.`,
        readiness_status: 'NOT_READY',
        readiness_reason: `Production data changed since reconciliation on fields: ${driftFields.join(', ')}.`,
      });
      return Response.json({
        error: 'Production data changed since reconciliation.',
        drift_fields: driftFields,
        household_id: householdId,
        needs_review: true,
        retry_safe: false,
      }, { status: 409 });
    }

    // Add sync metadata
    sanitizedPayload.last_familylife_sync_at = now;
    sanitizedPayload.last_familylife_import_batch_id = batchId;

    // Sanitize through RECONCILIATION_APPROVED_UPDATE
    const sanResult = sanitizeWritePayload(
      sanitizedPayload,
      IMPORT_OPERATIONS.RECONCILIATION_APPROVED_UPDATE,
      currentHousehold,
      'ChampionHousehold',
    );

    // Validate sanitizer didn't block expected fields
    const plannedFields = Object.keys(sanitizedPayload).filter((f) =>
      f !== 'last_familylife_sync_at' && f !== 'last_familylife_import_batch_id',
    );
    const validation = validateSanitization(plannedFields, sanResult.sanitized, sanResult.blocked);
    if (!validation.valid) {
      await base44.asServiceRole.entities.FamilyLifeImportBatch.update(batchId, {
        status: 'READY_FOR_REVIEW',
        apply_status: 'FAILED',
        apply_error: `Sanitizer rejected fields: ${validation.discrepancies.join('; ')}`,
      });
      return Response.json({
        error: 'Sanitizer rejected fields during household update.',
        discrepancies: validation.discrepancies,
        needs_review: true,
        retry_safe: false,
      }, { status: 422 });
    }

    // Apply the update — write the admin-resolved values (not sanitizer-normalized)
    // The sanitizer validated which fields are allowed; the resolved value is authoritative.
    if (Object.keys(sanitizedPayload).length > 0) {
      await base44.asServiceRole.entities.ChampionHousehold.update(householdId, sanitizedPayload);
      updatedHouseholdCount++;

      // Audit: RECORD_UPDATED
      await createApplyAudit(base44, {
        import_batch_id: batchId,
        apply_execution_id: executionId,
        entity_type: 'ChampionHousehold',
        entity_id: householdId,
        operation_type: OPERATION_TYPE.UPDATE_HOUSEHOLD_FIELD,
        apply_result: 'UPDATED',
        applied_by: user.id,
      });
    }

    // Mark operations as APPLIED (batched)
    const householdOpUpdates: Record<string, unknown>[] = [];
    for (const [fieldName] of Object.entries(fieldUpdates)) {
      const ops = allOps.filter((o) => o.entity_id === householdId && o.field_name === fieldName);
      for (const op of ops) {
        householdOpUpdates.push({
          id: op.id,
          status: OPERATION_STATUS.APPLIED,
          prior_value: String(currentHousehold[fieldName] ?? ''),
          applied_at: now,
          drift_status: DRIFT_STATUS.NO_DRIFT,
        });
        appliedFieldCount++;
        if (op.resolution_type === RESOLUTION_TYPE.USE_CUSTOM_VALUE) customValuesApplied++;
      }
    }
    if (householdOpUpdates.length) {
      await bulkUpdateSafe(base44, 'FamilyLifeImportApplyOperation', householdOpUpdates);
    }
  }

  // 4d. Execute EXISTING MEMBER UPDATES (grouped by member)
  // Build expected-snapshot lookup from plan operations (entityId+field → snapshot)
  const memberSnapshots = new Map<string, string>();
  for (const op of plan.operations) {
    if (op.entity_type === 'HouseholdMember' && op.entity_id) {
      memberSnapshots.set(`${op.entity_id}:${op.field_name}`, op.expected_snapshot || '');
    }
  }

  for (const [memberId, fieldUpdates] of plan.memberUpdates) {
    // Reuse the preloaded record from the pre-write drift check
    const currentMember = preloadedMembers.get(memberId);

    if (!currentMember) {
      await base44.asServiceRole.entities.FamilyLifeImportBatch.update(batchId, {
        status: 'READY_FOR_REVIEW',
        apply_status: 'FAILED',
        apply_error: `Target member ${memberId} not found during apply.`,
      });
      return Response.json({
        error: `Target member ${memberId} was deleted since reconciliation.`,
        needs_review: true,
        retry_safe: false,
      }, { status: 409 });
    }

    const sanitizedPayload: Record<string, unknown> = {};
    let materialDrift = false;
    let driftFields: string[] = [];

    for (const [fieldName, resolvedValue] of Object.entries(fieldUpdates)) {
      const policy = getFieldPolicy('HouseholdMember', fieldName);
      const expectedSnapshot = memberSnapshots.get(`${memberId}:${fieldName}`) || '';
      const drift = detectDrift(policy, currentMember[fieldName], expectedSnapshot);

      if (drift === DRIFT_STATUS.MATERIAL_DRIFT) {
        materialDrift = true;
        driftFields.push(fieldName);
        driftBlockedCount++;
        continue;
      }
      sanitizedPayload[fieldName] = resolvedValue;
    }

    if (materialDrift) {
      await base44.asServiceRole.entities.FamilyLifeImportBatch.update(batchId, {
        status: 'READY_FOR_REVIEW',
        apply_status: 'FAILED',
        apply_error: `Material drift detected on member ${memberId} fields: ${driftFields.join(', ')}.`,
        readiness_status: 'NOT_READY',
        readiness_reason: `Production data changed since reconciliation on member fields: ${driftFields.join(', ')}.`,
      });
      return Response.json({
        error: 'Production data changed since reconciliation.',
        drift_fields: driftFields,
        member_id: memberId,
        needs_review: true,
        retry_safe: false,
      }, { status: 409 });
    }

    const sanResult = sanitizeWritePayload(
      sanitizedPayload,
      IMPORT_OPERATIONS.RECONCILIATION_APPROVED_UPDATE,
      currentMember,
      'HouseholdMember',
    );

    if (Object.keys(sanitizedPayload).length > 0) {
      await base44.asServiceRole.entities.HouseholdMember.update(memberId, sanitizedPayload);
      updatedMemberCount++;

      await createApplyAudit(base44, {
        import_batch_id: batchId,
        apply_execution_id: executionId,
        entity_type: 'HouseholdMember',
        entity_id: memberId,
        operation_type: OPERATION_TYPE.UPDATE_MEMBER_FIELD,
        apply_result: 'UPDATED',
        applied_by: user.id,
      });
    }

    // Mark operations as APPLIED (batched)
    const memberOpUpdates: Record<string, unknown>[] = [];
    for (const [fieldName] of Object.entries(fieldUpdates)) {
      const ops = allOps.filter((o) => o.entity_id === memberId && o.field_name === fieldName);
      for (const op of ops) {
        memberOpUpdates.push({
          id: op.id,
          status: OPERATION_STATUS.APPLIED,
          prior_value: String(currentMember[fieldName] ?? ''),
          applied_at: now,
          drift_status: DRIFT_STATUS.NO_DRIFT,
        });
        appliedFieldCount++;
        if (op.resolution_type === RESOLUTION_TYPE.USE_CUSTOM_VALUE) customValuesApplied++;
      }
    }
    if (memberOpUpdates.length) {
      await bulkUpdateSafe(base44, 'FamilyLifeImportApplyOperation', memberOpUpdates);
    }
  }

  // 4e. Execute RESTRICTION ADDITIONS
  for (const [entityId, restrictions] of plan.restrictionUpdates) {
    const current = await base44.asServiceRole.entities.ChampionHousehold.get(entityId);
    if (!current) continue;

    const sanitizedPayload: Record<string, unknown> = {};
    for (const [fieldName, value] of Object.entries(restrictions)) {
      // Never reduce an existing restriction
      if (current[fieldName] === true) continue;
      sanitizedPayload[fieldName] = value;
      restrictionsAdded++;
    }

    if (Object.keys(sanitizedPayload).length > 0) {
      sanitizedPayload.last_familylife_sync_at = now;
      sanitizedPayload.last_familylife_import_batch_id = batchId;

      await base44.asServiceRole.entities.ChampionHousehold.update(entityId, sanitizedPayload);

      await createApplyAudit(base44, {
        import_batch_id: batchId,
        apply_execution_id: executionId,
        entity_type: 'ChampionHousehold',
        entity_id: entityId,
        operation_type: OPERATION_TYPE.ADD_RESTRICTION,
        apply_result: 'RESTRICTION_ADDED',
        applied_by: user.id,
      });
    }

    // Mark restriction operations as APPLIED (batched)
    const restrictionOpUpdates: Record<string, unknown>[] = [];
    for (const [fieldName] of Object.entries(restrictions)) {
      const ops = allOps.filter((o) =>
        o.entity_id === entityId && o.field_name === fieldName && o.operation_type === OPERATION_TYPE.ADD_RESTRICTION,
      );
      for (const op of ops) {
        restrictionOpUpdates.push({
          id: op.id,
          status: OPERATION_STATUS.APPLIED,
          prior_value: String(current[fieldName] ?? ''),
          applied_at: now,
        });
        appliedFieldCount++;
      }
    }
    if (restrictionOpUpdates.length) {
      await bulkUpdateSafe(base44, 'FamilyLifeImportApplyOperation', restrictionOpUpdates);
    }
  }

  // 4f. Record KEEP_CURRENT / SKIP_FIELD / BLOCK_FIELD operations
  for (const op of plan.operations) {
    if (op.operation_type === OPERATION_TYPE.KEEP_CURRENT ||
        op.operation_type === OPERATION_TYPE.SKIP_FIELD ||
        op.operation_type === OPERATION_TYPE.BLOCK_FIELD) {
      const existingOp = opMap.get(op.operation_key);
      if (existingOp && (existingOp.status === OPERATION_STATUS.APPLIED || existingOp.status === OPERATION_STATUS.SKIPPED)) {
        continue; // Idempotent — already recorded
      }

      if (op.operation_type === OPERATION_TYPE.KEEP_CURRENT) {
        // No write needed, but record the decision
        await createApplyAudit(base44, {
          import_batch_id: batchId,
          apply_execution_id: executionId,
          import_row_id: op.import_row_id,
          comparison_id: op.comparison_id,
          resolution_id: op.resolution_id,
          entity_type: op.entity_type,
          entity_id: op.entity_id,
          canonical_field_name: op.field_name,
          operation_type: op.operation_type,
          apply_result: 'NO_CHANGE',
          resolution_type: op.resolution_type,
          ownership_category: op.ownership_category,
          applied_by: user.id,
        });
      } else if (op.operation_type === OPERATION_TYPE.SKIP_FIELD) {
        fieldsSkipped++;
        await createApplyAudit(base44, {
          import_batch_id: batchId,
          apply_execution_id: executionId,
          import_row_id: op.import_row_id,
          comparison_id: op.comparison_id,
          resolution_id: op.resolution_id,
          canonical_field_name: op.field_name,
          operation_type: op.operation_type,
          apply_result: 'SKIPPED',
          resolution_type: op.resolution_type,
          ownership_category: op.ownership_category,
          applied_by: user.id,
        });
      } else if (op.operation_type === OPERATION_TYPE.BLOCK_FIELD) {
        fieldsBlocked++;
        await createApplyAudit(base44, {
          import_batch_id: batchId,
          apply_execution_id: executionId,
          import_row_id: op.import_row_id,
          comparison_id: op.comparison_id,
          resolution_id: op.resolution_id,
          canonical_field_name: op.field_name,
          operation_type: op.operation_type,
          apply_result: 'BLOCKED',
          resolution_type: op.resolution_type,
          ownership_category: op.ownership_category,
          applied_by: user.id,
        });
      }

      // Mark operation as SKIPPED
      if (existingOp) {
        await base44.asServiceRole.entities.FamilyLifeImportApplyOperation.update(existingOp.id, {
          status: OPERATION_STATUS.SKIPPED,
          applied_at: now,
        });
      }
    }
  }

  // --- PHASE 5: POST-APPLY VERIFICATION ---
  // Reload operations to get fresh statuses (allOps is stale after execution)
  const freshOps = await base44.asServiceRole.entities.FamilyLifeImportApplyOperation.filter(
    { import_batch_id: batchId }, undefined, 5000,
  );
  const verification = await verifyApplication(base44, batchId, plan, freshOps);

  if (!verification.passed) {
    await base44.asServiceRole.entities.FamilyLifeImportBatch.update(batchId, {
      status: 'READY_FOR_REVIEW',
      apply_status: failedCount > 0 || driftBlockedCount > 0 ? 'PARTIALLY_FAILED' : 'FAILED',
      apply_error: `Post-apply verification failed: ${verification.errors.join('; ')}`,
      apply_summary: {
        preflight_passed: true,
        drift_blocked_count: driftBlockedCount,
        restrictions_added: restrictionsAdded,
        fields_skipped: fieldsSkipped,
        fields_blocked: fieldsBlocked,
        keep_current_count: plan.keepCurrentCount,
        custom_values_applied: customValuesApplied,
        verification_passed: false,
      },
      created_household_count: createdHouseholdCount,
      updated_household_count: updatedHouseholdCount,
      created_member_count: createdMemberCount,
      updated_member_count: updatedMemberCount,
      failed_row_count: failedCount + driftBlockedCount,
      applied_field_count: appliedFieldCount,
      skipped_row_count: plan.skippedRows.size,
    });
    return Response.json({
      error: 'Post-apply verification failed.',
      verification_errors: verification.errors,
      apply_execution_id: executionId,
      needs_review: true,
      retry_safe: false,
    }, { status: 500 });
  }

  // --- PHASE 6: MARK BATCH AS APPLIED ---
  const appliedAt = new Date().toISOString();
  await base44.asServiceRole.entities.FamilyLifeImportBatch.update(batchId, {
    status: 'APPLIED',
    apply_status: 'APPLIED',
    applied_at: appliedAt,
    applied_by: user.id,
    apply_error: '',
    apply_summary: {
      preflight_passed: true,
      drift_blocked_count: driftBlockedCount,
      restrictions_added: restrictionsAdded,
      fields_skipped: fieldsSkipped,
      fields_blocked: fieldsBlocked,
      keep_current_count: plan.keepCurrentCount,
      custom_values_applied: customValuesApplied,
      verification_passed: true,
    },
    created_household_count: createdHouseholdCount,
    updated_household_count: updatedHouseholdCount,
    created_member_count: createdMemberCount,
    updated_member_count: updatedMemberCount,
    skipped_row_count: plan.skippedRows.size,
    failed_row_count: failedCount,
    applied_field_count: appliedFieldCount,
  });

  // Mark all active resolutions as APPLIED
  const activeResolutions = resolutions.filter((r) =>
    r.status === RESOLUTION_STATUS.PENDING || r.status === RESOLUTION_STATUS.RESOLVED,
  );
  const resolutionUpdates = activeResolutions.map((r) => ({
    id: r.id,
    status: RESOLUTION_STATUS.APPLIED,
    last_modified_at: appliedAt,
    last_modified_by: user.id,
  }));
  if (resolutionUpdates.length) {
    await bulkUpdateSafe(base44, 'FamilyLifeImportResolution', resolutionUpdates);
  }

  // Mark all operations as VERIFIED — reload to get current statuses
  // (allOps was loaded before execution; operation statuses were updated in DB since)
  const finalOps = await base44.asServiceRole.entities.FamilyLifeImportApplyOperation.filter(
    { import_batch_id: batchId }, undefined, 5000,
  );
  const opsToVerify = finalOps.filter((o) => o.status === OPERATION_STATUS.APPLIED);
  const verifyUpdates = opsToVerify.map((o) => ({
    id: o.id,
    status: OPERATION_STATUS.VERIFIED,
    verified_at: appliedAt,
  }));
  if (verifyUpdates.length) {
    await bulkUpdateSafe(base44, 'FamilyLifeImportApplyOperation', verifyUpdates);
  }

  // Audit: APPLY_COMPLETED
  await createApplyAudit(base44, {
    import_batch_id: batchId,
    apply_execution_id: executionId,
    apply_result: 'APPLIED',
    applied_by: user.id,
  });

  return Response.json({
    success: true,
    apply_execution_id: executionId,
    applied_at: appliedAt,
    summary: {
      created_households: createdHouseholdCount,
      updated_households: updatedHouseholdCount,
      created_members: createdMemberCount,
      updated_members: updatedMemberCount,
      fields_applied: appliedFieldCount,
      restrictions_added: restrictionsAdded,
      fields_skipped: fieldsSkipped,
      fields_blocked: fieldsBlocked,
      rows_discarded: Array.from(plan.skippedRows).filter((rid) => {
        const r = rows.find((row) => row.id === rid);
        return r?.row_resolution_status === 'DISCARDED';
      }).length,
      warnings: preflight.warnings,
      verification_passed: true,
    },
  });
}

// ============================================================
// Post-apply verification
// ============================================================
async function verifyApplication(base44, batchId, plan, allOps): Promise<{ passed: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Collect all entity IDs to verify in a single batch load
  const householdIds = new Set<string>(plan.householdUpdates.keys());
  for (const [entityId] of plan.restrictionUpdates) householdIds.add(entityId);

  // Collect created household IDs from operations (fresh from DB)
  const allCreatedHouseholdIds = new Set<string>();
  for (const [rowId] of plan.newHouseholdCreations) {
    const createdOps = allOps.filter((o) =>
      o.temporary_entity_key === rowId && o.operation_type === OPERATION_TYPE.CREATE_HOUSEHOLD && o.entity_id,
    );
    for (const op of createdOps) {
      if (op.entity_id) allCreatedHouseholdIds.add(op.entity_id);
    }
  }
  for (const hid of allCreatedHouseholdIds) householdIds.add(hid);

  const memberIds = new Set<string>(plan.memberUpdates.keys());

  // Batch-load all records in two calls instead of N sequential gets
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

  // Verify existing household updates
  for (const [householdId, fieldUpdates] of plan.householdUpdates) {
    const current = householdMap.get(householdId);
    if (!current) {
      errors.push(`Household ${householdId} missing after update.`);
      continue;
    }
    for (const [fieldName, expectedValue] of Object.entries(fieldUpdates)) {
      const policy = getFieldPolicy('ChampionHousehold', fieldName);
      const expected = normalizeForComparison(expectedValue, policy);
      const actual = normalizeForComparison(current[fieldName], policy);
      if (expected !== actual) {
        errors.push(`Household ${householdId} field ${fieldName}: expected "${expected}", got "${actual}".`);
      }
    }
  }

  // Verify existing member updates
  for (const [memberId, fieldUpdates] of plan.memberUpdates) {
    const current = memberMap.get(memberId);
    if (!current) {
      errors.push(`Member ${memberId} missing after update.`);
      continue;
    }
    for (const [fieldName, expectedValue] of Object.entries(fieldUpdates)) {
      const policy = getFieldPolicy('HouseholdMember', fieldName);
      const expected = normalizeForComparison(expectedValue, policy);
      const actual = normalizeForComparison(current[fieldName], policy);
      if (expected !== actual) {
        errors.push(`Member ${memberId} field ${fieldName}: expected "${expected}", got "${actual}".`);
      }
    }
  }

  // Verify restrictions were not reduced
  for (const [entityId, restrictions] of plan.restrictionUpdates) {
    const current = householdMap.get(entityId);
    if (!current) continue;
    for (const [fieldName] of Object.entries(restrictions)) {
      if (current[fieldName] !== true) {
        errors.push(`Household ${entityId} restriction ${fieldName} was not applied.`);
      }
    }
  }

  // Verify new households were created
  for (const hid of allCreatedHouseholdIds) {
    if (!householdMap.has(hid)) {
      errors.push(`Created household ${hid} is missing after apply.`);
    }
  }

  // Verify no duplicate FamilyLife external IDs were created
  const flExtIds = new Set<string>();
  for (const hid of allCreatedHouseholdIds) {
    const h = householdMap.get(hid);
    if (h?.familylife_external_id) flExtIds.add(h.familylife_external_id);
  }
  for (const extId of flExtIds) {
    const dups = await base44.asServiceRole.entities.ChampionHousehold.filter(
      { familylife_external_id: extId }, undefined, 500,
    );
    if (dups && dups.length > 1) {
      errors.push(`Duplicate FamilyLife external ID "${extId}" detected after creation.`);
    }
  }

  return { passed: errors.length === 0, errors };
}

// ============================================================
// status — check current apply status
// ============================================================
async function handleStatus(base44, user, batchId) {
  const batch = await base44.asServiceRole.entities.FamilyLifeImportBatch.get(batchId);
  if (!batch) return Response.json({ error: 'Batch not found.' }, { status: 404 });

  const [operations, applyAudits] = await Promise.all([
    base44.asServiceRole.entities.FamilyLifeImportApplyOperation.filter({ import_batch_id: batchId }, undefined, 5000),
    base44.asServiceRole.entities.FamilyLifeImportApplyAudit.filter({ import_batch_id: batchId }, '-created_date', 100),
  ]);

  const statusCounts = {
    pending: operations.filter((o) => o.status === OPERATION_STATUS.PENDING).length,
    applied: operations.filter((o) => o.status === OPERATION_STATUS.APPLIED).length,
    verified: operations.filter((o) => o.status === OPERATION_STATUS.VERIFIED).length,
    failed: operations.filter((o) => o.status === OPERATION_STATUS.FAILED).length,
    skipped: operations.filter((o) => o.status === OPERATION_STATUS.SKIPPED).length,
  };

  return Response.json({
    batch_status: batch.status,
    apply_status: batch.apply_status,
    apply_execution_id: batch.apply_execution_id,
    applying_started_at: batch.applying_started_at,
    applied_at: batch.applied_at,
    applied_by: batch.applied_by,
    apply_error: batch.apply_error,
    apply_summary: batch.apply_summary,
    operation_counts: statusCounts,
    total_operations: operations.length,
    recent_audits: applyAudits.slice(0, 10),
  });
}
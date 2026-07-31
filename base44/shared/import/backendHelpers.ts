// ============================================================
// Shared Backend Helpers for FamilyLife Import
// ============================================================
//
// Common utilities used by multiple backend functions to avoid
// code duplication. Each function that needs bulk-safe CRUD or
// batch data loading imports from here.
// ============================================================

const BULK_LIMIT = 500;

/**
 * Bulk-create records safely in chunks, collecting all created records.
 */
export async function bulkCreateSafe(base44, entity, records) {
  const created = [];
  for (let i = 0; i < records.length; i += BULK_LIMIT) {
    const chunk = records.slice(i, i + BULK_LIMIT);
    const res = await base44.asServiceRole.entities[entity].bulkCreate(chunk);
    if (Array.isArray(res)) created.push(...res);
  }
  return created;
}

/**
 * Bulk-update records safely in chunks.
 */
export async function bulkUpdateSafe(base44, entity, records) {
  for (let i = 0; i < records.length; i += BULK_LIMIT) {
    const chunk = records.slice(i, i + BULK_LIMIT);
    await base44.asServiceRole.entities[entity].bulkUpdate(chunk);
  }
}

/**
 * Load all batch-related data (comparisons, resolutions, rows, issues)
 * in a single parallel fetch.
 */
export async function loadBatchData(base44, batchId) {
  const [comparisons, resolutions, rows, issues] = await Promise.all([
    base44.asServiceRole.entities.FamilyLifeImportFieldComparison.filter({ import_batch_id: batchId }, undefined, 5000),
    base44.asServiceRole.entities.FamilyLifeImportResolution.filter({ import_batch_id: batchId }, undefined, 5000),
    base44.asServiceRole.entities.FamilyLifeImportRow.filter({ import_batch_id: batchId }, 'row_number', 5000),
    base44.asServiceRole.entities.FamilyLifeImportIssue.filter({ import_batch_id: batchId }, undefined, 5000),
  ]);
  return {
    comparisons: comparisons || [],
    resolutions: resolutions || [],
    rows: rows || [],
    issues: issues || [],
  };
}
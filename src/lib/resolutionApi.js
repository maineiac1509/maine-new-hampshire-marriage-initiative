import { base44 } from '@/api/base44Client';

// Frontend helper for calling the processImportResolution backend function.
// All actions are admin-only and return the backend's response data.

export async function generateDefaults(batchId) {
  const res = await base44.functions.invoke('processImportResolution', {
    action: 'generate_defaults', batch_id: batchId,
  });
  return res.data || res;
}

export async function saveResolution(batchId, payload) {
  const res = await base44.functions.invoke('processImportResolution', {
    action: 'save', batch_id: batchId, ...payload,
  });
  return res.data || res;
}

export async function bulkResolve(batchId, payload) {
  const res = await base44.functions.invoke('processImportResolution', {
    action: 'bulk', batch_id: batchId, ...payload,
  });
  return res.data || res;
}

export async function manualMatch(batchId, payload) {
  const res = await base44.functions.invoke('processImportResolution', {
    action: 'manual_match', batch_id: batchId, ...payload,
  });
  return res.data || res;
}

export async function discardNewRecord(batchId, rowId) {
  const res = await base44.functions.invoke('processImportResolution', {
    action: 'discard_new_record', batch_id: batchId, row_id: rowId,
  });
  return res.data || res;
}

export async function skipRow(batchId, rowId) {
  const res = await base44.functions.invoke('processImportResolution', {
    action: 'skip_row', batch_id: batchId, row_id: rowId,
  });
  return res.data || res;
}

export async function blockRow(batchId, rowId) {
  const res = await base44.functions.invoke('processImportResolution', {
    action: 'block_row', batch_id: batchId, row_id: rowId,
  });
  return res.data || res;
}

export async function checkReadiness(batchId) {
  const res = await base44.functions.invoke('processImportResolution', {
    action: 'check_readiness', batch_id: batchId,
  });
  return res.data || res;
}
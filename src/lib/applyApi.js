import { base44 } from '@/api/base44Client';

// Frontend helper for calling the applyFamilyLifeImport backend function.
// All actions are admin-only and return the backend's response data.
// The frontend sends only import_batch_id and optional confirmation —
// never field values, entity IDs, or write instructions.

export async function applyPreflight(batchId) {
  const res = await base44.functions.invoke('applyFamilyLifeImport', {
    action: 'preflight',
    import_batch_id: batchId,
  });
  return res.data || res;
}

export async function applyImport(batchId, confirmationText) {
  const res = await base44.functions.invoke('applyFamilyLifeImport', {
    action: 'apply',
    import_batch_id: batchId,
    confirmation_text: confirmationText,
  });
  return res.data || res;
}

export async function applyStatus(batchId) {
  const res = await base44.functions.invoke('applyFamilyLifeImport', {
    action: 'status',
    import_batch_id: batchId,
  });
  return res.data || res;
}
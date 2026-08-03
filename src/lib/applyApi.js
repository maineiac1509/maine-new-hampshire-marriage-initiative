import { base44 } from '@/api/base44Client';

// Frontend helper for calling the applyFamilyLifeImport backend function.
// All actions are admin-only and return the backend's response data.
// The frontend sends only import_batch_id and optional confirmation —
// never field values, entity IDs, or write instructions.

export async function applyPreflight(batchId) {
  // Cache-bust: append a unique nonce so every dialog open fetches fresh.
  const res = await base44.functions.invoke('applyFamilyLifeImport', {
    action: 'preflight',
    import_batch_id: batchId,
    _t: Date.now(),
  });
  return res.data || res;
}

export async function applyStart(batchId, confirmationText) {
  const res = await base44.functions.invoke('applyFamilyLifeImport', {
    action: 'start',
    import_batch_id: batchId,
    confirmation_text: confirmationText,
  });
  return res.data || res;
}

export async function applyChunk(batchId) {
  const res = await base44.functions.invoke('applyFamilyLifeImport', {
    action: 'chunk',
    import_batch_id: batchId,
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

export async function applyReset(batchId) {
  const res = await base44.functions.invoke('applyFamilyLifeImport', {
    action: 'reset',
    import_batch_id: batchId,
  });
  return res.data || res;
}
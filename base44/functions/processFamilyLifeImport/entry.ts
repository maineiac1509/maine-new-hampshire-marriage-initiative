import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { processImportBatch } from '../../shared/import/stagingProcessor.ts';

// ============================================================
// FamilyLife Import — Staging & Comparison Endpoint
// ============================================================
// The single HTTP entry point for the safe FamilyLife
// synchronization workflow. Admin-only.
//
// Request body (JSON):
//   {
//     mode: 'file' | 'paste',
//     file_url?: string,       // required for mode='file'
//     file_name: string,
//     file_size?: number,
//     file_type?: string,
//     source_period?: string,
//     raw_text?: string,       // required for mode='paste'
//     reprocess_batch_id?: string  // to reprocess an existing batch
//   }
//
// Returns:
//   { batch_id, status, summary, is_possible_duplicate, previous_batch_id }
//
// This endpoint NEVER updates production ChampionHousehold or
// HouseholdMember records. It only stages, matches, and compares.
// ============================================================

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — administrators only.' }, { status: 403 });

    let body;
    try {
      body = await req.json();
    } catch (_parseError) {
      return Response.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    if (!body.mode || !body.file_name) {
      return Response.json({ error: 'mode and file_name are required.' }, { status: 400 });
    }

    const result = await processImportBatch(base44, body);
    return Response.json(result);
  } catch (error) {
    return Response.json({
      error: error.message || 'Import staging failed.',
    }, { status: 500 });
  }
}
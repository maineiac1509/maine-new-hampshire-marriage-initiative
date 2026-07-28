import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { processAIRequest } from '../../shared/ai/rie.ts';
import { AIError, AI_ERROR_CATEGORIES } from '../../shared/ai/errors.ts';

// ============================================================
// AI Request Handler
// ============================================================
// The single HTTP entry point for all AI requests in Champion Connect.
// No application component should call an LLM directly — all AI
// interactions flow through this endpoint → RIE → Orchestrator → Provider.
//
// Request body (JSON):
//   {
//     householdId?: string,        // target champion for context assembly
//     task: string,                 // what the AI should do
//     capability?: string,           // metadata label for logging
//     outputSchema?: object,        // JSON schema for structured output
//     additionalInstructions?: string,
//     requestedSources?: string[],  // override default context sources
//     organizationId?: string,      // feature flag scope
//     regionId?: string,
//     churchId?: string
//   }
//
// Returns: { result, meta } on success, { error, category } on failure.
// AI failures return structured errors — they never crash Champion Connect.
// ============================================================

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body;
    try {
      body = await req.json();
    } catch (_parseError) {
      return Response.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    if (!body.task) {
      return Response.json({ error: 'A "task" field is required.' }, { status: 400 });
    }

    const result = await processAIRequest(base44, body);
    return Response.json(result);
  } catch (error) {
    // AI failures should never interrupt Champion Connect.
    // Return a structured error that callers can handle gracefully.
    const category = error.category || AI_ERROR_CATEGORIES.UNKNOWN;
    const status = category === AI_ERROR_CATEGORIES.PERMISSION_DENIED ? 403
      : category === AI_ERROR_CATEGORIES.FEATURE_DISABLED ? 503
      : 500;

    return Response.json({
      error: error.message || 'AI request failed.',
      category,
    }, { status });
  }
}
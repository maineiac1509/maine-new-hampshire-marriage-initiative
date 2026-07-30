import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { loadConfig } from '../../shared/ai/config.ts';

// ============================================================
// Ministry Coach Connection Test
// ============================================================
// Verifies that the AI provider is reachable, credentials are
// valid, and the model is accessible. Returns user-friendly
// diagnostics — never exposes raw provider errors.
//
// Only administrators may run the connection test.
// ============================================================

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const config = await loadConfig(base44);

    if (!config.ai_enabled) {
      return Response.json({
        success: false,
        message: 'Ministry Coach is currently disabled. Enable it in the Status section above to test the connection.',
        provider: config.provider,
        model: config.model,
      });
    }

    const startTime = Date.now();

    try {
      const invokeParams = { prompt: 'Respond with exactly: MINISTRY_COACH_OK' };
      if (config.model && config.model !== 'automatic') invokeParams.model = config.model;

      await base44.asServiceRole.integrations.Core.InvokeLLM(invokeParams);
      const durationMs = Date.now() - startTime;

      return Response.json({
        success: true,
        message: 'Connection successful. The provider is reachable, credentials are valid, and the model is accessible.',
        provider: config.provider,
        model: config.model || 'automatic',
        durationMs,
      });
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const msg = (err?.message || '').toLowerCase();
      let diagnostic = 'The AI provider could not be reached. Please try again in a few moments.';

      if (msg.includes('timeout') || msg.includes('timed out')) {
        diagnostic = 'The request timed out. The provider may be slow or temporarily unavailable.';
      } else if (msg.includes('auth') || msg.includes('key') || msg.includes('credential') || msg.includes('unauthorized')) {
        diagnostic = 'Authentication failed. Please verify the provider credentials.';
      } else if (msg.includes('model') || msg.includes('not found') || msg.includes('invalid')) {
        diagnostic = 'The specified model could not be accessed. Try selecting a different model.';
      } else if (msg.includes('rate') || msg.includes('quota') || msg.includes('limit')) {
        diagnostic = 'The provider rate limit was reached. Please wait a moment and try again.';
      }

      return Response.json({
        success: false,
        message: diagnostic,
        provider: config.provider,
        model: config.model,
        durationMs,
      });
    }
  } catch (error) {
    return Response.json({
      success: false,
      message: 'An unexpected error occurred during the connection test. Please check your configuration and try again.',
    }, { status: 500 });
  }
}
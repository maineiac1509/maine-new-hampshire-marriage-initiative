// ============================================================
// Relationship Intelligence Engine (RIE)
// ============================================================
// The core engine responsible for ministry context assembly.
//
// Responsibilities:
//   1. Receive AI requests
//   2. Authenticate the user and check feature flags
//   3. Enforce security boundaries
//   4. Determine required context and retrieve ministry data
//      (via the Context Builder — RLS-enforced, user-scoped)
//   5. Build a structured context package
//   6. Pass the package to the AI Orchestrator
//
// The RIE owns context. The LLM owns reasoning.
// ============================================================

import { buildContext, AVAILABLE_CONTEXT_SOURCES } from './contextBuilder.ts';
import { orchestrate } from './orchestrator.ts';
import { loadConfig } from './config.ts';
import { isAIEnabled, getFeatureFlagSource } from './featureFlags.ts';
import { authorizeChampionAccess, getUserPermissionScope } from './security.ts';
import { logAIRequest, estimateCost, estimateTokensFromChars } from './logging.ts';
import { AIError, AI_ERROR_CATEGORIES } from './errors.ts';

// Main entry point for all AI requests.
// request shape:
//   { householdId, task, capability, outputSchema, additionalInstructions,
//     requestedSources, organizationId, regionId, churchId }
//
// Returns: { result, meta: { ...orchestratorMeta, requestId } }
// Throws: AIError on any failure (caller must handle gracefully).
export async function processAIRequest(base44, request) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  const logEntry = {
    requestId,
    userId: null,
    capability: request.capability || 'generic',
    provider: null,
    model: null,
    durationMs: 0,
    tokenUsage: null,
    promptTokens: null,
    completionTokens: null,
    estimatedCost: 0,
    contextSize: 0,
    success: false,
    errorCategory: null,
    contextEntitiesCount: 0,
    contextSources: [],
    featureFlagSource: 'global',
  };

  try {
    // 1. Authenticate the user.
    const user = await base44.auth.me();
    if (!user) {
      throw new AIError(
        AI_ERROR_CATEGORIES.PERMISSION_DENIED,
        'Authentication required for AI requests.'
      );
    }
    logEntry.userId = user.id;

    // 2. Load configuration (centralized, admin-editable).
    const config = await loadConfig(base44);
    logEntry.provider = config.provider;
    logEntry.model = config.model;

    // 3. Check feature flags (global → org → region → church → user).
    const flagContext = {
      organizationId: request.organizationId,
      regionId: request.regionId,
      churchId: request.churchId,
    };
    const enabled = isAIEnabled(config, user, flagContext);
    logEntry.featureFlagSource = getFeatureFlagSource(config, user, flagContext);

    if (!enabled) {
      throw new AIError(
        AI_ERROR_CATEGORIES.FEATURE_DISABLED,
        'AI functionality is not enabled for this user or scope.'
      );
    }

    // 4. Enforce security boundaries — verify the user can access this champion.
    if (request.householdId) {
      await authorizeChampionAccess(base44, user, request.householdId);
    }

    const _permissionScope = getUserPermissionScope(user); // available for future granular checks

    // 5. Build context package via the Context Builder.
    //    Uses user-scoped SDK calls so RLS is enforced — the AI only sees
    //    data the requesting user is authorized to access.
    const contextPackage = await buildContext(base44, {
      user,
      householdId: request.householdId,
      requestedSources: request.requestedSources,
      maxContextSize: config.max_context_size,
      reductionConfig: config.context_reduction,
    });
    logEntry.contextEntitiesCount = contextPackage.entityCount;
    logEntry.contextSources = contextPackage.sources;

    // 6. Pass to the AI Orchestrator for prompt assembly, execution, and validation.
    const { result, meta } = await orchestrate(base44, {
      config,
      contextPackage,
      task: request.task,
      outputSchema: request.outputSchema,
      additionalInstructions: request.additionalInstructions,
    });

    // 7. Log metadata (no content) — non-blocking.
    const contextSize = JSON.stringify(contextPackage.entities).length;
    logEntry.durationMs = Date.now() - startTime;
    logEntry.tokenUsage = meta.usage;
    logEntry.promptTokens = meta.usage?.promptTokens || estimateTokensFromChars(contextSize);
    logEntry.completionTokens = meta.usage?.completionTokens || null;
    logEntry.contextSize = contextSize;
    logEntry.estimatedCost = estimateCost(logEntry.promptTokens, logEntry.completionTokens);
    logEntry.success = true;
    logAIRequest(base44, logEntry);

    return { result, meta: { ...meta, requestId } };
  } catch (error) {
    // Log failure metadata — non-blocking, best-effort.
    logEntry.durationMs = Date.now() - startTime;
    logEntry.success = false;
    logEntry.errorCategory = error instanceof AIError
      ? error.category
      : AI_ERROR_CATEGORIES.UNKNOWN;
    logAIRequest(base44, logEntry);

    throw error instanceof AIError
      ? error
      : new AIError(AI_ERROR_CATEGORIES.UNKNOWN, error.message, { cause: error });
  }
}

export { AVAILABLE_CONTEXT_SOURCES };
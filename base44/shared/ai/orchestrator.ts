// ============================================================
// AI Orchestrator
// ============================================================
// Accepts a Context Package, selects the provider (via the Provider
// Abstraction Layer), builds the prompt (via the Prompt Framework),
// executes the request, validates the structured response, and returns
// a normalized result.
//
// No business logic belongs here — the Orchestrator is purely
// infrastructure for prompt assembly, execution, validation, and retry.
// ============================================================

import { getProvider } from './providers.ts';
import { buildPrompt } from './prompts.ts';
import { resolveResponseSchema } from './responseContract.ts';
import { AIError, AI_ERROR_CATEGORIES, categorizeError } from './errors.ts';

// Validates a structured (JSON) response against the expected schema shape.
// Performs basic structural validation — does not deeply validate types.
function validateStructuredResponse(content, schema) {
  if (!schema) return content;

  let parsed;
  try {
    parsed = typeof content === 'string' ? JSON.parse(content) : content;
  } catch (error) {
    throw new AIError(
      AI_ERROR_CATEGORIES.INVALID_RESPONSE,
      'AI response was not valid JSON.',
      { cause: error }
    );
  }

  // Verify required top-level properties exist.
  if (schema.properties) {
    const required = schema.required || [];
    for (const field of required) {
      if (!(field in parsed)) {
        throw new AIError(
          AI_ERROR_CATEGORIES.INVALID_RESPONSE,
          `AI response missing required field: ${field}`
        );
      }
    }
  }

  return parsed;
}

// Executes an AI request end-to-end with retry logic.
// Returns: { result, meta: { provider, model, durationMs, usage, contextEntitiesCount, contextSources, attempts } }
export async function orchestrate(base44, opts) {
  const { config, contextPackage, task, outputSchema, additionalInstructions } = opts;
  const startTime = Date.now();

  // Select provider (configuration-driven — no code changes needed to swap).
  const provider = getProvider(config.provider);

  // Resolve the effective response schema — use the caller-provided schema
  // if given, otherwise enforce the standard AI response contract.
  const effectiveSchema = resolveResponseSchema(outputSchema);

  // Build standardized prompt via the Prompt Framework.
  const { messages, responseJsonSchema } = buildPrompt({
    task,
    contextPackage,
    outputSchema: effectiveSchema,
    additionalInstructions,
  });

  // Execute with retry logic for transient failures.
  let lastError;
  const maxAttempts = (config.max_retries || 0) + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await provider.complete(base44, {
        messages,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.max_tokens,
        responseJsonSchema,
        timeoutMs: config.timeout_ms,
      });

      // Validate response against the effective schema (standard contract or caller override).
      const result = validateStructuredResponse(response.content, effectiveSchema);

      const durationMs = Date.now() - startTime;

      return {
        result,
        meta: {
          provider: provider.name,
          model: response.model,
          durationMs,
          usage: response.usage,
          contextEntitiesCount: contextPackage.entityCount,
          contextSources: contextPackage.sources,
          attempts: attempt,
        },
      };
    } catch (error) {
      lastError = error;

      // Don't retry on non-transient errors.
      if (error instanceof AIError) {
        const nonRetryable = [
          AI_ERROR_CATEGORIES.PERMISSION_DENIED,
          AI_ERROR_CATEGORIES.CONFIG_ERROR,
          AI_ERROR_CATEGORIES.FEATURE_DISABLED,
          AI_ERROR_CATEGORIES.EMPTY_CONTEXT,
          AI_ERROR_CATEGORIES.CONTEXT_TOO_LARGE,
          AI_ERROR_CATEGORIES.INVALID_RESPONSE,
        ];
        if (nonRetryable.includes(error.category)) break;
      }
      // Transient errors (timeout, provider unavailable) — retry.
    }
  }

  // All attempts exhausted — throw categorized error.
  const category = lastError instanceof AIError
    ? lastError.category
    : categorizeError(lastError);
  throw new AIError(
    category,
    lastError?.message || 'AI request failed after all retry attempts.',
    { cause: lastError }
  );
}
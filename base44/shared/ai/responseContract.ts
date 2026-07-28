// ============================================================
// Standardized AI Response Contract
// ============================================================
// Every AI response must conform to this schema (or a caller-provided
// override). The AI Orchestrator enforces validation against the
// effective schema before returning any result to the application.
//
// If validation fails, a structured INVALID_RESPONSE error is thrown
// rather than returning malformed output to the caller.
//
// Future AI capabilities can provide a custom outputSchema to extend
// or replace this contract — but every response is always validated.
// ============================================================

export const RESPONSE_CONTRACT_VERSION = '1.0';

// The standard response schema. All fields except `summary` and
// `confidence` are optional so the LLM can omit them when not applicable,
// but the structure is always predictable for consumers.
export const STANDARD_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'A concise summary of the AI analysis or insight.',
    },
    recommendations: {
      type: 'array',
      items: { type: 'string' },
      description: 'Actionable recommendations for the ministry volunteer or leader.',
    },
    supporting_evidence: {
      type: 'array',
      items: { type: 'string' },
      description: 'References to specific context data that informed the response.',
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Confidence score (0.0–1.0) reflecting how well the available context supports the response.',
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
      description: 'Caveats, missing data, or concerns the user should be aware of.',
    },
    metadata: {
      type: 'object',
      properties: {
        context_version: { type: 'string' },
        prompt_version: { type: 'string' },
        entities_analyzed: { type: 'number' },
      },
      description: 'Operational metadata about the request (populated by the Orchestrator).',
    },
  },
  required: ['summary', 'confidence'],
};

// Resolves the effective schema: caller-provided override takes precedence,
// otherwise the standard response contract is enforced.
export function resolveResponseSchema(callerSchema) {
  return callerSchema || STANDARD_RESPONSE_SCHEMA;
}
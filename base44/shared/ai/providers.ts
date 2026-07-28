// ============================================================
// AI Provider Abstraction Layer
// ============================================================
// Isolates Champion Connect from any specific AI vendor.
// No application component should directly call an LLM — all
// requests flow through the AI Orchestrator which uses this layer.
//
// To add a new provider:
//   1. Implement the Provider interface (async complete method).
//   2. Register it in PROVIDER_REGISTRY below.
//   3. Reference it by name in AIConfig.provider.
//
// Provider interface contract:
//   constructor() — sets this.name and this.description
//   async complete(base44, params) -> {
//     content: string | object,   // raw LLM output
//     usage: { promptTokens, completionTokens, totalTokens },
//     model: string,              // resolved model name
//     raw: any                    // original provider response (optional)
//   }
//
// params shape:
//   { messages, model, temperature, maxTokens, responseJsonSchema, timeoutMs }
//   messages: [{ role: 'system'|'user'|'assistant', content: string }]
// ============================================================

import { AIError, AI_ERROR_CATEGORIES, categorizeError } from './errors.ts';

class Base44Provider {
  constructor() {
    this.name = 'base44';
    this.description = 'Built-in Base44 LLM integration (InvokeLLM).';
  }

  async complete(base44, params) {
    const { messages, model, responseJsonSchema } = params;

    // Base44 InvokeLLM accepts a single prompt string. We combine
    // system and user messages into a structured prompt.
    const systemContent = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const userContent = messages
      .filter((m) => m.role !== 'system')
      .map((m) => m.content)
      .join('\n\n');

    const prompt = systemContent
      ? `${systemContent}\n\n---\n\n${userContent}`
      : userContent;

    const invokeParams = { prompt };
    if (model && model !== 'automatic') invokeParams.model = model;
    if (responseJsonSchema) invokeParams.response_json_schema = responseJsonSchema;

    let response;
    try {
      response = await base44.asServiceRole.integrations.Core.InvokeLLM(invokeParams);
    } catch (error) {
      throw new AIError(
        categorizeError(error),
        `Base44 LLM provider error: ${error.message}`,
        { cause: error }
      );
    }

    // InvokeLLM returns a string (no schema) or a parsed object (with schema).
    const content = typeof response === 'string' ? response : response;
    const usage = {
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
    };

    return {
      content,
      usage,
      model: model || 'automatic',
      raw: response,
    };
  }
}

// Registry of available providers. Add future providers here.
const PROVIDER_REGISTRY = {
  base44: () => new Base44Provider(),
  // openai: () => new OpenAIProvider(),       // Future
  // anthropic: () => new AnthropicProvider(), // Future
  // gemini: () => new GeminiProvider(),       // Future
  // azure: () => new AzureOpenAIProvider(),   // Future
  // local: () => new LocalModelProvider(),    // Future
};

// Factory: returns a provider instance by name.
// Swapping providers requires only a config change — no code modifications.
export function getProvider(name) {
  const factory = PROVIDER_REGISTRY[name];
  if (!factory) {
    throw new AIError(
      AI_ERROR_CATEGORIES.CONFIG_ERROR,
      `Unknown AI provider: "${name}". Registered providers: ${Object.keys(PROVIDER_REGISTRY).join(', ')}`
    );
  }
  return factory();
}

export const AVAILABLE_PROVIDERS = Object.keys(PROVIDER_REGISTRY);
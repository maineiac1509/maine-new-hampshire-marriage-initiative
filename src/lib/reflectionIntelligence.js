// ============================================================
// Reflection Intelligence — Task, Schema, and Capability
// ============================================================
// Epic 7.3 — The second user-facing Ministry Coach capability.
// Transforms rough, unstructured meeting notes into structured
// ministry knowledge for the volunteer to review and approve.
//
// All AI interactions flow through the AI Foundation (Epic 7.1):
//   NewReflectionDialog → aiRequest backend function → RIE →
//   Context Builder → Prompt Framework → Orchestrator →
//   Validated Response Contract → Review Screen → Approved Save
//
// The AI organizes, clarifies, summarizes, and recommends.
// The human decides. Nothing is saved without approval.
// ============================================================

export const REFLECTION_INTELLIGENCE_CAPABILITY = 'reflection_intelligence';

// Detailed task prompt sent to the AI Orchestrator.
// The raw reflection notes are passed as `additionalInstructions`.
export const REFLECTION_INTELLIGENCE_TASK = `Analyze the reflection notes provided in the Additional Instructions below.

These are rough, unstructured notes from a ministry volunteer about a recent meeting or conversation with this Marriage Champion. Your role is to ORGANIZE, CLARIFY, SUMMARIZE, and RECOMMEND — transforming the notes into structured ministry knowledge.

Produce the following sections:

1. REFLECTION SUMMARY: A concise ministry summary (2–4 sentences) suitable for the champion's timeline. Capture the key topics discussed and any commitments or next steps mentioned. If the notes are sparse, summarize what is available without inventing details.

2. PRAYER_REQUESTS: Extract explicit prayer requests mentioned in the notes. Each must include the request itself and evidence (a quote or reference from the notes). Only include prayer requests that are actually mentioned — NEVER invent them. If none are mentioned, return an empty array.

3. ACTION_ITEMS: Suggest follow-up actions based on the notes. Each must include the suggested action, why it is suggested, and evidence from the notes. These are suggestions only — never directives. If the notes do not suggest clear actions, return an empty array.

4. RELATIONSHIP_SIGNALS: Identify notable ministry indicators from the notes (e.g., increased engagement, leadership potential, communication improving, possible burnout, consistent follow-through, new ministry interest). Each signal must be descriptive rather than diagnostic, and must include evidence from the notes. If no clear signals are present, return an empty array.

5. LEADERSHIP_OBSERVATIONS: If the notes provide evidence of positive leadership characteristics (e.g., serving others, investing in couples, reliable follow-through, potential mentor, ministry initiative), identify them. NEVER label someone as a leader without supporting evidence from the notes. Each observation must include evidence. If no leadership evidence is present, return an empty array.

6. RESOURCE_RECOMMENDATIONS: Suggest FamilyLife or ministry resources when relevant (e.g., communication guide, prayer guide, marriage devotional, Weekend to Remember, small group opportunity). Each recommendation must explain why it is suggested and reference evidence from the notes. If no resources are clearly relevant, return an empty array.

7. TIMELINE_ENTRY: A polished, concise timeline entry (1–2 sentences) suitable for future Relationship Intelligence context. Keep it brief and factual.

8. SENTIMENT: The overall tone of the meeting. Use exactly one value: "Encouraging", "Hopeful", "Challenging", "Celebratory", "Reflective", "Concerned", or "Neutral". Include a brief explanation grounded in the notes. NEVER diagnose emotional or mental health.

9. CONFIDENCE: "High", "Medium", or "Low" — reflecting the quality and completeness of the NOTES (not the people). "Low" is appropriate for very short, vague, or fragmented notes. Include a brief explanation.

GUARDRAILS:
- Never invent details, prayer requests, or action items not present in the notes.
- Never rewrite ministry history or modify previous reflections.
- Never diagnose marriages, predict outcomes, or infer motives.
- Never invent leadership observations without supporting evidence.
- If the notes are too brief or unclear for a section, return an empty array for that section rather than guessing.
- Every suggestion, signal, and observation must be grounded in evidence from the notes.
- If uncertain, say so explicitly and set confidence to "Low".
- The goal is to organize, clarify, summarize, and recommend — never to replace discernment.
- You assist. The human decides.`;

// Structured output schema enforced by the AI Orchestrator.
export const REFLECTION_INTELLIGENCE_SCHEMA = {
  type: 'object',
  properties: {
    reflection_summary: {
      type: 'string',
      description: 'Concise ministry summary (2–4 sentences).',
    },
    prayer_requests: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          request: { type: 'string' },
          evidence: { type: 'string' },
        },
      },
      description: 'Prayer requests extracted from the notes.',
    },
    action_items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item: { type: 'string' },
          why: { type: 'string' },
          evidence: { type: 'string' },
        },
      },
      description: 'Suggested follow-up actions with rationale.',
    },
    relationship_signals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          signal: { type: 'string' },
          evidence: { type: 'string' },
        },
      },
      description: 'Notable ministry indicators — descriptive, not diagnostic.',
    },
    leadership_observations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          observation: { type: 'string' },
          evidence: { type: 'string' },
        },
      },
      description: 'Evidence-based leadership characteristics.',
    },
    resource_recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          resource: { type: 'string' },
          reason: { type: 'string' },
          evidence: { type: 'string' },
        },
      },
      description: 'Relevant resource recommendations with reasoning.',
    },
    timeline_entry: {
      type: 'string',
      description: 'Polished, concise timeline entry (1–2 sentences).',
    },
    sentiment: {
      type: 'string',
      enum: ['Encouraging', 'Hopeful', 'Challenging', 'Celebratory', 'Reflective', 'Concerned', 'Neutral'],
      description: 'Overall tone of the meeting.',
    },
    sentiment_explanation: {
      type: 'string',
      description: 'Brief explanation of the sentiment, grounded in the notes.',
    },
    confidence: {
      type: 'string',
      enum: ['High', 'Medium', 'Low'],
      description: 'Confidence reflecting note quality, not people.',
    },
    confidence_explanation: {
      type: 'string',
      description: 'Brief explanation of the confidence level.',
    },
  },
  required: ['reflection_summary', 'timeline_entry', 'sentiment', 'confidence', 'confidence_explanation'],
};
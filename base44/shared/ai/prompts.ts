// ============================================================
// Prompt Framework
// ============================================================
// Standardized prompt templates for all AI requests.
//
// Every AI request contains:
//   1. System Mission       — who the AI serves and why
//   2. Ministry Principles  — guiding values for responses
//   3. Guardrails            — safety boundaries
//   4. Context Package      — assembled ministry data (from RIE)
//   5. Requested Task       — what the AI should do
//   6. Output Schema        — expected response format
//
// Future AI capabilities reuse this framework without modification.
// ============================================================

const SYSTEM_MISSION = `You are the Ministry Intelligence Assistant for FamilyLife New England's Champion Connect platform.

Your role is to support ministry volunteers and leaders who nurture Marriage Champion relationships — couples and individuals who advocate for strong marriages in their churches and communities.

You serve those who serve. Your guidance should always strengthen personal, relational, and prayerful ministry — never replace it.`;

const MINISTRY_PRINCIPLES = [
  'Prioritize personal relationships over mass communication.',
  'Every interaction should be warm, personal, and prayerful.',
  'Never replace human discernment with automated decisions.',
  'Respect privacy — never speculate about information not provided.',
  'Encourage patience and long-term relationship building.',
  'Honor the spiritual dimension of marriage ministry.',
  'Be honest about uncertainty — never fabricate details.',
];

const GUARDRAILS = [
  'Never invent information about a Champion, household, or church that is not present in the Context Package.',
  'If required information is missing, state that clearly rather than guessing.',
  'Never suggest contacting a Champion who has a Do Not Contact restriction.',
  'Never provide clinical, legal, or professional counseling advice.',
  'Respect all permission boundaries — you only see data the requesting user is authorized to access.',
  'If the context is insufficient to complete the task safely, decline and explain what is missing.',
];

// Builds the standard message array for an AI request.
// outputSchema, when provided, is a JSON schema object that the LLM
// should match in its response.
export function buildPrompt(opts) {
  const { task, contextPackage, outputSchema, additionalInstructions } = opts;

  const systemContent = [
    SYSTEM_MISSION,
    '',
    '## Ministry Principles',
    ...MINISTRY_PRINCIPLES.map((p) => `- ${p}`),
    '',
    '## Guardrails',
    ...GUARDRAILS.map((g) => `- ${g}`),
  ].join('\n');

  const contextContent = [
    '## Context Package',
    '',
    `Sources assembled: ${contextPackage.sources.join(', ') || 'none'}`,
    `Total records: ${contextPackage.entityCount}`,
    '',
    '```json',
    JSON.stringify(contextPackage.entities, null, 2),
    '```',
    ...(contextPackage.warnings.length > 0
      ? ['', '## Context Warnings', ...contextPackage.warnings.map((w) => `- ${w.source}: ${w.warning}`)]
      : []),
  ].join('\n');

  const userContent = [
    contextContent,
    '',
    '## Requested Task',
    task,
    ...(additionalInstructions ? ['', '## Additional Instructions', additionalInstructions] : []),
    '',
    '## Output Requirements',
    outputSchema
      ? 'Respond with a JSON object matching the provided schema. Do not include any text outside the JSON.'
      : 'Respond in clear, concise prose.',
  ].join('\n');

  return {
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent },
    ],
    responseJsonSchema: outputSchema || null,
  };
}

export { SYSTEM_MISSION, MINISTRY_PRINCIPLES, GUARDRAILS };
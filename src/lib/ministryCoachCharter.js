// ============================================================
// Ministry Coach Design Charter
// ============================================================
// The Ministry Coach is an ambient ministry companion that quietly
// observes the ministry journey, recognizes moments where thoughtful
// assistance would genuinely benefit a Marriage Champion, and offers
// explainable, context-aware guidance only when it adds meaningful value.
//
// Core Principle: Silence is a Feature.
//
// The Ministry Coach should remain invisible unless it has meaningful
// ministry assistance to offer. The user should rarely think "I should
// use AI." Instead, the experience should feel like "The application
// noticed something that may help me."
//
// Context should drive AI — not menus, not buttons, not navigation.
// ============================================================

export const MINISTRY_COACH_CHARTER = {
  principle: 'Silence is a Feature',
  description:
    'The Ministry Coach remains invisible unless it has meaningful ministry assistance to offer. Context should drive AI — not menus, buttons, or navigation.',

  avoid: [
    'AI home pages',
    'AI dashboards',
    'AI launch buttons',
    'AI navigation items',
    '"Try AI" prompts',
    'Persistent AI controls without contextual purpose',
  ],

  designRules: {
    observe: 'Observe ministry activity.',
    recognize: 'Recognize meaningful opportunities.',
    offer: 'Offer contextual assistance.',
    explain: 'Explain why it is appearing.',
    quiet: 'Remain quiet otherwise.',
  },

  // ============================================================
  // Capability Registry — Contextual Triggers for Each AI Feature
  // ============================================================
  // Every AI capability must document:
  // 1. What ministry context causes the AI to surface?
  // 2. Why is that moment valuable to the Marriage Champion?
  // 3. Why is AI appropriate at that point?
  // 4. When should the AI intentionally remain silent?
  // ============================================================

  capabilities: [
    {
      name: 'Relationship Intelligence',
      contextualTrigger:
        'Champion profile has ministry context — activities, assignments, communications, reflections, prayer requests, and timeline events.',
      whyValuable:
        'Helps the volunteer see relationship patterns and ministry health indicators they might not notice from individual records.',
      whyAIAppropriate:
        'Synthesizing scattered ministry data into a coherent relationship picture requires pattern recognition across many records.',
      whenSilent:
        'Champion has no recorded interactions — the Limited Context state shows a gentle "getting to know this relationship" message instead of forcing analysis. The card auto-generates on profile load (ambient, not user-launched).',
    },
    {
      name: 'Communication Suggestions',
      contextualTrigger:
        'Ministry context indicates a communication opportunity: first contact needed (assigned, no communication), stale relationship (30+ days since last contact), prayer follow-up (recent reflection has prayer requests), follow-up actions (recent reflection has action items), ministry anniversary.',
      whyValuable:
        'Surfaces the right moment to reach out, with contextual reasoning the volunteer can validate. Helps maintain consistent, timely ministry contact without increasing message volume.',
      whyAIAppropriate:
        'Deterministic rules detect the opportunity; AI only enters when the user chooses to draft. The suggestion itself requires no AI — it is computed from existing ministry data.',
      whenSilent:
        'No meaningful communication opportunity exists — no suggestion card appears. Also silent when all communication preferences are restricted (Do Not Call, Do Not Text, Email Opt Out).',
    },
    {
      name: 'Communication Coach (Draft Generation)',
      contextualTrigger:
        'User acts on a communication suggestion by clicking "Draft a message." The AI is never launched independently — it only responds to a contextual suggestion.',
      whyValuable:
        'Removes the friction of writing while preserving authenticity. The volunteer reviews, edits, and sends. Nothing is transmitted automatically.',
      whyAIAppropriate:
        'Drafting a personal, context-aware message requires synthesizing ministry history into natural language — a task AI assists with while the human owns the final message.',
      whenSilent:
        'Never surfaces on its own. Only appears when the user acts on a contextual suggestion. If AI is unavailable, the user is directed to existing Communication Center templates.',
    },
    {
      name: 'Reflection Intelligence',
      contextualTrigger:
        'User initiates a new reflection to document meeting notes. The AI is presented as an assistive step within the documentation workflow — "Organize Notes" — not as a separate AI tool.',
      whyValuable:
        'Helps organize rough, unstructured notes into structured ministry knowledge (prayer requests, action items, relationship signals, leadership observations) during the documentation process.',
      whyAIAppropriate:
        'Organizing free-form notes into structured categories is a natural AI assistance task. The human reviews, edits, and approves every section.',
      whenSilent:
        'Never surfaces unprompted. It is an assistive tool within the documentation workflow. If AI is unavailable, the user can save notes without AI organization.',
    },
  ],

  // ============================================================
  // Future Capability Checklist
  // ============================================================
  // Beginning with Epic 7.5, every new Ministry Coach capability
  // must answer these four questions before implementation:
  // ============================================================

  futureChecklist: [
    'What ministry context causes the AI to surface?',
    'Why is that moment valuable to the Marriage Champion?',
    'Why is AI appropriate at that point?',
    'When should the AI intentionally remain silent?',
  ],

  // Appropriate user actions (after AI has surfaced, not for discovering it)
  appropriateUserActions: [
    'Refresh Intelligence',
    'Regenerate Draft',
    'Accept',
    'Edit',
    'Reject',
    'Copy',
    'Save',
    'Dismiss',
  ],
};
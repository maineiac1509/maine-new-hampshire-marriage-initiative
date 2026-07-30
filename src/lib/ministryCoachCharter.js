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
//
// Governing Principle: The Ministry Coach exists to amplify the wisdom
// of a faithful Marriage Champion — not to replace it. Before surfacing
// any AI assistance, the system should ask:
//
//   "Would an experienced Marriage Champion naturally offer help
//    in this moment?"
//
// If the answer is no, the Ministry Coach should remain silent. The goal
// is not to maximize AI interactions. The goal is to ensure that every
// interaction feels timely, thoughtful, and rooted in real ministry wisdom.
// ============================================================

export const MINISTRY_COACH_CHARTER = {
  principle: 'Silence is a Feature',
  description:
    'The Ministry Coach remains invisible unless it has meaningful ministry assistance to offer. Context should drive AI — not menus, buttons, or navigation.',

  governingPrinciple: {
    question: 'Would an experienced Marriage Champion naturally offer help in this moment?',
    description:
      'The Ministry Coach exists to amplify the wisdom of a faithful Marriage Champion — not to replace it. The first four checklist questions determine whether AI is technically appropriate. This fifth question determines whether AI is ministerially appropriate. The Ministry Coach should never be more eager to speak than a wise ministry leader would be.',
    philosophy:
      'The Ministry Coach should quietly mirror healthy ministry behavior. If an experienced Marriage Champion would naturally think "I should probably reach out," the Ministry Coach may appropriately surface. If an experienced Marriage Champion would simply continue observing and praying, the Ministry Coach should remain silent.',
  },

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
  // Every AI capability must document answers to all five questions:
  // 1. What ministry context causes the AI to surface?
  // 2. Why is that moment valuable to the Marriage Champion?
  // 3. Why is AI appropriate at that point?
  // 4. When should the AI intentionally remain silent?
  // 5. Would an experienced Marriage Champion naturally offer help in this moment?
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
      wouldChampionOfferHelp:
        'An experienced Marriage Champion reviewing a relationship would naturally form impressions about how things are going. The Ministry Coach mirrors that quiet reflection — it does not interrupt simply to restate what the volunteer can already see in the timeline.',
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
      wouldChampionOfferHelp:
        'An experienced Marriage Champion would naturally think "It\'s probably time to reconnect" after a long silence, or "I should follow up on that prayer request." The Ministry Coach surfaces only in those same moments. If communication occurred yesterday and nothing has changed, a wise champion would continue normal ministry — so the Ministry Coach remains silent.',
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
      wouldChampionOfferHelp:
        'An experienced Marriage Champion who has already decided to reach out would naturally welcome help composing the right words. The Ministry Coach enters only at that moment — after the human has decided to act — never before.',
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
      wouldChampionOfferHelp:
        'An experienced Marriage Champion reviewing their own rough notes would naturally look for the key themes — prayer needs, follow-up tasks, relationship shifts. The Ministry Coach mirrors that quiet organizing instinct. It does not interpret or judge; it simply helps structure what the human already wrote.',
    },
    {
      name: 'Resource Intelligence',
      contextualTrigger:
        'Ministry context indicates a meaningful moment for a specific resource — communication themes in recent reflections, parenting challenges, recurring prayer requests for spiritual growth, marriage enrichment readiness, leadership development signals, or life transitions (new child, career change, retirement, empty nest, caregiving).',
      whyValuable:
        'Places the right encouragement, study, devotional, or FamilyLife resource into the hands of a Marriage Champion when it would naturally benefit the Champion they are serving. Not to increase resource consumption — to ensure the right resource reaches the right person at the right time.',
      whyAIAppropriate:
        'Matching a specific ministry moment to a specific resource from the library requires synthesizing reflections, prayer requests, communication themes, and relationship health — then evaluating fit against available resources. This pattern recognition is a natural AI task, grounded by the available resource library so the AI never invents resources.',
      whenSilent:
        'No meaningful ministry context exists (no reflections, activities, or communications). AI is disabled, unavailable, or times out. The AI determines has_recommendation is false. The recommended resource does not match any real resource in the library (hallucination guardrail). The recommendation has been dismissed. Silence is the desired behavior — no placeholder recommendations are ever shown.',
      wouldChampionOfferHelp:
        'An experienced Marriage Champion who remembers conversations over months or years would quietly think "You know what? I think this might really encourage them right now." The Ministry Coach surfaces only in that same moment — when the ministry relationship has reached a point where a wise leader would naturally think of a resource. If communication occurred yesterday and nothing has changed, or if the AI has only weak confidence and minimal context, a wise champion would continue observing and praying — so the Ministry Coach remains silent.',
    },
  ],

  // ============================================================
  // Ministry Coach Review Checklist (Standing Requirement)
  // ============================================================
  // Beginning with Epic 7.5, every new Ministry Coach capability
  // must answer ALL FIVE questions before surfacing to the user.
  //
  // Questions 1–4 determine whether the AI is technically appropriate.
  // Question 5 determines whether the AI is ministerially appropriate.
  //
  // Only if all five questions are answered convincingly should the
  // Ministry Coach become visible.
  // ============================================================

  futureChecklist: [
    'What ministry context causes the AI to surface?',
    'Why is that moment valuable to the Marriage Champion?',
    'Why is AI appropriate at that point?',
    'When should the AI intentionally remain silent?',
    'Would an experienced Marriage Champion naturally offer help in this moment?',
  ],

  // ============================================================
  // Practical Examples — When to Speak and When to Stay Silent
  // ============================================================
  // These examples guide future developers in applying the fifth
  // governing question. The Ministry Coach should never be more
  // eager to speak than a wise ministry leader would be.
  // ============================================================

  examples: {
    appropriate: [
      {
        situation: 'Recent difficult conversation.',
        championThinking: '"I should follow up this week."',
        ministryCoachBehavior: 'Suggests a thoughtful follow-up.',
      },
      {
        situation: 'Reflection identifies a new prayer request.',
        championThinking: '"I should remember to pray and check back."',
        ministryCoachBehavior: 'Offers a prayer follow-up suggestion.',
      },
      {
        situation: 'Several months without communication.',
        championThinking: '"It\'s probably time to reconnect."',
        ministryCoachBehavior: 'Surfaces a contextual communication suggestion.',
      },
    ],
    notAppropriate: [
      {
        situation: 'Communication occurred yesterday. Nothing has changed.',
        championThinking: 'Continues normal ministry.',
        ministryCoachBehavior: 'Remains silent.',
      },
      {
        situation: 'Relationship Intelligence has no meaningful new insight.',
        championThinking: 'Would not interrupt simply to restate existing information.',
        ministryCoachBehavior: 'Does not generate unnecessary summaries.',
      },
      {
        situation: 'The AI has only weak confidence and minimal context.',
        championThinking: 'Would avoid making assumptions.',
        ministryCoachBehavior: 'Acknowledges limited context or remains silent.',
      },
    ],
  },

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
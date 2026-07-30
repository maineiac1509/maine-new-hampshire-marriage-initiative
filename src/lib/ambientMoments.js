// ============================================================
// Ambient Intelligence — Ministry Moment Detection
// ============================================================
// Deterministic rules that detect meaningful ministry moments from
// existing data. Each detector returns a suggestion object or null.
// The engine orchestrates these into a single, prioritized suggestion.
//
// These are NOT AI — they are deterministic ministry rules that
// recognize when thoughtful assistance would genuinely benefit a
// Marriage Champion. The AI only enters when the user acts on a
// suggestion (e.g., clicking "Draft a message").
//
// Every moment must pass the Ministry Coach Charter's governing
// question: "Would an experienced Marriage Champion naturally offer
// help in this moment?" If not, the moment should not be detected.
// ============================================================

const DAY = 86400000;

function daysBetween(dateStr, now = new Date()) {
  if (!dateStr) return null;
  const d = new Date(dateStr.length > 10 ? dateStr : dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  return Math.floor((now.getTime() - d.getTime()) / DAY);
}

function isRecent(dateStr, maxDays) {
  const days = daysBetween(dateStr);
  return days !== null && days >= 0 && days <= maxDays;
}

function getLastCommunicationDate(activities, communicationLogs) {
  const dates = [
    ...(activities || [])
      .filter(a => a.activity_date && a.activity_type !== 'Administrative Update')
      .map(a => a.activity_date),
    ...(communicationLogs || []).map(l => l.date),
  ].filter(Boolean).sort();
  return dates[dates.length - 1] || null;
}

function formatDays(days) {
  if (days < 60) return `about ${days} days`;
  const months = Math.round(days / 30);
  if (months < 12) return `about ${months} month${months !== 1 ? 's' : ''}`;
  const years = Math.floor(days / 365);
  return `about ${years} year${years !== 1 ? 's' : ''}`;
}

// ============================================================
// Moment Detectors — each returns a suggestion or null
// ============================================================

// CRITICAL — Prayer Follow-up: prayer request shared, no follow-up yet
function detectPrayerFollowup({ reflections, activities, communicationLogs }) {
  const recentReflections = (reflections || []).filter(
    r => isRecent(r.reflection_date, 45) && r.prayer_requests?.length > 0
  );
  if (recentReflections.length === 0) return null;

  const latest = recentReflections[0];
  const prayerDate = new Date(latest.reflection_date + 'T00:00:00').getTime();
  const daysSincePrayer = Math.floor((Date.now() - prayerDate) / DAY);

  // Too soon — give them time to follow up naturally (at least 7 days)
  if (daysSincePrayer < 7) return null;

  // Check if any communication/activity happened after the prayer request
  const hasFollowup = [...(activities || []), ...(communicationLogs || [])].some(item => {
    const d = new Date((item.activity_date || item.date || '').slice(0, 10) + 'T00:00:00').getTime();
    return d > prayerDate;
  });
  if (hasFollowup) return null;

  return {
    id: 'prayer_followup',
    momentType: 'Prayer Follow-up',
    capability: 'communication_coach',
    priority: 'critical',
    secondaryWeight: 0,
    title: 'Prayer Follow-up',
    message: "They recently shared a significant prayer request. Consider following up to let them know you've been praying.",
    actionLabel: 'Draft a message',
    actionType: 'draft_message',
    actionParams: { communicationType: 'prayer_followup' },
    expiresWhen: 'after follow-up communication is logged',
  };
}

// IMPORTANT — First Contact: assigned but no communication yet
function detectFirstContact({ household, activities, communicationLogs, assignments }) {
  const activeAssignment = (assignments || []).find(a => a.assignment_status === 'Active');
  if (!activeAssignment) return null;

  const hasCommunication = (activities || []).some(a => a.activity_type !== 'Administrative Update')
    || (communicationLogs || []).length > 0;
  if (hasCommunication) return null;

  const status = household?.relationship_status;
  if (!['New', 'First Contact Needed', 'Assigned'].includes(status)) return null;

  return {
    id: 'first_contact',
    momentType: 'New Champion',
    capability: 'communication_coach',
    priority: 'important',
    secondaryWeight: 0,
    title: 'First Contact',
    message: "This champion has been assigned to you but you haven't reached out yet. Consider sending an introductory message.",
    actionLabel: 'Draft an introduction',
    actionType: 'draft_message',
    actionParams: { communicationType: 'check_in' },
    expiresWhen: 'after first communication is logged',
  };
}

// IMPORTANT — Relationship Drift: 45+ days without communication
function detectRelationshipDrift({ activities, communicationLogs }) {
  const lastCommDate = getLastCommunicationDate(activities, communicationLogs);
  if (!lastCommDate) return null;

  const daysSince = daysBetween(lastCommDate);
  if (daysSince === null || daysSince < 45) return null;

  return {
    id: 'relationship_drift',
    momentType: 'Relationship Drift',
    capability: 'communication_coach',
    priority: 'important',
    secondaryWeight: 1,
    title: 'Reconnect',
    message: `It's been ${formatDays(daysSince)} since your last conversation. This may be a good time to reconnect.`,
    actionLabel: 'Draft a message',
    actionType: 'draft_message',
    actionParams: { communicationType: daysSince >= 60 ? 'reengagement' : 'check_in' },
    expiresWhen: 'after communication is logged',
  };
}

// HELPFUL — Communication Follow-up: 30–44 days since last contact
function detectCommunicationFollowup({ activities, communicationLogs, reflections }) {
  const lastCommDate = getLastCommunicationDate(activities, communicationLogs);
  if (!lastCommDate) return null;

  const daysSince = daysBetween(lastCommDate);
  if (daysSince === null || daysSince < 30 || daysSince >= 45) return null;

  const recentReflections = (reflections || []).filter(r => isRecent(r.reflection_date, 30));
  const note = recentReflections.length > 0
    ? 'Based on recent reflections, this may be a good time to check in.'
    : 'This may be a good time to check in.';

  return {
    id: 'communication_followup',
    momentType: 'Communication Follow-up',
    capability: 'communication_coach',
    priority: 'helpful',
    secondaryWeight: 0,
    title: 'Suggested Follow-up',
    message: `It's been about ${formatDays(daysSince)} since your last conversation. ${note}`,
    actionLabel: 'Draft a message',
    actionType: 'draft_message',
    actionParams: { communicationType: 'check_in' },
    expiresWhen: 'after communication is logged',
  };
}

// HELPFUL — Reflection Opportunity: meeting completed, no reflection yet
function detectReflectionOpportunity({ activities, reflections }) {
  const recentMeetings = (activities || []).filter(
    a => isRecent(a.activity_date, 14) && ['Meeting', 'In Person'].includes(a.activity_type)
  );
  if (recentMeetings.length === 0) return null;

  const latestMeeting = recentMeetings[0];
  const meetingDate = new Date(latestMeeting.activity_date + 'T00:00:00').getTime();

  const hasReflectionAfter = (reflections || []).some(r => {
    const refDate = new Date(r.reflection_date + 'T00:00:00').getTime();
    return refDate >= meetingDate;
  });
  if (hasReflectionAfter) return null;

  return {
    id: 'reflection_opportunity',
    momentType: 'Reflection Opportunity',
    capability: 'reflection_intelligence',
    priority: 'helpful',
    secondaryWeight: 1,
    title: 'Organize Notes',
    message: "You had a meeting recently. Would you like to organize your notes while the conversation is fresh?",
    actionLabel: 'Organize notes',
    actionType: 'organize_notes',
    actionParams: {},
    expiresWhen: 'after a reflection is created',
  };
}

// HELPFUL — Resource Opportunity: recurring themes in reflections
function detectResourceOpportunity({ reflections, resourceViews, resourceFavorites }) {
  const recentReflections = (reflections || []).filter(r => isRecent(r.reflection_date, 60));
  if (recentReflections.length < 2) return null;

  // Cross-capability awareness: don't surface if resource was shared recently
  const recentResourceActivity = [...(resourceViews || []), ...(resourceFavorites || [])].some(item => {
    const d = new Date(item.viewed_date || item.created_date);
    return Date.now() - d.getTime() < 7 * DAY;
  });
  if (recentResourceActivity) return null;

  // Look for recurring themes across multiple reflections
  const allText = recentReflections
    .map(r => [r.summary, r.original_notes, ...(r.prayer_requests || []).map(p => p.request)].filter(Boolean).join(' '))
    .join(' ').toLowerCase();
  const themes = ['parenting', 'marriage', 'communication', 'spiritual growth', 'enrichment', 'leadership'];
  const hasRecurringTheme = themes.some(theme => (allText.match(new RegExp(theme, 'g')) || []).length >= 2);
  if (!hasRecurringTheme) return null;

  return {
    id: 'resource_opportunity',
    momentType: 'Resource Opportunity',
    capability: 'resource_intelligence',
    priority: 'helpful',
    secondaryWeight: 2,
    title: 'Resource Recommendation',
    message: "Based on recent conversations, a resource might encourage them right now.",
    actionLabel: 'See recommendation',
    actionType: 'view_resource',
    actionParams: {},
    expiresWhen: 'after a resource is shared or dismissed',
  };
}

// HELPFUL — Leadership Growth: champion consistently demonstrating leadership
function detectLeadershipGrowth({ reflections, household }) {
  if (household?.relationship_status !== 'Ongoing Champion') return null;

  const withLeadership = (reflections || []).filter(r => r.leadership_observations?.length > 0);
  if (withLeadership.length < 2) return null;

  return {
    id: 'leadership_growth',
    momentType: 'Leadership Growth',
    capability: 'relationship_intelligence',
    priority: 'helpful',
    secondaryWeight: 3,
    title: 'Leadership Development',
    message: "They've consistently demonstrated leadership. Consider how you might encourage their growth.",
    actionLabel: 'View stewardship guides',
    actionType: 'view_guides',
    actionParams: {},
    expiresWhen: 'after dismissed',
  };
}

// INFORMATIONAL — Celebration: anniversary or milestone
function detectCelebration({ household, milestones }) {
  if (household?.registration_date) {
    const regDate = new Date(household.registration_date + 'T00:00:00');
    const now = new Date();
    const yearsSince = now.getFullYear() - regDate.getFullYear();
    if (yearsSince >= 1 && now.getMonth() === regDate.getMonth()) {
      return {
        id: 'celebration_anniversary',
        momentType: 'Celebration',
        capability: 'communication_coach',
        priority: 'informational',
        secondaryWeight: 0,
        title: 'Ministry Anniversary',
        message: `It's been about ${yearsSince} year${yearsSince !== 1 ? 's' : ''} since this champion registered. Consider acknowledging their ministry journey.`,
        actionLabel: 'Send encouragement',
        actionType: 'draft_message',
        actionParams: { communicationType: 'congratulations' },
        expiresWhen: 'at the end of the anniversary month',
      };
    }
  }

  const recentMilestones = (milestones || []).filter(m => isRecent(m.event_date, 7));
  if (recentMilestones.length > 0) {
    return {
      id: 'celebration_milestone',
      momentType: 'Celebration',
      capability: 'communication_coach',
      priority: 'informational',
      secondaryWeight: 1,
      title: 'Milestone Celebration',
      message: `A recent milestone was recorded. Consider celebrating with a word of encouragement.`,
      actionLabel: 'Send encouragement',
      actionType: 'draft_message',
      actionParams: { communicationType: 'congratulations' },
      expiresWhen: 'after 7 days or when dismissed',
    };
  }
  return null;
}

// ============================================================
// Detect All Moments — returns array of detected suggestions
// ============================================================
export function detectAllMoments(context) {
  const detectors = [
    detectPrayerFollowup,
    detectFirstContact,
    detectRelationshipDrift,
    detectCommunicationFollowup,
    detectReflectionOpportunity,
    detectResourceOpportunity,
    detectLeadershipGrowth,
    detectCelebration,
  ];
  return detectors
    .map(d => {
      try { return d(context); } catch { return null; }
    })
    .filter(Boolean);
}
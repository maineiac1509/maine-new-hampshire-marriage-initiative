// ============================================================
// Communication Context Engine — Deterministic Opportunity Detection
// ============================================================
// Determines when the Communication Coach should surface based on
// ministry context. This is NOT AI — it is deterministic logic that
// recognizes meaningful communication opportunities from existing data.
//
// The AI only enters the picture when the user acts on a suggestion
// by clicking "Draft a message." The engine itself is silent when no
// meaningful opportunity exists.
//
// Ambient Intelligence Principle: Context drives AI, not buttons.
// ============================================================

function daysBetween(dateStr, now = new Date()) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function isRecent(dateStr, maxDays) {
  const days = daysBetween(dateStr);
  return days !== null && days <= maxDays;
}

function getLastCommunicationDate(activities, communicationLogs) {
  const dates = [
    ...(activities || [])
      .filter((a) => a.activity_date && a.activity_type !== 'Administrative Update')
      .map((a) => a.activity_date),
    ...(communicationLogs || []).map((l) => l.date),
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

/**
 * Computes communication opportunities from ministry context.
 * Returns an array of opportunities, sorted by priority, limited to 2.
 * Returns an empty array when no meaningful opportunity exists.
 */
export function computeCommunicationOpportunities({
  household,
  activities,
  reflections,
  communicationLogs,
  assignments,
}) {
  // Guardrail: if all communication preferences are restricted, stay silent.
  if (household?.do_not_call && household?.do_not_text && household?.email_opt_out) {
    return [];
  }

  const opportunities = [];

  const lastCommDate = getLastCommunicationDate(activities, communicationLogs);
  const daysSince = lastCommDate ? daysBetween(lastCommDate) : null;
  const activeAssignment = (assignments || []).find((a) => a.assignment_status === 'Active');
  const recentReflections = (reflections || []).filter((r) =>
    isRecent(r.reflection_date, 30)
  );

  // 1. First Contact Needed — assigned but no communication yet
  if (daysSince === null && activeAssignment) {
    const status = household?.relationship_status;
    if (status === 'New' || status === 'First Contact Needed' || status === 'Assigned') {
      opportunities.push({
        priority: 'high',
        title: 'First Contact',
        description:
          'This champion has been assigned but no communication has been logged yet. Consider sending an introductory message.',
        communicationType: 'check_in',
      });
    }
  }

  // 2. Stale Relationship — significant time since last communication
  if (daysSince !== null && daysSince >= 30) {
    const isHigh = daysSince >= 60;
    const reflectionNote =
      recentReflections.length > 0
        ? 'Based on recent reflections, this may be a good time to reconnect.'
        : 'This may be a good time to check in.';
    opportunities.push({
      priority: isHigh ? 'high' : 'medium',
      title: isHigh ? 'Reconnect Recommended' : 'Suggested Follow-up',
      description: `It's been ${formatDays(daysSince)} since your last conversation. ${reflectionNote}`,
      communicationType: isHigh ? 'reengagement' : 'check_in',
    });
  }

  // 3. Prayer Follow-up — recent reflection has prayer requests
  const reflectionsWithPrayer = recentReflections.filter(
    (r) => r.prayer_requests && r.prayer_requests.length > 0
  );
  if (reflectionsWithPrayer.length > 0) {
    const r = reflectionsWithPrayer[0];
    const prayerCount = r.prayer_requests.length;
    opportunities.push({
      priority: 'high',
      title: 'Prayer Follow-up',
      description: `A recent reflection noted ${prayerCount} prayer request${prayerCount !== 1 ? 's' : ''}. Consider following up to let them know you've been praying.`,
      communicationType: 'prayer_followup',
    });
  }

  // 4. Follow-up Actions — recent reflection has action items and some time has passed
  const reflectionsWithActions = recentReflections.filter(
    (r) => r.action_items && r.action_items.length > 0
  );
  if (reflectionsWithActions.length > 0 && daysSince !== null && daysSince >= 7) {
    opportunities.push({
      priority: 'medium',
      title: 'Follow-up Suggested',
      description:
        'Recent reflection notes include follow-up actions. Consider a message to check in on those items.',
      communicationType: 'meeting_followup',
    });
  }

  // 5. Registration Anniversary — acknowledge ministry journey
  if (household?.registration_date) {
    const regDate = new Date(household.registration_date);
    const now = new Date();
    const yearsSince = now.getFullYear() - regDate.getFullYear();
    const isAnniversaryMonth = now.getMonth() === regDate.getMonth();
    if (yearsSince >= 1 && isAnniversaryMonth) {
      opportunities.push({
        priority: 'low',
        title: 'Ministry Anniversary',
        description: `It's been about ${yearsSince} year${yearsSince !== 1 ? 's' : ''} since this champion registered. Consider acknowledging their ministry journey.`,
        communicationType: 'congratulations',
      });
    }
  }

  // Sort by priority and return at most 2 suggestions
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  opportunities.sort((a, b) => (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3));
  return opportunities.slice(0, 2);
}
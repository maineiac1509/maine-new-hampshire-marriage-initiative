/**
 * Deterministic resource recommendation engine.
 * Scores resources against a Champion's profile to surface
 * the most relevant ministry resources.
 *
 * Designed so Epic 7 can later add AI-powered personalization
 * by extending or replacing the scoring function.
 */
export function recommendResources(resources, { champion, activities = [], hasActiveAssignment = false }) {
  if (!resources?.length) return [];

  const status = champion?.relationship_status || '';
  const champStatus = champion?.champion_status || '';
  const hasChurch = Boolean(champion?.church_name);
  const isVolunteer = hasActiveAssignment;
  const hasPrayerActivity = (activities || []).some(
    (a) => {
      const t = (a?.activity_type || a?.type || '').toLowerCase();
      const notes = (a?.notes || a?.outcome || '').toLowerCase();
      return t.includes('prayer') || notes.includes('pray');
    },
  );

  const scored = resources
    .filter((r) => r.active !== false && !r.archived)
    .map((r) => {
      let score = 0;
      const reasons = [];

      // Featured resources get a small base boost
      if (r.featured) {
        score += 1;
        reasons.push('Featured resource');
      }

      // Weekend to Remember attendees / registrants
      if (status === 'Attended Weekend' || status === 'Registered for Weekend') {
        if (r.category === 'Weekend to Remember') {
          score += 5;
          reasons.push('For Weekend to Remember attendees');
        }
        if (Array.isArray(r.ministry_situations) && r.ministry_situations.includes('Event Follow-Up')) {
          score += 3;
        }
      }

      // New champions → Marriage + New Champion resources
      if (status === 'New' || status === 'First Contact Needed') {
        if (r.category === 'Marriage') {
          score += 3;
          reasons.push('Helpful for new champions');
        }
        if (Array.isArray(r.ministry_situations) && r.ministry_situations.includes('New Champion')) {
          score += 3;
        }
      }

      // Connected / ongoing → Marriage & Communication
      if (status === 'Connected' || status === 'Following Up' || status === 'Ongoing Champion') {
        if (r.category === 'Marriage' || r.category === 'Communication') {
          score += 2;
          reasons.push('For ongoing champion relationships');
        }
      }

      // Prayer requests → Prayer resources
      if (hasPrayerActivity || (Array.isArray(r.ministry_situations) && r.ministry_situations.includes('Prayer Request'))) {
        if (r.category === 'Prayer') {
          score += 4;
          reasons.push('Prayer support');
        }
      }

      // Church partnerships
      if (hasChurch && r.category === 'Church Partnerships') {
        score += 4;
        reasons.push('Church partnership context');
      }

      // Volunteers → Leadership / Volunteer Development
      if (isVolunteer && (r.category === 'Volunteer Development' || r.category === 'Leadership')) {
        score += 4;
        reasons.push('Volunteer development');
      }

      // Alumni → Discipleship / Leadership
      if (champStatus === 'Alumni' && (r.category === 'Discipleship' || r.category === 'Leadership')) {
        score += 3;
        reasons.push('For alumni champions');
      }

      return { resource: r, score, reasons };
    });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.resource.display_order || 100) - (b.resource.display_order || 100);
  });

  return scored.filter((s) => s.score > 0).slice(0, 6);
}
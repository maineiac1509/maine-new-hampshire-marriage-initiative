// React hook that drives the Stewardship Recommendation Engine for a user's scope.
// On data change (and page load) it:
//   1. Derives current recommendations (transparent rules).
//   2. Persists new Open recommendations.
//   3. Auto-completes recommendations whose underlying issue is gone.
//   4. Exposes the Open surface + summary counts + dismiss/complete actions.
import { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import {
  deriveRecommendations, syncRecommendations, buildSurface, buildAllSurface, summaryFrom,
} from '@/lib/recommendationEngine';

export function useRecommendationEngine({ scope, scopedTeams, households, teams, activities, currentUser }) {
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Re-run sync only when the meaningful scope data changes (or on manual refresh).
  const sig = useMemo(() => {
    const hh = (scope?.myHouseholds || []).map((h) => h.id).sort().join(',');
    const asg = (scope?.myAssignments || []).map((a) => a.id).sort().join(',');
    const act = (scope?.myActivities || []).length;
    const tm = (scopedTeams || []).map((t) => t.id).sort().join(',');
    return `${hh}|${asg}|${act}|${tm}|${refreshKey}`;
  }, [scope, scopedTeams, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    async function go() {
      if (!currentUser || !scope) return;
      const derived = deriveRecommendations({
        households: scope.myHouseholds,
        assignments: scope.myAssignments,
        teams: scopedTeams,
        activities: scope.myActivities,
      });
      const scopeHouseholdIds = new Set((scope.myHouseholds || []).map((h) => h.id));
      const scopeTeamIds = new Set((scopedTeams || []).map((t) => t.id));

      let existing = [];
      try { existing = await base44.entities.Recommendation.list(); } catch (e) {}

      const { toCreate, toComplete } = syncRecommendations({
        derived, existing, scopeHouseholdIds, scopeTeamIds,
      });

      try {
        if (toCreate.length) await base44.entities.Recommendation.bulkCreate(toCreate);
      } catch (e) {}
      try {
        if (toComplete.length) await base44.entities.Recommendation.bulkUpdate(toComplete);
      } catch (e) {}

      let fresh = [];
      try { fresh = await base44.entities.Recommendation.list(); } catch (e) {}
      const scoped = (fresh || []).filter((r) =>
        (r.household_id && scopeHouseholdIds.has(r.household_id)) ||
        (r.volunteer_team_id && scopeTeamIds.has(r.volunteer_team_id))
      );
      if (!cancelled) {
        setRecs(scoped);
        setLoading(false);
      }
    }
    go();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const dismiss = useCallback(async (id) => {
    try {
      await base44.entities.Recommendation.update(id, {
        status: 'Dismissed',
        dismissed_date: new Date().toISOString().slice(0, 10),
      });
    } catch (e) {}
    setRefreshKey((k) => k + 1);
  }, []);

  const complete = useCallback(async (id) => {
    try {
      await base44.entities.Recommendation.update(id, {
        status: 'Completed',
        completed_date: new Date().toISOString().slice(0, 10),
      });
    } catch (e) {}
    setRefreshKey((k) => k + 1);
  }, []);

  const { recommendations, allSurface, summary } = useMemo(() => {
    const derived = deriveRecommendations({
      households: scope?.myHouseholds || [],
      assignments: scope?.myAssignments || [],
      teams: scopedTeams || [],
      activities: scope?.myActivities || [],
    });
    const surface = buildSurface(recs, derived, households, teams);
    const all = buildAllSurface(recs, derived, households, teams);
    return {
      recommendations: surface,
      allSurface: all,
      summary: summaryFrom(recs, surface),
    };
  }, [recs, scope, scopedTeams, households, teams]);

  return {
    recommendations,
    allSurface,
    allScoped: recs,
    summary,
    loading,
    dismiss,
    complete,
    refresh,
  };
}
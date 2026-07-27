import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { computeStewardship } from '@/lib/stewardship';
import { useRecommendationEngine } from '@/hooks/useRecommendationEngine';
import RecommendationCard from '@/components/recommendations/RecommendationCard';
import RecommendationDetailDialog from '@/components/recommendations/RecommendationDetailDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ClipboardList } from 'lucide-react';

const STATUS_OPTIONS = ['Open', 'Dismissed', 'Completed'];

// Full recommendation history for the user's stewardship scope. Reached via the
// dashboard "Dismissed Today" / "Completed Today" drills (and direct URL).
// Open recommendations also live in the dashboard Action Center.
export default function Recommendations() {
  const [user, setUser] = useState(null);
  const [households, setHouseholds] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [activities, setActivities] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [championTimeline, setChampionTimeline] = useState([]);
  const [teamTimeline, setTeamTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('Open');
  const [detailRec, setDetailRec] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('status');
    if (s) {
      const cap = s.charAt(0).toUpperCase() + s.slice(1);
      if (STATUS_OPTIONS.includes(cap)) setStatusFilter(cap);
    }
    base44.auth.me().then(setUser).catch(() => {});
    Promise.allSettled([
      base44.entities.ChampionHousehold.list(),
      base44.entities.Assignment.list(),
      base44.entities.VolunteerTeam.list(),
      base44.entities.ChampionActivity.list(),
      base44.entities.TeamMember.list(),
      base44.entities.ChampionTimelineEvent.list(),
      base44.entities.TeamTimelineEvent.list(),
    ]).then((res) => {
      const v = (i, f = []) => (res[i].status === 'fulfilled' ? res[i].value || f : f);
      setHouseholds(v(0));
      setAssignments(v(1));
      setTeams(v(2));
      setActivities(v(3));
      setTeamMembers(v(4));
      setChampionTimeline(v(5));
      setTeamTimeline(v(6));
      setLoading(false);
    });
  }, []);

  const scope = useMemo(
    () => computeStewardship({
      user, teamMembers, assignments, households, activities,
      assignmentEvents: [], teamTimeline, championTimeline,
    }),
    [user, teamMembers, assignments, households, activities, teamTimeline, championTimeline]
  );
  const scopedTeams = scope.myTeamId ? teams.filter((t) => t.id === scope.myTeamId) : teams;
  const engine = useRecommendationEngine({ scope, scopedTeams, households, teams, activities, currentUser: user });

  const list = useMemo(
    () => engine.allSurface.filter((r) => r.status === statusFilter),
    [engine.allSurface, statusFilter]
  );

  const detailTimeline = detailRec
    ? (detailRec.volunteer_team_id && !detailRec.household_id
        ? teamTimeline.filter((e) => e.team_id === detailRec.volunteer_team_id)
        : championTimeline.filter((e) => e.household_id === detailRec.household_id))
    : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Recommendations"
        subtitle={`${list.length} ${list.length === 1 ? 'recommendation' : 'recommendations'} · ${statusFilter}`}
        actions={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading recommendations…</p>
      ) : list.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={`No ${statusFilter} recommendations`}
          description={statusFilter === 'Open'
            ? 'There are no open stewardship recommendations in your scope right now.'
            : `No recommendations have been ${statusFilter.toLowerCase()} yet.`}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {list.map((rec) => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              onSelect={setDetailRec}
              onDismiss={statusFilter === 'Open' ? engine.dismiss : undefined}
            />
          ))}
        </div>
      )}

      <RecommendationDetailDialog
        rec={detailRec}
        open={!!detailRec}
        onOpenChange={(o) => { if (!o) setDetailRec(null); }}
        onDismiss={engine.dismiss}
        onComplete={engine.complete}
        timeline={detailTimeline}
      />
    </div>
  );
}
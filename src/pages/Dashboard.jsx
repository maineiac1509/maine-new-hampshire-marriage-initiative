import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { buildAssignmentMap } from '@/lib/assignmentUtils';
import { buildActivityFeed } from '@/lib/dashboardActivity';
import { computeStewardship } from '@/lib/stewardship';
import { isAdmin } from '@/lib/permissions';
import { buildActionItems } from '@/lib/actionCenter';
import WelcomeHeader from '@/components/dashboard/WelcomeHeader';
import MinistryOverview from '@/components/dashboard/MinistryOverview';
import QuickActions from '@/components/dashboard/QuickActions';
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import ActionCenter from '@/components/dashboard/ActionCenter';
import StewardshipHealthCard from '@/components/dashboard/StewardshipHealthCard';
import RecommendationSummary from '@/components/dashboard/RecommendationSummary';
import RecommendationDetailDialog from '@/components/recommendations/RecommendationDetailDialog';
import { useRecommendationEngine } from '@/hooks/useRecommendationEngine';
import StewardshipBanner from '@/components/stewardship/StewardshipBanner';
import StewardshipSummary from '@/components/stewardship/StewardshipSummary';
import MyChampions from '@/components/stewardship/MyChampions';
import MyCurrentAssignments from '@/components/stewardship/MyCurrentAssignments';
import { EmptyState } from '@/components/ui/EmptyState';
import { Users } from 'lucide-react';

function isInCurrentMonth(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr.length > 10 ? dateStr : dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [households, setHouseholds] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [activities, setActivities] = useState([]);
  const [assignmentEvents, setAssignmentEvents] = useState([]);
  const [teamTimeline, setTeamTimeline] = useState([]);
  const [championTimeline, setChampionTimeline] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [actionReset, setActionReset] = useState(0);
  const [flash, setFlash] = useState(null);
  const [detailRec, setDetailRec] = useState(null);
  const [requestedPriority, setRequestedPriority] = useState(null);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1800);
    return () => clearTimeout(t);
  }, [flash]);

  // Smooth-scroll to an in-page section and briefly highlight it so the user
  // understands where they were taken.
  const drillTo = (target) => {
    const id = target === 'actions' ? 'db-action-center' : 'db-team-activity';
    setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setFlash(target);
    }, 60);
  };

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    Promise.allSettled([
      base44.entities.ChampionHousehold.list(),
      base44.entities.Assignment.list(),
      base44.entities.VolunteerTeam.list(),
      base44.entities.ChampionActivity.list(),
      base44.entities.AssignmentEvent.list(),
      base44.entities.TeamTimelineEvent.list(),
      base44.entities.ChampionTimelineEvent.list(),
      base44.entities.TeamMember.list(),
      base44.entities.User.list(),
    ]).then((results) => {
      const v = (i, fallback = []) => (results[i].status === 'fulfilled' ? results[i].value || fallback : fallback);
      setHouseholds(v(0));
      setAssignments(v(1));
      setTeams(v(2));
      setActivities(v(3));
      setAssignmentEvents(v(4));
      setTeamTimeline(v(5));
      setChampionTimeline(v(6));
      setTeamMembers(v(7));
      setUsers(v(8));
      setLoading(false);
    });
  }, []);

  const scope = useMemo(
    () => computeStewardship({
      user, teamMembers, assignments, households, activities,
      assignmentEvents, teamTimeline, championTimeline,
    }),
    [user, teamMembers, assignments, households, activities, assignmentEvents, teamTimeline, championTimeline]
  );

  const myTeam = useMemo(
    () => (scope.myTeamId ? teams.find((t) => t.id === scope.myTeamId) || null : null),
    [scope.myTeamId, teams]
  );
  const scopedTeams = scope.myTeamId ? teams.filter((t) => t.id === scope.myTeamId) : teams;

  const engine = useRecommendationEngine({ scope, scopedTeams, households, teams, activities, currentUser: user });

  const stewardshipDrills = {
    myChampions: () => navigate('/champions?view=my'),
    openActions: () => { setActionReset((n) => n + 1); setRequestedPriority(null); drillTo('actions'); },
    recentActivity: () => drillTo('activity'),
    completed: () => navigate(`/assignments?status=Ended&month=current${scope.myTeamId ? `&team=${scope.myTeamId}` : ''}`),
  };

  const recommendationDrills = {
    open: () => { setRequestedPriority(null); setActionReset((n) => n + 1); drillTo('actions'); },
    critical: () => { setRequestedPriority('critical'); drillTo('actions'); },
    high: () => { setRequestedPriority('high'); drillTo('actions'); },
    medium: () => { setRequestedPriority('medium'); drillTo('actions'); },
    low: () => { setRequestedPriority('low'); drillTo('actions'); },
    dismissedToday: () => navigate('/recommendations?status=dismissed'),
    completedToday: () => navigate('/recommendations?status=completed'),
  };

  const stewardshipCounts = {
    myChampions: scope.myHouseholds.length,
    openActions: engine.summary.open,
    recentActivity: scope.myActivities.filter((a) => isInCurrentMonth(a.activity_date)).length,
    completed: scope.myAssignments.filter(
      (a) => (a.assignment_status === 'Ended' || a.reassignment_flag) && (isInCurrentMonth(a.end_date) || isInCurrentMonth(a.updated_date))
    ).length,
  };

  const myFeed = useMemo(() => buildActivityFeed({
    activities: scope.myActivities, assignmentEvents: scope.myAssignmentEvents,
    teamTimeline: scope.myTeamTimeline, championTimeline: scope.myChampionTimeline,
    teamMembers: scope.myTeamMembers, households: scope.myHouseholds, teams, users,
  }), [scope, teams, users]);

  const metrics = useMemo(() => {
    const assignmentMap = buildAssignmentMap(assignments);
    return {
      active: households.filter((h) => h.status !== 'Inactive').length,
      households: households.length,
      assignments: assignments.filter((a) => a.assignment_status === 'Active').length,
      teams: teams.length,
      awaiting: households.filter((h) => !assignmentMap[h.id]?.active).length,
      closed: assignments.filter((a) => (a.assignment_status === 'Ended' || a.reassignment_flag) && (isInCurrentMonth(a.end_date) || isInCurrentMonth(a.updated_date))).length,
    };
  }, [households, assignments, teams]);

  const feed = useMemo(() => buildActivityFeed({
    activities, assignmentEvents, teamTimeline, championTimeline, teamMembers, households, teams, users,
  }), [activities, assignmentEvents, teamTimeline, championTimeline, teamMembers, households, teams, users]);

  const noChampions = !loading && households.length === 0;

  const detailTimeline = detailRec
    ? (detailRec.volunteer_team_id && !detailRec.household_id
        ? scope.myTeamTimeline.filter((e) => e.team_id === detailRec.volunteer_team_id)
        : scope.myChampionTimeline.filter((e) => e.household_id === detailRec.household_id))
    : [];

  return (
    <div className="space-y-8">
      <WelcomeHeader user={user} />

      {/* Section One: My Stewardship */}
      <section className="space-y-6 rounded-2xl border border-amber-200/60 bg-amber-50/40 p-5 shadow-sm sm:p-6">
        <StewardshipBanner user={user} team={myTeam} isAdmin={isAdmin(user) && !scope.myTeamId} />
        <StewardshipSummary counts={stewardshipCounts} onDrill={stewardshipDrills} />
        <RecommendationSummary summary={engine.summary} onDrill={recommendationDrills} />
        <div
          id="db-action-center"
          className={`scroll-mt-24 rounded-xl transition-all duration-500 ${flash === 'actions' ? 'ring-2 ring-primary ring-offset-4 ring-offset-amber-50/40' : 'ring-0'}`}
        >
          <ActionCenter
            title="My Action Center"
            subtitle="Prioritized stewardship opportunities that may need your attention."
            recommendations={engine.recommendations}
            onSelect={setDetailRec}
            onDismiss={engine.dismiss}
            resetSignal={actionReset}
            requestedPriority={requestedPriority}
          />
        </div>
        <StewardshipHealthCard
          households={scope.myHouseholds}
          activities={scope.myActivities}
          onSelect={(key) => navigate(`/champions?health=${key}${scope.myTeamId ? '&view=my' : ''}`)}
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <MyChampions
            households={scope.myHouseholds}
            assignments={scope.myAssignments}
            activities={scope.myActivities}
          />
          <MyCurrentAssignments
            assignments={scope.myActiveAssignments}
            households={scope.myHouseholds}
          />
        </div>
        <div
          id="db-team-activity"
          className={`scroll-mt-24 rounded-xl transition-all duration-500 ${flash === 'activity' ? 'ring-2 ring-primary ring-offset-4 ring-offset-amber-50/40' : 'ring-0'}`}
        >
          <ActivityFeed
            items={myFeed}
            title="My Activity"
            description="Recent stewardship activity involving your MC Relationship Builder."
            limit={10}
            emptyTitle="No activity yet"
            emptyDescription="Activity involving your MC Relationship Builder will appear here as it happens."
          />
        </div>
      </section>

      {/* Section Two: Ministry Overview */}
      <section className="space-y-6">
        <MinistryOverview metrics={metrics} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <QuickActions />
          </div>
          <div className="lg:col-span-2">
            <ActivityFeed items={feed} />
          </div>
        </div>
      </section>

      {noChampions && (
        <EmptyState
          icon={Users}
          title="Welcome to Champion Connect"
          description="Your ministry workspace is ready. Start by adding your Marriage Champions to begin building relationships."
          actionLabel="Go to Champions"
          onAction={() => { window.location.href = '/champions'; }}
        />
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
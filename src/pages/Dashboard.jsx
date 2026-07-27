import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { buildAssignmentMap } from '@/lib/assignmentUtils';
import { buildActivityFeed } from '@/lib/dashboardActivity';
import WelcomeHeader from '@/components/dashboard/WelcomeHeader';
import MinistryOverview from '@/components/dashboard/MinistryOverview';
import QuickActions from '@/components/dashboard/QuickActions';
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import ActionCenter from '@/components/dashboard/ActionCenter';
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

  const metrics = useMemo(() => {
    const assignmentMap = buildAssignmentMap(assignments);
    return {
      active: households.filter((h) => h.status !== 'Inactive').length,
      households: households.length,
      assignments: assignments.filter((a) => a.assignment_status === 'Active').length,
      teams: teams.length,
      awaiting: households.filter((h) => !assignmentMap[h.id]?.active).length,
      closed: assignments.filter((a) => a.assignment_status === 'Closed' && (isInCurrentMonth(a.end_date) || isInCurrentMonth(a.updated_date))).length,
    };
  }, [households, assignments, teams]);

  const feed = useMemo(() => buildActivityFeed({
    activities, assignmentEvents, teamTimeline, championTimeline, teamMembers, households, teams, users,
  }), [activities, assignmentEvents, teamTimeline, championTimeline, teamMembers, households, teams, users]);

  const noChampions = !loading && households.length === 0;

  return (
    <div className="space-y-8">
      <WelcomeHeader user={user} />

      <MinistryOverview metrics={metrics} />

      <ActionCenter
        households={households}
        assignments={assignments}
        teams={teams}
        activities={activities}
        teamMembers={teamMembers}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <QuickActions />
        </div>
        <div className="lg:col-span-2">
          <ActivityFeed items={feed} />
        </div>
      </div>

      {noChampions && (
        <EmptyState
          icon={Users}
          title="Welcome to Champion Connect"
          description="Your ministry workspace is ready. Start by adding your Marriage Champions to begin building relationships."
          actionLabel="Go to Champions"
          onAction={() => { window.location.href = '/champions'; }}
        />
      )}
    </div>
  );
}
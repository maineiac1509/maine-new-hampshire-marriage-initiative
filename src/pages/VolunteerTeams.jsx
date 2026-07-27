import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Users as UsersIcon, MapPin } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import TeamFormDialog from '@/components/teams/TeamFormDialog';

function teamLocation(t) {
  return [t.city, t.state].filter(Boolean).join(', ');
}

function isTeamMember(teamMembers, user) {
  if (!user) return false;
  return (teamMembers || []).some(
    (m) => m.user_id === user.id || (m.email && user.email && m.email.toLowerCase() === user.email.toLowerCase())
  );
}

export default function VolunteerTeams() {
  const [teams, setTeams] = useState([]);
  const [members, setMembers] = useState([]);
  const [champions, setChampions] = useState([]);
  const [activities, setActivities] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  function loadData() {
    setLoading(true);
    Promise.all([
      base44.entities.VolunteerTeam.list(),
      base44.entities.TeamMember.list(),
      base44.entities.ChampionHousehold.list(),
      base44.entities.ChampionActivity.list(),
    ])
      .then(([ts, ms, chs, acts]) => {
        setTeams(ts || []);
        setMembers(ms || []);
        setChampions(chs || []);
        setActivities(acts || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const membersByTeam = useMemo(() => {
    const m = {};
    (members || []).forEach((mm) => {
      (m[mm.team_id] = m[mm.team_id] || []).push(mm);
    });
    return m;
  }, [members]);

  const championsByTeam = useMemo(() => {
    const m = {};
    (champions || []).forEach((c) => {
      if (c.volunteer_team_id) (m[c.volunteer_team_id] = m[c.volunteer_team_id] || []).push(c);
    });
    return m;
  }, [champions]);

  const activitiesByHouse = useMemo(() => {
    const m = {};
    (activities || []).forEach((a) => {
      (m[a.household_id] = m[a.household_id] || []).push(a);
    });
    return m;
  }, [activities]);

  const thisMonth = new Date().toISOString().slice(0, 7);

  function recentActivityCount(teamId) {
    const chs = championsByTeam[teamId] || [];
    let count = 0;
    chs.forEach((c) => {
      (activitiesByHouse[c.id] || []).forEach((a) => {
        const d = (a.activity_date || a.created_date || '').slice(0, 7);
        if (d === thisMonth) count++;
      });
    });
    return count;
  }

  const role = currentUser?.role;
  const canManage = role === 'admin' || role === 'director';
  const isVolunteer = role && role !== 'admin' && role !== 'director';

  const filtered = useMemo(() => {
    let r = teams;
    if (isVolunteer) {
      r = r.filter((t) => isTeamMember(membersByTeam[t.id] || [], currentUser));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((t) =>
        [t.team_name, t.family_name, t.city, t.state].filter(Boolean).some((v) => v.toLowerCase().includes(q))
      );
    }
    return r;
  }, [teams, membersByTeam, currentUser, isVolunteer, search]);

  if (loading) {
    return <div className="py-20 text-center text-muted-foreground">Loading Volunteer Teams…</div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Volunteer Teams"
        subtitle={`${filtered.length} ${filtered.length === 1 ? 'Team' : 'Teams'}`}
        actions={
          canManage ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Create Team
            </Button>
          ) : undefined
        }
      />

      <TeamFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(t) => { loadData(); }}
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search teams by name or location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Team</th>
              <th className="px-4 py-3 font-medium">Members</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Champions</th>
              <th className="px-4 py-3 font-medium">Activity (mo)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const ms = membersByTeam[t.id] || [];
              const chs = championsByTeam[t.id] || [];
              const loc = teamLocation(t);
              return (
                <tr key={t.id} className="border-b last:border-0 transition-colors hover:bg-muted/40">
                  <td className="px-4 py-3.5">
                    <Link to={`/volunteer-teams/${t.id}`} className="font-medium hover:underline">
                      {t.team_name}
                    </Link>
                    {t.family_name && <p className="text-xs text-muted-foreground">{t.family_name}</p>}
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">
                    {ms.length ? ms.map((m) => m.display_name).join(', ') : '—'}
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge variant={t.active === false ? 'neutral' : 'success'}>
                      {t.active === false ? 'Inactive' : 'Active'}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">{loc || '—'}</td>
                  <td className="px-4 py-3.5 text-muted-foreground">{chs.length}</td>
                  <td className="px-4 py-3.5 text-muted-foreground">{recentActivityCount(t.id)}</td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-muted-foreground">
                  <UsersIcon className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {isVolunteer ? 'You are not a member of a Volunteer Team yet.' : 'No Volunteer Teams found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {filtered.map((t) => {
          const ms = membersByTeam[t.id] || [];
          const chs = championsByTeam[t.id] || [];
          return (
            <Link
              key={t.id}
              to={`/volunteer-teams/${t.id}`}
              className="block rounded-xl border bg-card p-4 shadow-sm transition-colors active:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-medium">{t.team_name}</span>
                  {t.family_name && <div className="text-sm text-muted-foreground">{t.family_name}</div>}
                </div>
                <StatusBadge variant={t.active === false ? 'neutral' : 'success'}>
                  {t.active === false ? 'Inactive' : 'Active'}
                </StatusBadge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Members</p>
                  <p className="truncate font-medium text-foreground">{ms.length ? ms.map((m) => m.display_name).join(', ') : 'None'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Location</p>
                  <p className="truncate font-medium text-foreground">{teamLocation(t) || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Champions</p>
                  <p className="font-medium text-foreground">{chs.length}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Activity (mo)</p>
                  <p className="font-medium text-foreground">{recentActivityCount(t.id)}</p>
                </div>
              </div>
            </Link>
          );
        })}
        {!filtered.length && (
          <EmptyState
            icon={UsersIcon}
            title={isVolunteer ? 'You are not on a team yet' : 'No Volunteer Teams yet'}
            description={isVolunteer ? 'Ask a director to add you to a Volunteer Team.' : 'Create your first Volunteer Team to begin managing Champion relationships.'}
            actionLabel={canManage ? 'Create Team' : undefined}
            onAction={canManage ? () => setCreateOpen(true) : undefined}
          />
        )}
      </div>
    </div>
  );
}
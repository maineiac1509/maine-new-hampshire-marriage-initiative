import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import TeamProfileHeader from '@/components/teams/TeamProfileHeader';
import TeamMembersCard from '@/components/teams/TeamMembersCard';
import TeamContactCard from '@/components/teams/TeamContactCard';
import CapacityCard from '@/components/teams/CapacityCard';
import TeamStatistics from '@/components/teams/TeamStatistics';
import AssignedChampionsTable from '@/components/teams/AssignedChampionsTable';
import TeamActivityFeed from '@/components/teams/TeamActivityFeed';
import GeographicCoverage from '@/components/teams/GeographicCoverage';
import TeamNotesCard from '@/components/teams/TeamNotesCard';
import { householdIndicator } from '@/lib/championUtils';
import { fmtDate } from '@/lib/teamUtils';

export default function VolunteerTeamProfile() {
  const { id } = useParams();
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [champions, setChampions] = useState([]);
  const [activities, setActivities] = useState([]);
  const [statusChanges, setStatusChanges] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [newMember, setNewMember] = useState({ user_id: '', display_name: '', email: '', team_role: 'Member', manual: false });

  function load() {
    setLoading(true);
    Promise.all([
      base44.entities.VolunteerTeam.get(id),
      base44.entities.TeamMember.filter({ team_id: id }),
      base44.entities.ChampionHousehold.filter({ volunteer_team_id: id }),
      base44.entities.Assignment.filter({ volunteer_team_id: id }),
    ])
      .then(([t, ms, chs, asgs]) => {
        setTeam(t);
        setMembers(ms || []);
        setChampions(chs || []);
        setAssignments(asgs || []);
        setNotFound(!t);
        if (t) setForm({ ...t });
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    base44.entities.User.list().then((us) => setUsers(us || [])).catch(() => {});
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, [id]);

  // Load activities + status changes for the team's Champions.
  useEffect(() => {
    if (!champions.length) { setActivities([]); setStatusChanges([]); return; }
    const ids = new Set(champions.map((c) => c.id));
    Promise.all([
      base44.entities.ChampionActivity.list(),
      base44.entities.RelationshipStatusChange.list(),
    ]).then(([acts, scs]) => {
      setActivities((acts || []).filter((a) => ids.has(a.household_id)));
      setStatusChanges((scs || []).filter((s) => ids.has(s.household_id)));
    }).catch(() => { setActivities([]); setStatusChanges([]); });
  }, [champions]);

  const role = currentUser?.role;
  const canManage = role === 'admin' || role === 'director';

  const activitiesByHouse = useMemo(() => {
    const m = {};
    (activities || []).forEach((a) => { (m[a.household_id] = m[a.household_id] || []).push(a); });
    return m;
  }, [activities]);

  const currentYear = String(new Date().getFullYear());

  const stats = useMemo(() => {
    let activeChampions = 0, newThisYear = 0, openFollowUps = 0, relationshipsStarted = 0;
    let lastActivity = '';
    const gaps = [];
    champions.forEach((c) => {
      const acts = activitiesByHouse[c.id] || [];
      if (c.relationship_status !== 'Inactive') activeChampions++;
      if ((c.registration_date || '').slice(0, 4) === currentYear) newThisYear++;
      if ((c.created_date || '').slice(0, 4) === currentYear) relationshipsStarted++;
      const ind = householdIndicator(acts);
      if (ind.key === 'overdue' || ind.key === 'due-today') openFollowUps++;
      const dates = acts.map((a) => a.activity_date).filter(Boolean).sort();
      for (let i = 1; i < dates.length; i++) {
        const d = Math.round((new Date(dates[i] + 'T00:00:00') - new Date(dates[i - 1] + 'T00:00:00')) / 86400000);
        if (d >= 0) gaps.push(d);
      }
      acts.forEach((a) => {
        const d = a.activity_date || a.created_date || '';
        if (d > lastActivity) lastActivity = d;
      });
    });
    // Average days between consecutive contacts across the team's Champions.
    const avgFollowUpDays = gaps.length ? Math.round(gaps.reduce((s, n) => s + n, 0) / gaps.length) : null;
    return {
      activeChampions,
      newThisYear,
      openFollowUps,
      relationshipsStarted,
      lastActivity: lastActivity ? fmtDate(lastActivity, true) : '—',
      avgFollowUpDays,
    };
  }, [champions, activitiesByHouse, currentYear]);

  function setField(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  async function handleSave() {
    setSaving(true);
    try {
      await base44.entities.VolunteerTeam.update(id, form);
      setEditing(false);
      load();
    } catch (e) { setSaving(false); }
  }

  async function addMember() {
    if (!newMember.display_name.trim()) return;
    try {
      const created = await base44.entities.TeamMember.create({
        team_id: id,
        display_name: newMember.display_name,
        email: newMember.email || undefined,
        user_id: newMember.user_id || undefined,
        team_role: newMember.team_role,
      });
      setMembers((ms) => [...ms, created]);
      setNewMember({ user_id: '', display_name: '', email: '', team_role: 'Member', manual: false });
    } catch (e) {}
  }

  async function removeMember(m) {
    try { await base44.entities.TeamMember.delete(m.id); setMembers((ms) => ms.filter((x) => x.id !== m.id)); } catch (e) {}
  }

  if (loading) {
    return <div className="py-20 text-center text-muted-foreground">Loading Volunteer Team…</div>;
  }
  if (notFound || !team) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/volunteer-teams"><ArrowLeft className="h-4 w-4" /> Back to Teams</Link>
        </Button>
        <p className="text-muted-foreground">Volunteer Team not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <TeamProfileHeader
        team={team}
        form={form}
        editing={editing}
        canManage={canManage}
        onEdit={() => { setForm({ ...team }); setEditing(true); }}
        onCancel={() => setEditing(false)}
        onSave={handleSave}
        saving={saving}
        onField={setField}
        memberCount={members.length}
        championCount={champions.length}
      />

      <TeamStatistics stats={stats} />

      <CapacityCard team={team} form={form} editing={editing} onField={setField} assignedCount={champions.length} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TeamMembersCard
          members={members}
          users={users}
          canManage={canManage}
          newMember={newMember}
          setNewMember={setNewMember}
          onAdd={addMember}
          onRemove={removeMember}
        />
        <TeamContactCard team={team} form={form} editing={editing} onField={setField} />
      </div>

      <AssignedChampionsTable champions={champions} activitiesByHouse={activitiesByHouse} assignments={assignments} />

      <TeamActivityFeed activities={activities} statusChanges={statusChanges} assignments={assignments} champions={champions} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GeographicCoverage team={team} form={form} editing={editing} onField={setField} />
        <TeamNotesCard team={team} form={form} editing={editing} onField={setField} />
      </div>
    </div>
  );
}
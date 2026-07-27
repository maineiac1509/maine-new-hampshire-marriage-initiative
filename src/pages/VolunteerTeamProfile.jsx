import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Users as UsersIcon, MapPin, StickyNote, Plus, Trash2,
  Save, X, Loader2, Navigation, Activity as ActivityIcon,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import RelationshipStatusBadge from '@/components/champions/RelationshipStatusBadge';
import ChampionStatusBadge from '@/components/champions/ChampionStatusBadge';
import { householdIndicator } from '@/lib/championUtils';

const TEAM_ROLES = ['Lead', 'Member'];

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function householdDisplay(h) {
  if (h.household_name) return h.household_name;
  return 'Unnamed Household';
}

function Section({ icon: Icon, title, children }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      {children}
    </section>
  );
}

function FieldRow({ label, value, onChange, editing, type = 'text' }) {
  return (
    <div className="space-y-1">
      <label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</label>
      {editing ? (
        <Input type={type} value={value ?? ''} onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)} />
      ) : (
        <p className="text-sm text-foreground">{value || '—'}</p>
      )}
    </div>
  );
}

export default function VolunteerTeamProfile() {
  const { id } = useParams();
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [champions, setChampions] = useState([]);
  const [activities, setActivities] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  // member add form
  const [newMember, setNewMember] = useState({ display_name: '', email: '', team_role: 'Member' });

  function load() {
    setLoading(true);
    Promise.all([
      base44.entities.VolunteerTeam.get(id),
      base44.entities.TeamMember.filter({ team_id: id }),
      base44.entities.ChampionHousehold.filter({ volunteer_team_id: id }),
    ])
      .then(([t, ms, chs]) => {
        setTeam(t);
        setMembers(ms || []);
        setChampions(chs || []);
        setNotFound(!t);
        if (t) setForm({ ...t });
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }

  function loadActivities() {
    base44.entities.ChampionActivity.list().then((all) => {
      const ids = new Set(champions.map((c) => c.id));
      setActivities((all || []).filter((a) => ids.has(a.household_id)));
    }).catch(() => setActivities([]));
  }

  useEffect(() => {
    load();
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (champions.length) loadActivities();
    else setActivities([]);
  }, [champions]);

  const role = currentUser?.role;
  const canManage = role === 'admin' || role === 'director';

  const activitiesByHouse = useMemo(() => {
    const m = {};
    (activities || []).forEach((a) => {
      (m[a.household_id] = m[a.household_id] || []).push(a);
    });
    return m;
  }, [activities]);

  const thisMonth = new Date().toISOString().slice(0, 7);

  const stats = useMemo(() => {
    let active = 0, inactive = 0, due = 0, overdue = 0, monthActs = 0;
    const breakdown = {};
    champions.forEach((c) => {
      const acts = activitiesByHouse[c.id] || [];
      const ind = householdIndicator(acts);
      if (c.relationship_status === 'Inactive') inactive++;
      else active++;
      if (ind.key === 'overdue' || ind.key === 'due-today') due++;
      if (ind.key === 'overdue') overdue++;
      acts.forEach((a) => {
        if ((a.activity_date || a.created_date || '').slice(0, 7) === thisMonth) monthActs++;
      });
      const s = c.relationship_status || 'New';
      breakdown[s] = (breakdown[s] || 0) + 1;
    });
    return { assigned: champions.length, active, inactive, due, overdue, monthActs, breakdown };
  }, [champions, activitiesByHouse, thisMonth]);

  const recentActivities = useMemo(() => {
    return [...(activities || [])]
      .sort((a, b) => new Date(b.activity_date || b.created_date) - new Date(a.activity_date || a.created_date))
      .slice(0, 5);
  }, [activities]);

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await base44.entities.VolunteerTeam.update(id, form);
      setEditing(false);
      load();
    } catch (e) {
      setSaving(false);
    }
  }

  async function addMember() {
    if (!newMember.display_name.trim()) return;
    try {
      const created = await base44.entities.TeamMember.create({ ...newMember, team_id: id });
      setMembers((ms) => [...ms, created]);
      setNewMember({ display_name: '', email: '', team_role: 'Member' });
    } catch (e) {}
  }

  async function removeMember(m) {
    try {
      await base44.entities.TeamMember.delete(m.id);
      setMembers((ms) => ms.filter((x) => x.id !== m.id));
    } catch (e) {}
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

  const t = editing ? form : team;
  const locationStr = [t.address, t.city, t.state, t.zip_code].filter(Boolean).join(', ');

  const statCards = [
    { label: 'Assigned Champions', value: stats.assigned },
    { label: 'Active', value: stats.active },
    { label: 'Inactive', value: stats.inactive },
    { label: 'Follow-ups Due', value: stats.due },
    { label: 'Overdue', value: stats.overdue },
    { label: 'Activities (mo)', value: stats.monthActs },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/volunteer-teams"><ArrowLeft className="h-4 w-4" /> Back to Teams</Link>
        </Button>
        {canManage && (
          editing ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={saving}>
                <X className="h-4 w-4" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => { setForm({ ...team }); setEditing(true); }}>
              <Save className="h-4 w-4" /> Edit Team
            </Button>
          )
        )}
      </div>

      {/* Header / Overview */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <UsersIcon className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            {editing ? (
              <Input
                value={t.team_name || ''}
                onChange={(e) => setField('team_name', e.target.value)}
                className="text-2xl font-bold"
              />
            ) : (
              <h1 className="text-2xl font-bold tracking-tight">{team.team_name}</h1>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge variant={team.active === false ? 'neutral' : 'success'}>
                {team.active === false ? 'Inactive' : 'Active'}
              </StatusBadge>
              <span className="text-sm text-muted-foreground">
                {members.length} {members.length === 1 ? 'member' : 'members'} · {champions.length} {champions.length === 1 ? 'Champion' : 'Champions'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Members */}
        <Section icon={UsersIcon} title="Members">
          <div className="space-y-3">
            {members.length === 0 && !canManage && (
              <p className="text-sm text-muted-foreground">No members on this team yet.</p>
            )}
            {members.map((m) => (
              <div key={m.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge variant={m.team_role === 'Lead' ? 'info' : 'neutral'}>{m.team_role}</StatusBadge>
                  {canManage && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeMember(m)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">{m.display_name}</p>
                {m.email && <p className="text-xs text-muted-foreground">{m.email}</p>}
              </div>
            ))}
            {canManage && (
              <div className="rounded-lg border border-dashed p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Add Member</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input placeholder="Display name" value={newMember.display_name} onChange={(e) => setNewMember((nm) => ({ ...nm, display_name: e.target.value }))} />
                  <Input placeholder="Email (optional)" value={newMember.email} onChange={(e) => setNewMember((nm) => ({ ...nm, email: e.target.value }))} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Select value={newMember.team_role} onValueChange={(v) => setNewMember((nm) => ({ ...nm, team_role: v }))}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TEAM_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={addMember}>
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* Location */}
        <Section icon={MapPin} title="Location">
          <dl className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><FieldRow label="Street Address" value={t.address} editing={editing} onChange={(v) => setField('address', v)} /></div>
            <FieldRow label="City" value={t.city} editing={editing} onChange={(v) => setField('city', v)} />
            <FieldRow label="State" value={t.state} editing={editing} onChange={(v) => setField('state', v)} />
            <FieldRow label="ZIP Code" value={t.zip_code} editing={editing} onChange={(v) => setField('zip_code', v)} />
            <FieldRow label="Travel Radius (mi)" value={t.travel_radius_miles} editing={editing} type="number" onChange={(v) => setField('travel_radius_miles', v)} />
            <div className="col-span-2"><FieldRow label="Latitude" value={t.latitude} editing={editing} type="number" onChange={(v) => setField('latitude', v)} /></div>
            <div className="col-span-2"><FieldRow label="Longitude" value={t.longitude} editing={editing} type="number" onChange={(v) => setField('longitude', v)} /></div>
          </dl>
          {!editing && (t.latitude != null || t.longitude != null) && (
            <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
              <Navigation className="h-3 w-3" />
              {t.latitude}, {t.longitude}
            </p>
          )}
        </Section>
      </div>

      {/* Workload Summary */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Workload Summary</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {statCards.map((s) => (
            <div key={s.label} className="rounded-lg border bg-card p-3 shadow-sm">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Relationship Status Breakdown */}
      {Object.keys(stats.breakdown).length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Relationship Status Breakdown</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.breakdown).map(([status, count]) => (
              <div key={status} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-sm">
                <RelationshipStatusBadge status={status} />
                <span className="text-sm font-semibold text-foreground">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assigned Champions */}
      <Section icon={UsersIcon} title="Assigned Champions">
        {champions.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="No Champions assigned"
            description="Champions assigned to this team will appear here."
          />
        ) : (
          <div className="space-y-2">
            {champions.map((c) => {
              const acts = activitiesByHouse[c.id] || [];
              return (
                <Link
                  key={c.id}
                  to={`/champions/${c.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{householdDisplay(c)}</p>
                    {c.city && <p className="text-xs text-muted-foreground">{c.city}{c.state ? `, ${c.state}` : ''}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <RelationshipStatusBadge status={c.relationship_status} />
                    <ChampionStatusBadge activities={acts} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Section>

      {/* Recent Activity */}
      <Section icon={ActivityIcon} title="Recent Activity">
        {recentActivities.length === 0 ? (
          <EmptyState
            icon={ActivityIcon}
            title="No recent activity"
            description="Activities logged by team members will appear here."
          />
        ) : (
          <ol className="space-y-2">
            {recentActivities.map((a) => (
              <li key={a.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{fmtDate(a.activity_date)}</span>
                  <StatusBadge variant="info">{a.activity_type}</StatusBadge>
                  {a.outcome && <StatusBadge variant="neutral">{a.outcome}</StatusBadge>}
                  <span className="ml-auto text-xs text-muted-foreground">Logged by {a.created_by || 'Unknown'}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">{a.summary}</p>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {/* Notes */}
      <Section icon={StickyNote} title="Ministry Notes">
        {editing ? (
          <Textarea value={t.ministry_notes || ''} onChange={(e) => setField('ministry_notes', e.target.value)} rows={4} placeholder="Add ministry notes about this team…" />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-foreground">{team.ministry_notes || 'No ministry notes recorded yet.'}</p>
        )}
      </Section>
    </div>
  );
}
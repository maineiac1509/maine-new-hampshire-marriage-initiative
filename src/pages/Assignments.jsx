import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, ArrowUpDown, UserCheck, CheckCircle2, PauseCircle, Archive, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { PageHeader } from '@/components/ui/PageHeader';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { buildAssignmentMap } from '@/lib/assignmentUtils';
import { householdDisplay, fmtDate } from '@/lib/teamUtils';
import { lastActivityDate } from '@/lib/championUtils';

const STATUS_VARIANT = { Active: 'success', 'On Hold': 'warning', Ended: 'neutral' };

function isInCurrentMonth(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr.length > 10 ? dateStr : dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

const COLUMNS = [
  { key: 'champion', label: 'Champion' },
  { key: 'team', label: 'Volunteer Team' },
  { key: 'status', label: 'Status' },
  { key: 'assigned_date', label: 'Assigned Date' },
  { key: 'assigned_by', label: 'Assigned By' },
  { key: 'lastActivity', label: 'Last Activity' },
];

function SummaryCard({ icon: Icon, label, value, tone, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border bg-card p-4 text-left shadow-sm transition-colors ${onClick ? 'hover:bg-muted/40' : 'cursor-default'} ${active ? 'border-primary ring-1 ring-primary' : ''}`}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${tone}`}><Icon className="h-5 w-5" /></div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </button>
  );
}

export default function Assignments() {
  const [assignments, setAssignments] = useState([]);
  const [champions, setChampions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'assigned_date', dir: 'desc' });
  const [statusFilter, setStatusFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(null);
  const [teamFilter, setTeamFilter] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('status');
    if (s) setStatusFilter(s);
    if (params.get('month') === 'current') setMonthFilter('current');
    const t = params.get('team');
    if (t) setTeamFilter(t);
  }, []);

  useEffect(() => {
    Promise.all([
      base44.entities.Assignment.list(),
      base44.entities.ChampionHousehold.list(),
      base44.entities.VolunteerTeam.list(),
      base44.entities.ChampionActivity.list(),
    ])
      .then(([asgs, chs, ts, acts]) => {
        setAssignments(asgs || []);
        setChampions(chs || []);
        setTeams(ts || []);
        setActivities(acts || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const champMap = useMemo(() => {
    const m = {};
    champions.forEach((c) => { m[c.id] = c; });
    return m;
  }, [champions]);

  const teamMap = useMemo(() => {
    const m = {};
    teams.forEach((t) => { m[t.id] = t; });
    return m;
  }, [teams]);

  const activitiesByHouse = useMemo(() => {
    const m = {};
    (activities || []).forEach((a) => { (m[a.household_id] = m[a.household_id] || []).push(a); });
    return m;
  }, [activities]);

  const assignmentMap = useMemo(() => buildAssignmentMap(assignments), [assignments]);

  const counts = useMemo(() => ({
    active: assignments.filter((a) => a.assignment_status === 'Active').length,
    onHold: assignments.filter((a) => a.assignment_status === 'On Hold').length,
    closed: assignments.filter((a) => a.assignment_status === 'Closed').length,
    unassigned: champions.filter((c) => !assignmentMap[c.id]?.active).length,
  }), [assignments, champions, assignmentMap]);

  const rows = useMemo(() => {
    let r = assignments.map((a) => {
      const champ = champMap[a.household_id];
      const acts = activitiesByHouse[a.household_id] || [];
      return {
        id: a.id,
        champion: champ ? householdDisplay(champ) : '—',
        team: teamMap[a.volunteer_team_id]?.team_name || '—',
        teamId: a.volunteer_team_id || '',
        status: a.assignment_status || '',
        assigned_by: a.assigned_by || '',
        assigned_date: a.assigned_date || '',
        lastActivity: lastActivityDate(acts) || '',
        endDate: a.end_date || '',
        updated: a.updated_date || '',
      };
    });
    if (statusFilter !== 'all') r = r.filter((row) => row.status === statusFilter);
    if (teamFilter) r = r.filter((row) => row.teamId === teamFilter);
    if (monthFilter === 'current') r = r.filter((row) => isInCurrentMonth(row.endDate || row.updated));
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((row) => [row.champion, row.team, row.assigned_by, row.status].filter(Boolean).some((v) => v.toLowerCase().includes(q)));
    }
    r.sort((a, b) => {
      const av = a[sort.key] || '';
      const bv = b[sort.key] || '';
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return r;
  }, [assignments, champMap, teamMap, activitiesByHouse, statusFilter, teamFilter, monthFilter, search, sort]);

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  }

  function clearFilters() {
    setSearch('');
    setStatusFilter('all');
    setMonthFilter(null);
    setTeamFilter(null);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Assignments"
        subtitle={`${assignments.length} ${assignments.length === 1 ? 'record' : 'records'} · ${counts.unassigned} ${counts.unassigned === 1 ? 'Champion needs' : 'Champions need'} a team`}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          icon={UserCheck}
          label="Active Assignments"
          value={counts.active}
          tone="bg-emerald-100 text-emerald-700"
          active={statusFilter === 'Active'}
          onClick={() => setStatusFilter(statusFilter === 'Active' ? 'all' : 'Active')}
        />
        <SummaryCard
          icon={PauseCircle}
          label="On Hold"
          value={counts.onHold}
          tone="bg-amber-100 text-amber-700"
          active={statusFilter === 'On Hold'}
          onClick={() => setStatusFilter(statusFilter === 'On Hold' ? 'all' : 'On Hold')}
        />
        <SummaryCard
          icon={Archive}
          label="Ended Assignments"
          value={counts.closed}
          tone="bg-slate-100 text-slate-600"
          active={statusFilter === 'Ended'}
          onClick={() => setStatusFilter(statusFilter === 'Ended' ? 'all' : 'Ended')}
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Unassigned Champions"
          value={counts.unassigned}
          tone="bg-blue-100 text-blue-700"
          onClick={() => { window.location.href = '/champions'; }}
        />
      </div>

      {loading ? (
        <div className="py-20 text-center text-muted-foreground">Loading Assignments…</div>
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="No Champion relationships have been assigned yet"
          description="Assign a Volunteer Team to a Champion to begin a stewardship relationship."
          actionLabel="Go to Champions"
          onAction={() => { window.location.href = '/champions'; }}
        />
      ) : (
        <>
          {/* Search + status filter */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by Champion, team, or assigner…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="On Hold">On Hold</SelectItem>
                <SelectItem value="Ended">Ended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matching Assignments found"
              description="No Assignments match your current search or filter."
              actionLabel="Clear filters"
              onAction={clearFilters}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      {COLUMNS.map((col) => (
                        <th key={col.key} className="cursor-pointer select-none px-4 py-3 font-medium" onClick={() => toggleSort(col.key)}>
                          <span className="inline-flex items-center gap-1">{col.label}<ArrowUpDown className="h-3 w-3 opacity-50" /></span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-b last:border-0 transition-colors hover:bg-muted/40">
                        <td className="px-4 py-3"><Link to={`/assignments/${row.id}`} className="font-medium hover:underline">{row.champion}</Link></td>
                        <td className="px-4 py-3 text-muted-foreground">{row.team}</td>
                        <td className="px-4 py-3"><StatusBadge variant={STATUS_VARIANT[row.status] || 'neutral'}>{row.status || '—'}</StatusBadge></td>
                        <td className="px-4 py-3 text-muted-foreground">{fmtDate(row.assigned_date)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.assigned_by || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{fmtDate(row.lastActivity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, ArrowUpDown, UserCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { PageHeader } from '@/components/ui/PageHeader';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { fmtDate, householdDisplay } from '@/lib/teamUtils';

const STATUS_VARIANT = { Active: 'success', 'On Hold': 'warning', Closed: 'neutral' };

const COLUMNS = [
  { key: 'champion', label: 'Champion' },
  { key: 'team', label: 'Volunteer Team' },
  { key: 'assigned_by', label: 'Assigned By' },
  { key: 'assigned_date', label: 'Assigned Date' },
  { key: 'status', label: 'Status' },
];

export default function Assignments() {
  const [assignments, setAssignments] = useState([]);
  const [champions, setChampions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'assigned_date', dir: 'desc' });

  useEffect(() => {
    Promise.all([
      base44.entities.Assignment.list(),
      base44.entities.ChampionHousehold.list(),
      base44.entities.VolunteerTeam.list(),
    ])
      .then(([asgs, chs, ts]) => {
        setAssignments(asgs || []);
        setChampions(chs || []);
        setTeams(ts || []);
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

  const rows = useMemo(() => {
    let r = assignments.map((a) => ({
      id: a.id,
      champion: champMap[a.household_id] ? householdDisplay(champMap[a.household_id]) : '—',
      team: teamMap[a.volunteer_team_id]?.team_name || '—',
      assigned_by: a.assigned_by || '',
      assigned_date: a.assigned_date || '',
      status: a.assignment_status || '',
    }));
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((row) =>
        [row.champion, row.team, row.assigned_by, row.status].filter(Boolean).some((v) => v.toLowerCase().includes(q))
      );
    }
    r.sort((a, b) => {
      const av = a[sort.key] || '';
      const bv = b[sort.key] || '';
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return r;
  }, [assignments, champMap, teamMap, search, sort]);

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Assignments"
        subtitle={`${assignments.length} ${assignments.length === 1 ? 'record' : 'records'}`}
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by Champion, team, or assigner…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="py-20 text-center text-muted-foreground">Loading Assignments…</div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title={assignments.length === 0 ? 'No assignments yet' : 'No matches found'}
          description={assignments.length === 0
            ? 'Assignments will appear here once Champions are assigned to Volunteer Teams.'
            : 'Try a different search term.'}
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
                    <td className="px-4 py-3 text-muted-foreground">{row.assigned_by || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(row.assigned_date)}</td>
                    <td className="px-4 py-3"><StatusBadge variant={STATUS_VARIANT[row.status] || 'neutral'}>{row.status || '—'}</StatusBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, Users, Upload, UserPlus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { STATUS_OPTIONS, REGISTRATION_TYPE_OPTIONS, RELATIONSHIP_STATUS_OPTIONS } from '@/lib/config';
import ImportChampionsDialog from '@/components/champions/ImportChampionsDialog';
import AddChampionDialog from '@/components/champions/AddChampionDialog';
import ChampionQuickFilters from '@/components/champions/ChampionQuickFilters';
import MyChampionsSummary from '@/components/champions/MyChampionsSummary';
import ChampionStatusBadge from '@/components/champions/ChampionStatusBadge';
import RelationshipStatusBadge from '@/components/champions/RelationshipStatusBadge';
import RelationshipStatusSummary from '@/components/champions/RelationshipStatusSummary';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  householdIndicator, lastActivityDate, nextFollowUpDate, isRecentlyContacted,
} from '@/lib/championUtils';
import { buildAssignmentMap, assignmentStatusFor } from '@/lib/assignmentUtils';
import { isAdmin } from '@/lib/permissions';
import { computeStewardshipHealth, STEWARDSHIP_HEALTH_LEVELS } from '@/lib/stewardshipHealth';
import AssignmentStatusBadge from '@/components/champions/AssignmentStatusBadge';
import CreateAssignmentDialog from '@/components/assignments/CreateAssignmentDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PAGE_SIZE = 10;

function householdDisplay(h) {
  if (h.household_name) return h.household_name;
  const ln = (h._members || []).find((m) => m.last_name)?.last_name;
  return ln ? `${ln} Household` : 'Unnamed Household';
}

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function emptyMessageFor(view) {
  switch (view) {
    case 'my': return 'No Marriage Champions are assigned to you yet.';
    case 'follow-up': return "You're all caught up — no follow-ups need attention right now.";
    case 'first-contact': return 'No Champions are waiting for first contact.';
    case 'recent': return 'No recent activity to show.';
    case 'unassigned': return 'Every Champion currently has an active Volunteer Team assignment.';
    default: return 'No Marriage Champions found.';
  }
}

export default function MarriageChampions() {
  const [households, setHouseholds] = useState([]);
  const [teams, setTeams] = useState([]);
  const [activities, setActivities] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [assignChampion, setAssignChampion] = useState(null);
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [healthFilter, setHealthFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [relStatusFilter, setRelStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState('household_name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [activeView, setActiveView] = useState('all');
  const defaultedRef = useRef(false);

  const loadData = () => {
    Promise.all([
      base44.entities.ChampionHousehold.list(),
      base44.entities.HouseholdMember.list(),
      base44.entities.ChampionActivity.list(),
      base44.entities.VolunteerTeam.list(),
      base44.entities.Assignment.list(),
      base44.entities.TeamMember.list(),
    ])
      .then(([hhs, members, acts, ts, asgs, tms]) => {
        const byHouse = {};
        members.forEach((m) => {
          if (!byHouse[m.household_id]) byHouse[m.household_id] = [];
          byHouse[m.household_id].push(m);
        });
        setHouseholds(hhs.map((h) => ({ ...h, _members: byHouse[h.id] || [] })));
        setTeams(ts || []);
        setActivities(acts || []);
        setAssignments(asgs || []);
        setTeamMembers(tms || []);
      })
      .catch(() => { setHouseholds([]); setTeams([]); setActivities([]); setAssignments([]); setTeamMembers([]); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    const healthParam = params.get('health');
    loadData();
    base44.auth.me()
      .then((u) => {
        setCurrentUser(u);
        if (!defaultedRef.current) {
          defaultedRef.current = true;
          setActiveView(viewParam || (u?.role === 'volunteer' ? 'my' : 'all'));
        }
        if (healthParam) setHealthFilter(healthParam);
      })
      .catch(() => {});
  }, []);

  const activitiesByHouse = useMemo(() => {
    const map = {};
    (activities || []).forEach((a) => {
      if (!map[a.household_id]) map[a.household_id] = [];
      map[a.household_id].push(a);
    });
    return map;
  }, [activities]);

  const teamMap = useMemo(() => {
    const m = {};
    (teams || []).forEach((t) => { m[t.id] = t; });
    return m;
  }, [teams]);

  const assignmentMap = useMemo(() => buildAssignmentMap(assignments), [assignments]);
  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'director';

  // Derive the current user's team from TeamMember records (source of truth),
  // then match champions via Assignment records — not the denormalized
  // assigned_volunteer text field on the household.
  const myTeamId = useMemo(() => {
    if (!currentUser) return null;
    const membership = (teamMembers || []).find((m) => m.user_id === currentUser.id);
    return membership?.team_id || null;
  }, [teamMembers, currentUser]);

  function isMyChampion(h) {
    if (!currentUser) return false;
    if (isAdmin(currentUser) && !myTeamId) return true;
    if (!myTeamId) return false;
    const activeAsg = assignmentMap[h.id]?.active;
    return activeAsg?.volunteer_team_id === myTeamId;
  }

  const counts = useMemo(() => {
    const c = { all: households.length, my: 0, 'first-contact': 0, 'follow-up': 0, recent: 0, unassigned: 0 };
    households.forEach((h) => {
      const acts = activitiesByHouse[h.id] || [];
      const ind = householdIndicator(acts);
      if (isMyChampion(h)) c.my++;
      if (h.status === 'New') c['first-contact']++;
      if (ind.key === 'overdue' || ind.key === 'due-today' || h.status === 'Follow-Up') c['follow-up']++;
      if (isRecentlyContacted(acts)) c.recent++;
      if (assignmentStatusFor(h.id, assignmentMap) === 'unassigned') c.unassigned++;
    });
    return c;
  }, [households, activitiesByHouse, currentUser, assignmentMap, myTeamId]);

  const myStats = useMemo(() => {
    const mine = households.filter((h) => isMyChampion(h));
    let needFirst = 0, dueToday = 0, overdue = 0, lastAct = null;
    mine.forEach((h) => {
      if (h.status === 'New') needFirst++;
      const acts = activitiesByHouse[h.id] || [];
      const ind = householdIndicator(acts);
      if (ind.key === 'due-today') dueToday++;
      if (ind.key === 'overdue') overdue++;
      const la = lastActivityDate(acts);
      if (la && (!lastAct || la > lastAct)) lastAct = la;
    });
    return { total: mine.length, needFirstContact: needFirst, dueToday, overdue, lastActivity: lastAct };
  }, [households, activitiesByHouse, currentUser, myTeamId, assignmentMap]);

  const myRelStatusCounts = useMemo(() => {
    const c = {};
    households
      .filter((h) => isMyChampion(h))
      .forEach((h) => {
        const s = h.relationship_status || 'New';
        c[s] = (c[s] || 0) + 1;
      });
    return c;
  }, [households, currentUser, myTeamId, assignmentMap]);

  const filtered = useMemo(() => {
    let result = households.filter((h) => {
      const acts = activitiesByHouse[h.id] || [];
      switch (activeView) {
        case 'my': return isMyChampion(h);
        case 'first-contact': return h.status === 'New';
        case 'follow-up': {
          const ind = householdIndicator(acts);
          return ind.key === 'overdue' || ind.key === 'due-today' || h.status === 'Follow-Up';
        }
        case 'recent': return isRecentlyContacted(acts);
        case 'unassigned': return assignmentStatusFor(h.id, assignmentMap) === 'unassigned';
        default: return true;
      }
    });
    if (assignmentFilter !== 'all') result = result.filter((h) => assignmentStatusFor(h.id, assignmentMap) === assignmentFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((h) => {
        const memberNames = (h._members || [])
          .map((m) => `${m.first_name || ''} ${m.last_name || ''}`.trim())
          .join(' ');
        return [h.household_name, h.city, h.area, h.group_name, memberNames]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(q));
      });
    }
    if (statusFilter !== 'all') result = result.filter((h) => h.status === statusFilter);
    if (typeFilter !== 'all') result = result.filter((h) => h.registration_type === typeFilter);
    if (relStatusFilter !== 'all') result = result.filter((h) => (h.relationship_status || 'New') === relStatusFilter);
    if (healthFilter !== 'all') {
      result = result.filter((h) => {
        const acts = activitiesByHouse[h.id] || [];
        return computeStewardshipHealth({
          activities: acts,
          fallbackDate: h.registration_date || h.created_date,
        }).key === healthFilter;
      });
    }
    result = [...result].sort((a, b) => {
      const av = (a[sortKey] || householdDisplay(a)).toString().toLowerCase();
      const bv = (b[sortKey] || householdDisplay(b)).toString().toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [households, activeView, currentUser, activitiesByHouse, assignmentMap, search, statusFilter, typeFilter, relStatusFilter, assignmentFilter, healthFilter, sortKey, sortDir, myTeamId]);

  useEffect(() => { setPage(1); }, [activeView, search, statusFilter, typeFilter, relStatusFilter, assignmentFilter, healthFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const emptyMessage = loading ? 'Loading…' : emptyMessageFor(activeView);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Marriage Champions"
        subtitle={`${filtered.length} ${filtered.length === 1 ? 'Champion' : 'Champions'}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" /> Import
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <UserPlus className="h-4 w-4" /> Add Champion
            </Button>
          </div>
        }
      />

      <ImportChampionsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={loadData}
      />

      <AddChampionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={loadData}
      />

      {/* Quick filter tabs */}
      <ChampionQuickFilters active={activeView} onChange={setActiveView} counts={counts} />

      {/* Search + attribute filters (respect the active quick filter) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search within the selected view…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={relStatusFilter} onValueChange={setRelStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Relationship" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All relationships</SelectItem>
            {RELATIONSHIP_STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {REGISTRATION_TYPE_OPTIONS.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Assignment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assignments</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="unassigned">Needs Assignment</SelectItem>
            <SelectItem value="ended">Stewardship Ended</SelectItem>
          </SelectContent>
        </Select>
        <Select value={healthFilter} onValueChange={setHealthFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Stewardship Health" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All health levels</SelectItem>
            {STEWARDSHIP_HEALTH_LEVELS.map((lvl) => (
              <SelectItem key={lvl.key} value={lvl.key}>{lvl.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* My Champions summaries */}
      {activeView === 'my' && (
        <div className="space-y-4">
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">My Champions Summary</h2>
            <MyChampionsSummary stats={myStats} />
          </div>
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Relationship Status</h2>
            <RelationshipStatusSummary counts={myRelStatusCounts} />
          </div>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">
                <button onClick={() => toggleSort('household_name')} className="inline-flex items-center gap-1 font-medium hover:text-foreground">
                  Marriage Champion <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3 font-medium">Relationship</th>
              <th className="px-4 py-3 font-medium">Assigned Team</th>
              <th className="px-4 py-3 font-medium">Last Contact</th>
              <th className="px-4 py-3 font-medium">Next Follow-up</th>
              <th className="px-4 py-3 font-medium">Follow-up</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((h) => {
              const acts = activitiesByHouse[h.id] || [];
              const memberNames = (h._members || [])
                .map((m) => `${m.first_name || ''} ${m.last_name || ''}`.trim())
                .join(', ');
              const aStatus = assignmentStatusFor(h.id, assignmentMap);
              const activeAsg = assignmentMap[h.id]?.active;
              const teamId = activeAsg?.volunteer_team_id;
              const teamName = teamMap[teamId]?.team_name || '';
              return (
                <tr key={h.id} className="border-b last:border-0 transition-colors hover:bg-muted/40">
                  <td className="px-4 py-3.5">
                    <Link to={`/champions/${h.id}`} className="font-medium hover:underline">
                      {householdDisplay(h)}
                    </Link>
                    {memberNames && (
                      <p className="text-xs text-muted-foreground">{memberNames}</p>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <RelationshipStatusBadge status={h.relationship_status} />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="space-y-1">
                      {teamName ? (
                        <Link to={`/volunteer-teams/${teamId}`} className="text-sm text-foreground hover:underline">{teamName}</Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                      <div className="flex items-center gap-1">
                        <AssignmentStatusBadge status={aStatus} />
                        {aStatus === 'unassigned' && canManage && (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setAssignChampion(h)}>
                            <UserPlus className="h-3 w-3" /> Assign
                          </Button>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-muted-foreground">{fmtDate(lastActivityDate(acts))}</td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-muted-foreground">{fmtDate(nextFollowUpDate(acts))}</td>
                  <td className="px-4 py-3.5">
                    <ChampionStatusBadge activities={acts} />
                  </td>
                </tr>
              );
            })}
            {!pageItems.length && (
              <tr>
                <td colSpan={6} className="px-4 py-16">
                  <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                    <Users className="h-8 w-8 opacity-40" />
                    <p className="text-sm">{emptyMessage}</p>
                    {households.length === 0 && (
                      <Button size="sm" variant="outline" className="mt-1" onClick={() => setImportOpen(true)}>
                        <Upload className="h-4 w-4" /> Import Champions
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {pageItems.map((h) => {
          const acts = activitiesByHouse[h.id] || [];
          const memberNames = (h._members || [])
            .map((m) => `${m.first_name || ''} ${m.last_name || ''}`.trim())
            .join(', ');
          return (
            <Link
              key={h.id}
              to={`/champions/${h.id}`}
              className="block rounded-xl border bg-card p-4 shadow-sm transition-colors active:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-medium">{householdDisplay(h)}</span>
                  {memberNames && (
                    <div className="mt-0.5 truncate text-sm text-muted-foreground">{memberNames}</div>
                  )}
                </div>
                <RelationshipStatusBadge status={h.relationship_status} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Assignment</p>
                  <div className="mt-0.5"><AssignmentStatusBadge status={assignmentStatusFor(h.id, assignmentMap)} /></div>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Contact</p>
                  <p className="font-medium text-foreground">{fmtDate(lastActivityDate(acts))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Next Follow-up</p>
                  <p className="font-medium text-foreground">{fmtDate(nextFollowUpDate(acts))}</p>
                </div>
                <div className="flex items-end">
                  <ChampionStatusBadge activities={acts} />
                </div>
              </div>
            </Link>
          );
        })}
        {!pageItems.length && (
          <EmptyState
            icon={Users}
            title={emptyMessage}
            description={households.length === 0 ? 'Import a list of Marriage Champions to get started.' : 'Try adjusting your search or filters.'}
            actionLabel={households.length === 0 ? 'Import Champions' : undefined}
            onAction={households.length === 0 ? () => setImportOpen(true) : undefined}
          />
        )}
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {current} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button variant="outline" size="sm" disabled={current >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <CreateAssignmentDialog
        open={!!assignChampion}
        onOpenChange={(o) => { if (!o) setAssignChampion(null); }}
        champion={assignChampion}
        currentUser={currentUser}
        onCreated={() => { setAssignChampion(null); loadData(); }}
      />
    </div>
  );
}
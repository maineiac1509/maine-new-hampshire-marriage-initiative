import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, Users, Upload } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { STATUS_OPTIONS, REGISTRATION_TYPE_OPTIONS, RELATIONSHIP_STATUS_OPTIONS } from '@/lib/config';
import ImportChampionsDialog from '@/components/champions/ImportChampionsDialog';
import ChampionQuickFilters from '@/components/champions/ChampionQuickFilters';
import MyChampionsSummary from '@/components/champions/MyChampionsSummary';
import ChampionStatusBadge from '@/components/champions/ChampionStatusBadge';
import RelationshipStatusBadge from '@/components/champions/RelationshipStatusBadge';
import RelationshipStatusSummary from '@/components/champions/RelationshipStatusSummary';
import { isAssignedTo, householdIndicator, lastActivityDate } from '@/lib/championUtils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_STYLES = {
  New: 'bg-amber-100 text-amber-700',
  'First Contact': 'bg-blue-100 text-blue-700',
  'Follow-Up': 'bg-violet-100 text-violet-700',
  Completed: 'bg-emerald-100 text-emerald-700',
  Inactive: 'bg-slate-100 text-slate-500',
};

const PAGE_SIZE = 10;

function householdDisplay(h) {
  if (h.household_name) return h.household_name;
  const ln = (h._members || []).find((m) => m.last_name)?.last_name;
  return ln ? `${ln} Household` : 'Unnamed Household';
}

export default function MarriageChampions() {
  const [households, setHouseholds] = useState([]);
  const [activities, setActivities] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [relStatusFilter, setRelStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState('household_name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [importOpen, setImportOpen] = useState(false);
  const [activeView, setActiveView] = useState('all');
  const defaultedRef = useRef(false);

  const loadData = () => {
    Promise.all([
      base44.entities.ChampionHousehold.list(),
      base44.entities.HouseholdMember.list(),
      base44.entities.ChampionActivity.list(),
    ])
      .then(([hhs, members, acts]) => {
        const byHouse = {};
        members.forEach((m) => {
          if (!byHouse[m.household_id]) byHouse[m.household_id] = [];
          byHouse[m.household_id].push(m);
        });
        setHouseholds(hhs.map((h) => ({ ...h, _members: byHouse[h.id] || [] })));
        setActivities(acts || []);
      })
      .catch(() => { setHouseholds([]); setActivities([]); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    base44.auth.me()
      .then((u) => {
        setCurrentUser(u);
        if (!defaultedRef.current) {
          defaultedRef.current = true;
          setActiveView(u?.role === 'volunteer' ? 'my' : 'all');
        }
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

  const counts = useMemo(() => {
    const c = { all: households.length, my: 0, 'first-contact': 0, 'follow-up': 0, recent: 0, unassigned: 0 };
    households.forEach((h) => {
      const ind = householdIndicator(activitiesByHouse[h.id] || []);
      if (isAssignedTo(h, currentUser)) c.my++;
      if (h.status === 'New') c['first-contact']++;
      if (ind.key === 'overdue' || ind.key === 'due-today' || h.status === 'Follow-Up') c['follow-up']++;
      if (ind.key === 'recent') c.recent++;
      if (!h.assigned_volunteer || !h.assigned_volunteer.trim()) c.unassigned++;
    });
    return c;
  }, [households, activitiesByHouse, currentUser]);

  const myStats = useMemo(() => {
    const mine = households.filter((h) => isAssignedTo(h, currentUser));
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
  }, [households, activitiesByHouse, currentUser]);

  const myRelStatusCounts = useMemo(() => {
    const c = {};
    households
      .filter((h) => isAssignedTo(h, currentUser))
      .forEach((h) => {
        const s = h.relationship_status || 'New';
        c[s] = (c[s] || 0) + 1;
      });
    return c;
  }, [households, currentUser]);

  const filtered = useMemo(() => {
    let result = households.filter((h) => {
      switch (activeView) {
        case 'my': return isAssignedTo(h, currentUser);
        case 'first-contact': return h.status === 'New';
        case 'follow-up': {
          const ind = householdIndicator(activitiesByHouse[h.id] || []);
          return ind.key === 'overdue' || ind.key === 'due-today' || h.status === 'Follow-Up';
        }
        case 'recent': return householdIndicator(activitiesByHouse[h.id] || []).key === 'recent';
        case 'unassigned': return !h.assigned_volunteer || !h.assigned_volunteer.trim();
        default: return true;
      }
    });
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
    result = [...result].sort((a, b) => {
      const av = (a[sortKey] || householdDisplay(a)).toString().toLowerCase();
      const bv = (b[sortKey] || householdDisplay(b)).toString().toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [households, activeView, currentUser, activitiesByHouse, search, statusFilter, typeFilter, relStatusFilter, sortKey, sortDir]);

  useEffect(() => { setPage(1); }, [activeView, search, statusFilter, typeFilter, relStatusFilter]);

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

  const emptyMessage = loading
    ? 'Loading…'
    : activeView === 'my'
      ? 'No champions are assigned to you yet.'
      : 'No households found.';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marriage Champions</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? 'household' : 'households'}
          </p>
        </div>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="h-4 w-4" /> Import
        </Button>
      </div>

      <ImportChampionsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={loadData}
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
              {[
                { key: 'household_name', label: 'Household' },
                { key: 'area', label: 'Area' },
                { key: 'city', label: 'City' },
                { key: 'registration_type', label: 'Type' },
                { key: 'status', label: 'Status' },
              ].map((col) => (
                <th key={col.key} className="px-4 py-3">
                  <button
                    onClick={() => toggleSort(col.key)}
                    className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                  >
                    {col.label}
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
              ))}
              <th className="px-4 py-3 font-medium">Relationship</th>
              <th className="px-4 py-3 font-medium">Follow-up</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((h) => {
              const memberNames = (h._members || [])
                .map((m) => `${m.first_name || ''} ${m.last_name || ''}`.trim())
                .join(', ');
              return (
                <tr key={h.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link to={`/champions/${h.id}`} className="font-medium hover:underline">
                      {householdDisplay(h)}
                    </Link>
                    {memberNames && (
                      <p className="text-xs text-muted-foreground">{memberNames}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{h.area || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{h.city || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{h.registration_type || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[h.status] || 'bg-slate-100'}`}>
                      {h.status || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <RelationshipStatusBadge status={h.relationship_status} />
                  </td>
                  <td className="px-4 py-3">
                    <ChampionStatusBadge activities={activitiesByHouse[h.id] || []} />
                  </td>
                </tr>
              );
            })}
            {!pageItems.length && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {pageItems.map((h) => {
          const memberNames = (h._members || [])
            .map((m) => `${m.first_name || ''} ${m.last_name || ''}`.trim())
            .join(', ');
          return (
            <Link
              key={h.id}
              to={`/champions/${h.id}`}
              className="block rounded-xl border bg-card p-4 shadow-sm active:bg-muted/50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{householdDisplay(h)}</span>
                <RelationshipStatusBadge status={h.relationship_status} />
              </div>
              {memberNames && (
                <div className="mt-1 text-sm text-muted-foreground">{memberNames}</div>
              )}
              <div className="mt-1 text-xs text-muted-foreground">
                {[h.area, h.city, h.registration_type].filter(Boolean).join(' · ') || '—'}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[h.status] || 'bg-slate-100'}`}>
                  {h.status || '—'}
                </span>
                <ChampionStatusBadge activities={activitiesByHouse[h.id] || []} />
              </div>
            </Link>
          );
        })}
        {!pageItems.length && (
          <div className="flex flex-col items-center gap-2 rounded-xl border bg-card p-10 text-center text-muted-foreground">
            <Users className="h-8 w-8" />
            {emptyMessage}
          </div>
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
    </div>
  );
}
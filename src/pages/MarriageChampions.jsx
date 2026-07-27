import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, Users, Upload } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { STATUS_OPTIONS, REGISTRATION_TYPE_OPTIONS } from '@/lib/config';
import ImportChampionsDialog from '@/components/champions/ImportChampionsDialog';
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
  const names = (h._members || [])
    .map((m) => `${m.first_name || ''} ${m.last_name || ''}`.trim())
    .filter(Boolean);
  return names.length ? names.join(' & ') : 'Unnamed Household';
}

export default function MarriageChampions() {
  const [households, setHouseholds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortKey, setSortKey] = useState('household_name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [importOpen, setImportOpen] = useState(false);

  const loadHouseholds = () => {
    Promise.all([
      base44.entities.ChampionHousehold.list(),
      base44.entities.HouseholdMember.list(),
    ])
      .then(([hhs, members]) => {
        const byHouse = {};
        members.forEach((m) => {
          if (!byHouse[m.household_id]) byHouse[m.household_id] = [];
          byHouse[m.household_id].push(m);
        });
        setHouseholds(hhs.map((h) => ({ ...h, _members: byHouse[h.id] || [] })));
      })
      .catch(() => setHouseholds([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadHouseholds();
  }, []);

  const filtered = useMemo(() => {
    let result = households;
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
    result = [...result].sort((a, b) => {
      const av = (a[sortKey] || householdDisplay(a)).toString().toLowerCase();
      const bv = (b[sortKey] || householdDisplay(b)).toString().toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [households, search, statusFilter, typeFilter, sortKey, sortDir]);

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
        onImported={loadHouseholds}
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, city, group, area…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
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
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
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
                </tr>
              );
            })}
            {!pageItems.length && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  {loading ? 'Loading…' : 'No households found.'}
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
                <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[h.status] || 'bg-slate-100'}`}>
                  {h.status || '—'}
                </span>
              </div>
              {memberNames && (
                <div className="mt-1 text-sm text-muted-foreground">{memberNames}</div>
              )}
              <div className="mt-1 text-xs text-muted-foreground">
                {[h.area, h.city, h.registration_type].filter(Boolean).join(' · ') || '—'}
              </div>
            </Link>
          );
        })}
        {!pageItems.length && (
          <div className="flex flex-col items-center gap-2 rounded-xl border bg-card p-10 text-center text-muted-foreground">
            <Users className="h-8 w-8" />
            {loading ? 'Loading…' : 'No households found.'}
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
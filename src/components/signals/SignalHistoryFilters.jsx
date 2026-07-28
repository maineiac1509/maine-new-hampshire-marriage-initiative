import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bookmark, BookmarkPlus, Filter, Trash2, X } from 'lucide-react';
import {
  SIGNAL_STATUSES, SIGNAL_SEVERITIES, SIGNAL_CATEGORIES, SIGNAL_TYPES, SIGNAL_FILTER_DEFAULTS,
} from '@/lib/signalHistory';

const STORAGE_KEY = 'ministry-signal-saved-filters';

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) { return []; }
}

function allOption(label) {
  return <SelectItem value="all">{label}</SelectItem>;
}

export default function SignalHistoryFilters({ filters, onChange, teams, regions, resultCount }) {
  const [saved, setSaved] = useState(loadSaved);
  const [name, setName] = useState('');

  function set(field, value) { onChange({ ...filters, [field]: value }); }

  function saveCurrent() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const next = [...saved.filter((s) => s.name !== trimmed), { name: trimmed, filters }];
    setSaved(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setName('');
  }

  function apply(s) { onChange({ ...SIGNAL_FILTER_DEFAULTS, ...s.filters }); }
  function remove(n) {
    const next = saved.filter((s) => s.name !== n);
    setSaved(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  const isDefault = JSON.stringify(filters) === JSON.stringify(SIGNAL_FILTER_DEFAULTS);

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Filter className="h-4 w-4 text-muted-foreground" /> Filters
        </h3>
        <span className="text-xs text-muted-foreground">{resultCount} signal(s) match</span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={filters.status} onValueChange={(v) => set('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {allOption('All statuses')}
              {SIGNAL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Severity</Label>
          <Select value={filters.severity} onValueChange={(v) => set('severity', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {allOption('All severities')}
              {SIGNAL_SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Signal Type</Label>
          <Select value={filters.signalType} onValueChange={(v) => set('signalType', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {allOption('All types')}
              {SIGNAL_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Category</Label>
          <Select value={filters.category} onValueChange={(v) => set('category', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {allOption('All categories')}
              {SIGNAL_CATEGORIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Volunteer Team</Label>
          <Select value={filters.teamId} onValueChange={(v) => set('teamId', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {allOption('All teams')}
              {(teams || []).map((t) => <SelectItem key={t.id} value={t.id}>{t.team_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Region</Label>
          <Select value={filters.region} onValueChange={(v) => set('region', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {allOption('All regions')}
              {(regions || []).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Created From</Label>
          <Input type="date" value={filters.dateFrom} onChange={(e) => set('dateFrom', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Created To</Label>
          <Input type="date" value={filters.dateTo} onChange={(e) => set('dateTo', e.target.value)} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
        <Bookmark className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Saved filters:</span>
        {saved.length ? saved.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs">
            <button className="font-medium text-foreground hover:underline" onClick={() => apply(s)}>{s.name}</button>
            <button className="text-muted-foreground hover:text-destructive" onClick={() => remove(s.name)}><X className="h-3 w-3" /></button>
          </span>
        )) : <span className="text-xs text-muted-foreground">None yet</span>}
        <div className="ml-auto flex items-center gap-2">
          <Input className="h-8 w-40 text-xs" placeholder="Filter name…" value={name} onChange={(e) => setName(e.target.value)} />
          <Button size="sm" variant="outline" onClick={saveCurrent} disabled={!name.trim() || isDefault}>
            <BookmarkPlus className="h-3.5 w-3.5" /> Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onChange(SIGNAL_FILTER_DEFAULTS)} disabled={isDefault}>
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      </div>
    </div>
  );
}
import React, { useState, useMemo } from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ShieldCheck, Lock, AlertTriangle } from 'lucide-react';
import {
  COMPARISON_RESULT_VARIANT, COMPARISON_RESULT_LABEL,
  OWNERSHIP_VARIANT, OWNERSHIP_LABEL, fieldLabel,
} from '@/lib/importLabels';
import ResolutionControls from './ResolutionControls';

const FILTERS = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'conflicts', label: 'Conflicts', test: (c) => c.requires_review || c.comparison_result === 'SHARED_VALUE_CONFLICT' },
  { key: 'safe', label: 'Safe Updates', test: (c) => c.can_auto_apply && !c.requires_review },
  { key: 'new', label: 'New Values', test: (c) => c.comparison_result === 'CREATE_NEW_RECORD_VALUE' },
  { key: 'restrictive', label: 'Restrictive', test: (c) => ['RESTRICTIVE_VALUE_ADDED', 'RESTRICTIVE_VALUE_PRESERVED'].includes(c.comparison_result) },
  { key: 'protected', label: 'Protected / Blocked', test: (c) => ['PROTECTED_FIELD_IGNORED', 'UNKNOWN_FIELD_BLOCKED', 'INVALID_INCOMING_VALUE'].includes(c.comparison_result) },
  { key: 'unresolved', label: 'Unresolved Only', test: (c, r) => !r || (c.requires_review && r.status !== 'RESOLVED') },
];

function ValueCell({ value }) {
  if (value == null || value === '') return <span className="text-muted-foreground/50">—</span>;
  return <span className="font-mono text-xs">{value}</span>;
}

// Comparison table with inline resolution controls.
// Each row shows the field, current/incoming values, and the admin's
// resolution decision with save controls.
export default function ComparisonResolutionTable({ comparisons, resolutions, onSaveResolution, showUnresolvedOnly, onFilteredIdsChange }) {
  const [filter, setFilter] = useState(showUnresolvedOnly ? 'unresolved' : 'all');
  const [search, setSearch] = useState('');

  const resolutionMap = useMemo(() => {
    const m = new Map();
    for (const r of resolutions || []) {
      if (r.status === 'PENDING' || r.status === 'RESOLVED') {
        m.set(r.field_comparison_id, r);
      }
    }
    return m;
  }, [resolutions]);

  const filtered = useMemo(() => {
    if (!comparisons) return [];
    const f = FILTERS.find((x) => x.key === filter) || FILTERS[0];
    return comparisons.filter((c) => {
      if (!f.test(c, resolutionMap.get(c.id))) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!c.canonical_field_name?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [comparisons, filter, search, resolutionMap]);

  React.useEffect(() => {
    if (onFilteredIdsChange) {
      onFilteredIdsChange(filtered.map((c) => c.id));
    }
  }, [filtered, onFilteredIdsChange]);

  const counts = useMemo(() => {
    const c = { all: comparisons?.length || 0 };
    FILTERS.forEach((f) => {
      if (f.key === 'all') return;
      c[f.key] = (comparisons || []).filter((cmp) => f.test(cmp, resolutionMap.get(cmp.id))).length;
    });
    return c;
  }, [comparisons, resolutionMap]);

  if (!comparisons?.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No field comparisons in this batch.</p>;
  }

  return (
    <div className="space-y-3">
      {/* Filters + search */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === f.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {f.label} ({counts[f.key] || 0})
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search field name…"
          className="ml-auto rounded-md border bg-background px-2 py-1 text-xs"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border">
        <div className="max-h-[600px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/80 text-left text-xs text-muted-foreground backdrop-blur">
              <tr>
                <th className="px-3 py-2 font-medium">Field</th>
                <th className="px-3 py-2 font-medium">Entity</th>
                <th className="px-3 py-2 font-medium">Ownership</th>
                <th className="px-3 py-2 font-medium">Current</th>
                <th className="px-3 py-2 font-medium">Incoming</th>
                <th className="px-3 py-2 font-medium">Result</th>
                <th className="px-3 py-2 font-medium">Resolution</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const res = resolutionMap.get(c.id);
                return (
                  <tr
                    key={c.id}
                    className={`border-t transition-colors hover:bg-muted/30 ${
                      c.requires_review ? 'bg-amber-50/30' : c.can_auto_apply ? 'bg-emerald-50/20' : ''
                    }`}
                  >
                    <td className="px-3 py-2 font-medium capitalize">{fieldLabel(c.canonical_field_name)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{c.entity_type === 'ChampionHousehold' ? 'Household' : 'Member'}</td>
                    <td className="px-3 py-2">
                      <StatusBadge variant={OWNERSHIP_VARIANT[c.ownership_category] || 'neutral'}>
                        {OWNERSHIP_LABEL[c.ownership_category] || c.ownership_category}
                      </StatusBadge>
                    </td>
                    <td className="px-3 py-2"><ValueCell value={c.current_normalized_value} /></td>
                    <td className="px-3 py-2"><ValueCell value={c.incoming_normalized_value} /></td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {c.can_auto_apply && <ShieldCheck className="h-3 w-3 text-emerald-500" />}
                        {c.requires_review && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                        {['PROTECTED_FIELD_IGNORED', 'UNKNOWN_FIELD_BLOCKED'].includes(c.comparison_result) && <Lock className="h-3 w-3 text-muted-foreground" />}
                        <StatusBadge variant={COMPARISON_RESULT_VARIANT[c.comparison_result] || 'neutral'}>
                          {COMPARISON_RESULT_LABEL[c.comparison_result] || c.comparison_result}
                        </StatusBadge>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <ResolutionControls
                        comparison={c}
                        resolution={res}
                        onSave={onSaveResolution}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {filtered.length === 0 && (
        <p className="py-4 text-center text-xs text-muted-foreground">No comparisons match this filter.</p>
      )}
      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {comparisons.length} comparisons.
      </p>
    </div>
  );
}
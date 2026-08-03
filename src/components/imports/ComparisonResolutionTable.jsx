import React, { useState, useMemo, useEffect } from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ShieldCheck, Lock, AlertTriangle } from 'lucide-react';
import {
  COMPARISON_RESULT_VARIANT, COMPARISON_RESULT_LABEL,
  OWNERSHIP_VARIANT, OWNERSHIP_LABEL, fieldLabel,
} from '@/lib/importLabels';
import { classifyComparison, COMPARISON_FILTERS } from '@/lib/comparisonClassification';
import ResolutionControls from './ResolutionControls';

function ValueCell({ value }) {
  if (value == null || value === '') return <span className="text-muted-foreground/50">—</span>;
  return <span className="font-mono text-xs">{value}</span>;
}

// Summary card for the comparison overview
function SummaryCard({ label, value, tone = 'muted' }) {
  const tones = {
    muted: 'border-border bg-muted/50 text-muted-foreground',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
  };
  return (
    <div className={`rounded-lg border p-2.5 ${tones[tone] || tones.muted}`}>
      <div className="text-lg font-semibold leading-tight">{value ?? 0}</div>
      <div className="truncate text-[11px] leading-tight opacity-80">{label}</div>
    </div>
  );
}

// Comparison table with inline resolution controls.
// Default filter is "Needs Review" — only comparisons requiring admin action.
export default function ComparisonResolutionTable({ comparisons, resolutions, onSaveResolution, onFilteredIdsChange }) {
  const [filter, setFilter] = useState('needs_review');
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

  // Classify all comparisons
  const classified = useMemo(() => {
    if (!comparisons) return [];
    return comparisons.map((c) => {
      const res = resolutionMap.get(c.id);
      return {
        comparison: c,
        resolution: res,
        category: classifyComparison(c, res),
      };
    });
  }, [comparisons, resolutionMap]);

  // Count by category
  const counts = useMemo(() => {
    const c = { needs_review: 0, all: 0, auto_resolved: 0, hidden: 0, admin_resolved: 0 };
    for (const item of classified) {
      c.all++;
      c[item.category]++;
    }
    return c;
  }, [classified]);

  // Filter
  const filtered = useMemo(() => {
    let items = classified;
    if (filter !== 'all') {
      items = items.filter((item) => item.category === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((item) =>
        item.comparison.canonical_field_name?.toLowerCase().includes(q)
      );
    }
    return items;
  }, [classified, filter, search]);

  useEffect(() => {
    if (onFilteredIdsChange) {
      onFilteredIdsChange(filtered.map((item) => item.comparison.id));
    }
  }, [filtered, onFilteredIdsChange]);

  if (!comparisons?.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No field comparisons in this batch.</p>;
  }

  return (
    <div className="space-y-3">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryCard label="Total Fields Compared" value={counts.all} />
        <SummaryCard label="Automatically Resolved" value={counts.auto_resolved} tone="emerald" />
        <SummaryCard label="Hidden (No Action)" value={counts.hidden} />
        <SummaryCard label="Requires Review" value={counts.needs_review} tone={counts.needs_review ? 'amber' : 'muted'} />
        <SummaryCard label="Resolved by Admin" value={counts.admin_resolved} tone="blue" />
      </div>

      {/* Filters + search */}
      <div className="flex flex-wrap items-center gap-2">
        {COMPARISON_FILTERS.map((f) => (
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
              {filtered.map(({ comparison: c, resolution: res, category }) => (
                <tr
                  key={c.id}
                  className={`border-t transition-colors hover:bg-muted/30 ${
                    category === 'needs_review' ? 'bg-amber-50/30' :
                    category === 'admin_resolved' ? 'bg-blue-50/20' :
                    category === 'auto_resolved' ? 'bg-emerald-50/20' : ''
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {filtered.length === 0 && (
        <p className="py-4 text-center text-xs text-muted-foreground">
          {filter === 'needs_review'
            ? 'No comparisons require administrator review. Generate defaults or check readiness to continue.'
            : 'No comparisons match this filter.'}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {comparisons.length} comparisons.
      </p>
    </div>
  );
}
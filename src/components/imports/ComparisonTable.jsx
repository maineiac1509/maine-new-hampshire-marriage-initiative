import React, { useState, useMemo } from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ShieldCheck, Lock, AlertTriangle, FileWarning } from 'lucide-react';
import {
  COMPARISON_RESULT_VARIANT, COMPARISON_RESULT_LABEL,
  RECOMMENDED_ACTION_VARIANT, RECOMMENDED_ACTION_LABEL,
  OWNERSHIP_VARIANT, OWNERSHIP_LABEL, fieldLabel,
} from '@/lib/importLabels';

// Field-level comparison table with filters.
// This is the heart of the reconciliation dashboard — admins can see
// exactly what will change, what's safe, and what needs their decision.

const FILTERS = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'new', label: 'New Values', test: (c) => c.comparison_result === 'CREATE_NEW_RECORD_VALUE' },
  { key: 'safe', label: 'Safe Updates', test: (c) => c.can_auto_apply },
  { key: 'conflicts', label: 'Conflicts & Review', test: (c) => c.requires_review || c.comparison_result === 'SHARED_VALUE_CONFLICT' },
  { key: 'protected', label: 'Protected / Blocked', test: (c) => ['PROTECTED_FIELD_IGNORED', 'UNKNOWN_FIELD_BLOCKED', 'INVALID_INCOMING_VALUE'].includes(c.comparison_result) },
  { key: 'restrictive', label: 'Restrictive', test: (c) => ['RESTRICTIVE_VALUE_ADDED', 'RESTRICTIVE_VALUE_PRESERVED'].includes(c.comparison_result) },
];

function ValueCell({ value }) {
  if (value == null || value === '') return <span className="text-muted-foreground/50">—</span>;
  return <span className="font-mono text-xs">{value}</span>;
}

export default function ComparisonTable({ comparisons }) {
  const [filter, setFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');

  const entityTypes = useMemo(() => {
    const set = new Set(comparisons?.map((c) => c.entity_type).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [comparisons]);

  const filtered = useMemo(() => {
    if (!comparisons) return [];
    const activeFilter = FILTERS.find((f) => f.key === filter) || FILTERS[0];
    return comparisons.filter((c) => {
      if (!activeFilter.test(c)) return false;
      if (entityFilter !== 'all' && c.entity_type !== entityFilter) return false;
      return true;
    });
  }, [comparisons, filter, entityFilter]);

  const counts = useMemo(() => {
    const c = { all: comparisons?.length || 0 };
    FILTERS.forEach((f) => {
      if (f.key === 'all') return;
      c[f.key] = (comparisons || []).filter(f.test).length;
    });
    return c;
  }, [comparisons]);

  if (!comparisons?.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No field comparisons in this batch.</p>;
  }

  return (
    <div className="space-y-3">
      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === f.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {f.label} ({counts[f.key] || 0})
          </button>
        ))}
        {entityTypes.length > 2 && (
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="ml-auto rounded-md border bg-background px-2 py-1 text-xs"
          >
            {entityTypes.map((t) => (
              <option key={t} value={t}>{t === 'all' ? 'All Entities' : t}</option>
            ))}
          </select>
        )}
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
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Reasoning</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className={`border-t transition-colors hover:bg-muted/30 ${
                    c.requires_review ? 'bg-amber-50/30' : c.can_auto_apply ? 'bg-emerald-50/20' : ''
                  }`}
                >
                  <td className="px-3 py-2 font-medium capitalize">{fieldLabel(c.canonical_field_name)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{c.entity_type}</td>
                  <td className="px-3 py-2">
                    <StatusBadge variant={OWNERSHIP_VARIANT[c.ownership_category] || 'neutral'}>
                      {OWNERSHIP_LABEL[c.ownership_category] || c.ownership_category}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-2"><ValueCell value={c.current_normalized_value} /></td>
                  <td className="px-3 py-2"><ValueCell value={c.incoming_normalized_value} /></td>
                  <td className="px-3 py-2">
                    <StatusBadge variant={COMPARISON_RESULT_VARIANT[c.comparison_result] || 'neutral'}>
                      {COMPARISON_RESULT_LABEL[c.comparison_result] || c.comparison_result}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      {c.can_auto_apply && <ShieldCheck className="h-3 w-3 text-emerald-500" />}
                      {c.requires_review && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                      {['PROTECTED_FIELD_IGNORED', 'UNKNOWN_FIELD_BLOCKED'].includes(c.comparison_result) && <Lock className="h-3 w-3 text-muted-foreground" />}
                      <StatusBadge variant={RECOMMENDED_ACTION_VARIANT[c.recommended_action] || 'neutral'}>
                        {RECOMMENDED_ACTION_LABEL[c.recommended_action] || c.recommended_action}
                      </StatusBadge>
                    </div>
                  </td>
                  <td className="max-w-xs px-3 py-2 text-xs text-muted-foreground">
                    {c.reasoning || '—'}
                  </td>
                </tr>
              ))}
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
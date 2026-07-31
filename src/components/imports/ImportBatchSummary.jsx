import React from 'react';
import {
  Users, UserPlus, RefreshCw, AlertTriangle, ShieldX, FileWarning,
  CheckCircle2, Layers, Ban,
} from 'lucide-react';

// Summary stat cards for a staged import batch.
// Shows the key reconciliation metrics at a glance so an admin can
// quickly understand what needs review vs. what's safe.
function StatCard({ icon: Icon, label, value, tone = 'muted' }) {
  const tones = {
    muted: 'bg-muted/50 text-muted-foreground border-border',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-3 ${tones[tone] || tones.muted}`}>
      <Icon className="h-5 w-5 shrink-0 opacity-70" />
      <div className="min-w-0">
        <div className="text-xl font-semibold leading-tight">{value ?? 0}</div>
        <div className="truncate text-[11px] leading-tight opacity-80">{label}</div>
      </div>
    </div>
  );
}

export default function ImportBatchSummary({ batch }) {
  if (!batch) return null;

  const stats = [
    { icon: Layers, label: 'Total Rows', value: batch.total_rows, tone: 'muted' },
    { icon: CheckCircle2, label: 'Valid Rows', value: batch.valid_rows, tone: batch.invalid_rows ? 'emerald' : 'muted' },
    { icon: Ban, label: 'Invalid Rows', value: batch.invalid_rows, tone: batch.invalid_rows ? 'red' : 'muted' },
    { icon: RefreshCw, label: 'Matched', value: batch.matched_rows, tone: batch.matched_rows ? 'blue' : 'muted' },
    { icon: UserPlus, label: 'New Records', value: batch.new_record_rows, tone: batch.new_record_rows ? 'emerald' : 'muted' },
    { icon: CheckCircle2, label: 'Safe Updates', value: batch.safe_update_rows, tone: batch.safe_update_rows ? 'blue' : 'muted' },
    { icon: AlertTriangle, label: 'Conflicts', value: batch.conflict_rows, tone: batch.conflict_rows ? 'amber' : 'muted' },
    { icon: Users, label: 'Possible Duplicates', value: batch.possible_duplicate_rows, tone: batch.possible_duplicate_rows ? 'amber' : 'muted' },
    { icon: ShieldX, label: 'Blocked Fields', value: batch.blocked_field_count, tone: batch.blocked_field_count ? 'red' : 'muted' },
    { icon: FileWarning, label: 'Warnings', value: batch.warning_count, tone: batch.warning_count ? 'amber' : 'muted' },
    { icon: Ban, label: 'Errors', value: batch.error_count, tone: batch.error_count ? 'red' : 'muted' },
    { icon: Ban, label: 'Blocking Errors', value: batch.blocking_error_count, tone: batch.blocking_error_count ? 'red' : 'muted' },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {stats.map((s) => (
        <StatCard key={s.label} {...s} />
      ))}
    </div>
  );
}
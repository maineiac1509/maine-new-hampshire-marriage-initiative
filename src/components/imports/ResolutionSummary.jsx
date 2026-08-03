import React from 'react';
import { CheckCircle2, AlertTriangle, Users, FileX, Ban, Layers, Clock, EyeOff, Settings } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { READINESS_STATUS_LABEL, READINESS_STATUS_VARIANT } from '@/lib/importLabels';

function ProgressStat({ icon: Icon, label, value, tone = 'muted' }) {
  const tones = {
    muted: 'bg-muted/50 text-muted-foreground border-border',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <div className={`flex items-center gap-2 rounded-lg border p-2.5 ${tones[tone] || tones.muted}`}>
      <Icon className="h-4 w-4 shrink-0 opacity-70" />
      <div className="min-w-0">
        <div className="text-lg font-semibold leading-tight">{value ?? 0}</div>
        <div className="truncate text-[11px] leading-tight opacity-80">{label}</div>
      </div>
    </div>
  );
}

export default function ResolutionSummary({ summary, comparisonSummary, readinessStatus, readinessReason }) {
  const pct = Math.round(summary?.completion_percentage || 0);
  const ready = readinessStatus === 'READY_TO_APPLY';
  const cs = comparisonSummary || { total: 0, auto_resolved: 0, hidden: 0, needs_review: 0, admin_resolved: 0 };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Resolution Progress</span>
          {readinessStatus && (
            <StatusBadge variant={READINESS_STATUS_VARIANT[readinessStatus] || 'neutral'}>
              {READINESS_STATUS_LABEL[readinessStatus] || readinessStatus}
            </StatusBadge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="h-2 w-32 overflow-hidden rounded-full bg-muted sm:w-48">
            <div
              className={`h-full transition-all ${ready ? 'bg-emerald-500' : pct >= 80 ? 'bg-blue-500' : 'bg-amber-500'}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <span className="text-sm font-semibold">{pct}%</span>
        </div>
      </div>

      {readinessReason && !ready && (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{readinessReason}</span>
        </div>
      )}

      {/* Field comparison overview */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <ProgressStat icon={Layers} label="Total Fields Compared" value={cs.total} tone="muted" />
        <ProgressStat icon={Settings} label="Automatically Resolved" value={cs.auto_resolved} tone="emerald" />
        <ProgressStat icon={EyeOff} label="Hidden (No Action)" value={cs.hidden} tone="muted" />
        <ProgressStat icon={AlertTriangle} label="Requires Review" value={cs.needs_review} tone={cs.needs_review ? 'amber' : 'muted'} />
        <ProgressStat icon={CheckCircle2} label="Resolved by Admin" value={cs.admin_resolved} tone="blue" />
      </div>

      {/* Row-level resolution progress */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <ProgressStat icon={Users} label="Unresolved Matches" value={summary?.unresolved_matches} tone={summary?.unresolved_matches ? 'amber' : 'muted'} />
        <ProgressStat icon={Ban} label="Blocking Issues" value={summary?.blocking_issues} tone={summary?.blocking_issues ? 'red' : 'muted'} />
        <ProgressStat icon={Users} label="Proposed New Records" value={summary?.proposed_new_records} tone={summary?.proposed_new_records ? 'blue' : 'muted'} />
        <ProgressStat icon={FileX} label="Discarded Records" value={summary?.discarded_records} tone="muted" />
      </div>
    </div>
  );
}
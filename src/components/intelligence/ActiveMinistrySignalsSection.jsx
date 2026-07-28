import React, { useState } from 'react';
import { Activity, AlertTriangle, Clock, CircleDot } from 'lucide-react';
import { cn } from '@/lib/utils';
import Section from '@/components/intelligence/Section';
import MinistrySignalDetailDialog from '@/components/intelligence/MinistrySignalDetailDialog';

const SEVERITY_TONE = {
  Critical: 'bg-red-100 text-red-700',
  High: 'bg-orange-100 text-orange-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low: 'bg-blue-100 text-blue-700',
  Information: 'bg-emerald-100 text-emerald-700',
};

const STATUS_TONE = {
  Open: 'bg-blue-100 text-blue-700',
  Acknowledged: 'bg-amber-100 text-amber-700',
  Resolved: 'bg-emerald-100 text-emerald-700',
};

function SignalRow({ signal, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(signal)}
      className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left shadow-sm transition-colors hover:bg-muted/40"
    >
      <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', SEVERITY_TONE[signal.severity] || SEVERITY_TONE.Medium)}>
        {signal.severity}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{signal.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {signal.category} · {signal.relatedTeams.length ? signal.relatedTeams.map((t) => t.name).join(', ') : 'Ministry-wide'}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', STATUS_TONE[signal.status] || STATUS_TONE.Open)}>
          {signal.status}
        </span>
        <span className={cn('inline-flex items-center gap-1 text-xs', signal.isAged ? 'font-medium text-red-600' : 'text-muted-foreground')}>
          <Clock className="h-3 w-3" />
          {signal.daysOpen}d open
        </span>
      </div>
    </button>
  );
}

export default function ActiveMinistrySignalsSection({ signals, summary, loading }) {
  const [selected, setSelected] = useState(null);
  return (
    <>
      <Section index={7} title="Active Ministry Signals" icon={Activity}
        summary={summary?.total
          ? `${summary.total} active signal${summary.total === 1 ? '' : 's'} — ${summary.critical} critical, ${summary.high} high, ${summary.aged} aged beyond ${summary.agingWarningDays} days.`
          : 'No active Ministry Signals — all configured thresholds are within healthy range.'}
      >
        {loading ? (
          <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">Analyzing ministry data…</div>
        ) : signals.length ? (
          <div className="space-y-2">
            {signals.map((s) => (
              <SignalRow key={s.id} signal={s} onOpen={setSelected} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-card p-8 text-center">
            <CircleDot className="h-6 w-6 text-emerald-500" />
            <p className="text-sm font-medium text-foreground">No active signals</p>
            <p className="text-xs text-muted-foreground">The ministry is operating within all configured leadership thresholds.</p>
          </div>
        )}
        {summary?.aged > 0 && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            {summary.aged} signal(s) open beyond the {14}-day aging threshold.
          </p>
        )}
      </Section>
      <MinistrySignalDetailDialog signal={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </>
  );
}
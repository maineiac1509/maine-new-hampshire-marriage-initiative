import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertOctagon, ClipboardCheck, CheckCircle2, Clock, Gauge, Lightbulb, Link2, ListChecks, Users, Award, UserCog,
} from 'lucide-react';
import { SEVERITY_COLORS, deriveOutcome } from '@/lib/signalHistory';

const OUTCOME_TONE = {
  success: 'bg-emerald-100 text-emerald-700',
  info: 'bg-blue-100 text-blue-700',
  warning: 'bg-amber-100 text-amber-700',
  neutral: 'bg-slate-100 text-slate-600',
};

function fmtDate(d) {
  if (!d) return '—';
  return String(d).slice(0, 10);
}

function Block({ icon: Icon, label, children }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}{label}
      </p>
      <div className="mt-1.5 text-sm text-foreground">{children}</div>
    </div>
  );
}

export default function SignalHistoryDetailDialog({ signal, onOpenChange }) {
  if (!signal) return null;
  const outcome = deriveOutcome(signal);
  const timeline = [
    { label: 'Created', date: signal.createdDate },
    { label: 'Acknowledged', date: signal.acknowledgedDate },
    { label: 'Resolved', date: signal.resolvedDate },
  ].filter((t) => t.date);

  return (
    <Dialog open={!!signal} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white" style={{ background: SEVERITY_COLORS[signal.severity] || '#64748b' }}>
              {signal.severity}
            </span>
            <span className="text-xs text-muted-foreground">{signal.category} · {signal.signalType}</span>
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', OUTCOME_TONE[outcome.tone])}>
              <Award className="h-3 w-3" />{outcome.label}
            </span>
          </div>
          <DialogTitle className="mt-1">{signal.title}</DialogTitle>
          {signal.description && <DialogDescription>{signal.description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4">
          {signal.whyGenerated.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <AlertOctagon className="h-3.5 w-3.5" />Why this signal was generated
              </p>
              <ul className="mt-2 space-y-1">
                {signal.whyGenerated.map((w, i) => <li key={i} className="text-xs text-foreground">{w}</li>)}
              </ul>
            </div>
          )}

          {signal.supportingMetrics.length > 0 && (
            <Block icon={Gauge} label="Supporting Metrics">
              <div className="grid grid-cols-2 gap-2">
                {signal.supportingMetrics.map((m, i) => (
                  <div key={i} className="rounded border bg-background p-2">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="text-sm font-semibold">{m.value}</p>
                  </div>
                ))}
              </div>
            </Block>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {signal.relatedTeams.length > 0 && (
              <Block icon={Users} label="Related Volunteer Teams">
                <div className="space-y-1">
                  {signal.relatedTeams.map((t) => (
                    <Link key={t.id} to={`/volunteer-teams/${t.id}`} className="block text-xs text-primary hover:underline" onClick={() => onOpenChange(false)}>
                      {t.name}{t.region ? ` · ${t.region}` : ''}
                    </Link>
                  ))}
                </div>
              </Block>
            )}
            {signal.suggestedAction && (
              <Block icon={Lightbulb} label="Suggested Leadership Action">
                <p className="text-sm">{signal.suggestedAction}</p>
              </Block>
            )}
          </div>

          <Block icon={Clock} label="Signal Timeline">
            <div className="space-y-1">
              {timeline.map((t, i) => (
                <p key={i} className="text-xs text-muted-foreground">{fmtDate(t.date)} — {t.label}{t.label === 'Resolved' && signal.resolutionTimeDays != null ? ` (${signal.resolutionTimeDays} days)` : ''}</p>
              ))}
              {signal.timeToAcknowledgeDays != null && (
                <p className="text-xs text-muted-foreground">Time to acknowledge: {signal.timeToAcknowledgeDays} days</p>
              )}
            </div>
          </Block>

          {/* Leadership Learning: actions taken + resolution notes + outcome */}
          <Block icon={UserCog} label="Leadership Action Taken">
            {signal.actions.length ? (
              <ul className="space-y-2">
                {signal.actions.map((a) => (
                  <li key={a.id} className="rounded border bg-background p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{a.assigned_to || 'Unassigned'}</span>
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', a.progress === 'Completed' ? 'bg-emerald-100 text-emerald-700' : a.progress === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600')}>
                        {a.progress || 'Not Started'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{a.due_date ? `Due ${fmtDate(a.due_date)}` : 'No due date'} · {a.priority} priority</p>
                    {a.outcome_notes && <p className="mt-1 text-xs italic text-muted-foreground">“{a.outcome_notes}”</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No leadership action items were recorded for this signal.</p>
            )}
          </Block>

          {signal.resolutionNotes && (
            <Block icon={CheckCircle2} label="Resolution Notes">
              <p className="whitespace-pre-wrap text-sm">{signal.resolutionNotes}</p>
            </Block>
          )}

          <Block icon={Award} label="Outcome">
            <p className="text-sm">
              {signal.status === 'Resolved'
                ? `This signal was resolved${signal.resolutionTimeDays != null ? ` in ${signal.resolutionTimeDays} days` : ''}. ${outcome.label}.`
                : 'This signal has not yet been resolved.'}
            </p>
          </Block>
        </div>
      </DialogContent>
    </Dialog>
  );
}
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertOctagon, ClipboardCheck, Clock, Eye, Gauge, Lightbulb, Link2, ListChecks, Users,
} from 'lucide-react';
import LeadershipActionItems from '@/components/intelligence/LeadershipActionItems';

const SEVERITY_TONE = {
  Critical: 'bg-red-100 text-red-700',
  High: 'bg-orange-100 text-orange-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low: 'bg-blue-100 text-blue-700',
  Information: 'bg-emerald-100 text-emerald-700',
};

function Stat({ icon: Icon, label, children }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}{label}
      </p>
      <div className="mt-1.5 text-sm text-foreground">{children}</div>
    </div>
  );
}

export default function MinistrySignalDetailDialog({ signal, onOpenChange }) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [, setRefreshKey] = useState(0);

  useEffect(() => {
    setNotes(signal?.resolutionNotes || '');
  }, [signal?.id]);

  if (!signal) return null;

  async function acknowledge() {
    if (!signal) return;
    setBusy(true);
    try { await base44.entities.MinistrySignal.update(signal.id, { status: 'Acknowledged', acknowledged_date: new Date().toISOString().slice(0, 10) }); }
    finally { setBusy(false); onOpenChange(false); }
  }

  async function resolve() {
    if (!signal) return;
    setBusy(true);
    try {
      await base44.entities.MinistrySignal.update(signal.id, {
        status: 'Resolved', resolved_date: new Date().toISOString().slice(0, 10), resolution_notes: notes,
      });
    } finally { setBusy(false); onOpenChange(false); }
  }

  const timeline = [
    signal.dateGenerated && { label: 'Signal generated', date: signal.dateGenerated },
    signal.acknowledgedDate && { label: 'Acknowledged', date: signal.acknowledgedDate },
    signal.resolvedDate && { label: 'Resolved', date: signal.resolvedDate },
  ].filter(Boolean);

  return (
    <Dialog open={!!signal} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', SEVERITY_TONE[signal.severity] || SEVERITY_TONE.Medium)}>
              {signal.severity}
            </span>
            <span className="text-xs text-muted-foreground">{signal.category}</span>
          </div>
          <DialogTitle className="mt-1">{signal.title}</DialogTitle>
          <DialogDescription>{signal.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5', signal.status === 'Open' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700')}>
              <Eye className="h-3 w-3" />{signal.status}
            </span>
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5', signal.isAged ? 'bg-red-100 text-red-700 font-medium' : 'bg-muted text-muted-foreground')}>
              <Clock className="h-3 w-3" />{signal.daysOpen} days open
            </span>
            {signal.daysSinceAcknowledged != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                <ClipboardCheck className="h-3 w-3" />acknowledged {signal.daysSinceAcknowledged}d ago
              </span>
            )}
          </div>

          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <AlertOctagon className="h-3.5 w-3.5" />Why this signal was generated
            </p>
            <ul className="mt-2 space-y-1">
              {signal.whyGenerated.map((w, i) => (
                <li key={i} className="text-xs text-foreground">{w}</li>
              ))}
            </ul>
          </div>

          {signal.supportingMetrics.length > 0 && (
            <Stat icon={Gauge} label="Supporting Metrics">
              <div className="grid grid-cols-2 gap-2">
                {signal.supportingMetrics.map((m, i) => (
                  <div key={i} className="rounded border bg-background p-2">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="text-sm font-semibold">{m.value}</p>
                  </div>
                ))}
              </div>
            </Stat>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {signal.relatedTeams.length > 0 && (
              <Stat icon={Users} label="Related Volunteer Teams">
                <div className="space-y-1">
                  {signal.relatedTeams.map((t) => (
                    <Link key={t.id} to={`/volunteer-teams/${t.id}`} className="block text-xs text-primary hover:underline" onClick={() => onOpenChange(false)}>
                      {t.name}
                    </Link>
                  ))}
                </div>
              </Stat>
            )}
            {signal.supportingRecommendations.length > 0 && (
              <Stat icon={ListChecks} label="Supporting Recommendations">
                <Link to="/recommendations" className="text-xs text-primary hover:underline" onClick={() => onOpenChange(false)}>
                  {signal.supportingRecommendations.length} linked recommendation(s)
                </Link>
              </Stat>
            )}
            {signal.relatedChampions.length > 0 && (
              <Stat icon={Link2} label="Related Champions">
                <div className="space-y-1">
                  {signal.relatedChampions.slice(0, 6).map((c) => (
                    <Link key={c.id} to={`/champions/${c.id}`} className="block text-xs text-primary hover:underline" onClick={() => onOpenChange(false)}>
                      {c.name}
                    </Link>
                  ))}
                </div>
              </Stat>
            )}
          </div>

          <Stat icon={Lightbulb} label="Suggested Leadership Action">
            <p className="text-sm">{signal.suggestedAction}</p>
          </Stat>

          {timeline.length > 0 && (
            <Stat icon={Clock} label="Signal Timeline">
              <div className="space-y-1">
                {timeline.map((t, i) => (
                  <p key={i} className="text-xs text-muted-foreground">{t.date} — {t.label}</p>
                ))}
              </div>
            </Stat>
          )}

          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resolution Notes</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record what leadership decided or observed…"
              rows={3}
            />
          </div>

          <LeadershipActionItems signalId={signal.id} onChanged={() => setRefreshKey((k) => k + 1)} />
        </div>

        <DialogFooter>
          {signal.status !== 'Acknowledged' && signal.status !== 'Resolved' && (
            <Button variant="outline" onClick={acknowledge} disabled={busy}>
              <ClipboardCheck className="h-4 w-4" /> Acknowledge
            </Button>
          )}
          {signal.status !== 'Resolved' && (
            <Button onClick={resolve} disabled={busy}>
              {busy ? 'Resolving…' : 'Resolve Signal'}
            </Button>
          )}
          {signal.status === 'Resolved' && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
import React from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ExternalLink, Ban, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';
import { relativeDate } from '@/lib/recommendationEngine';

const PRIORITY_VARIANT = { Critical: 'danger', High: 'warning', Medium: 'info', Low: 'neutral' };

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr.length > 10 ? dateStr : dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function Section({ title, children }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function Info({ label, value }) {
  if (!value || value === '—') return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

// Complete stewardship summary for a single recommendation. Organized into
// logical sections with consistent spacing and visual hierarchy.
export default function RecommendationDetailDialog({ rec, open, onOpenChange, onDismiss, onComplete, timeline = [] }) {
  if (!rec) return null;

  const navButtons = [];
  if (rec.household_id) navButtons.push({ label: 'Open Champion', href: `/champions/${rec.household_id}` });
  if (rec.assignment_id) navButtons.push({ label: 'Open Assignment', href: `/assignments/${rec.assignment_id}` });
  if (rec.volunteer_team_id) navButtons.push({ label: 'Open Team', href: `/volunteer-teams/${rec.volunteer_team_id}` });

  const sortedTimeline = [...timeline].sort(
    (a, b) => new Date(b.event_date || b.change_date || b.created_date || 0) - new Date(a.event_date || a.change_date || a.created_date || 0)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {rec.type}
            <StatusBadge variant={PRIORITY_VARIANT[rec.priority] || 'neutral'}>{rec.priority}</StatusBadge>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {rec.championName} · {rec.daysActive} day(s) active · Created {fmt(rec.createdDate)}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recommendation Summary + Confidence */}
          <Section title="Recommendation Summary">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">{rec.status}</span>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Confidence: {rec.confidence || 'Deterministic'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Based on explicit stewardship rules.</p>
          </Section>

          {/* Champion / Volunteer / Team context */}
          <Section title="Stewardship Context">
            <div className="grid grid-cols-2 gap-3">
              <Info label="Champion" value={rec.championName} />
              <Info label="Assigned Volunteer" value={rec.assignedVolunteer} />
              <Info label="Volunteer Team" value={rec.teamName} />
              <Info label="Last Activity" value={relativeDate(rec.lastActivityDate)?.label} />
              <Info label="Current Health" value={rec.healthLabel} />
            </div>
          </Section>

          {/* Why */}
          <Section title="Why this recommendation exists">
            <ul className="space-y-1 rounded-md bg-muted/50 p-3 text-sm text-foreground">
              {rec.why.map((w, i) => <li key={i}>• {w}</li>)}
            </ul>
          </Section>

          {/* Timeline — newest first, relative dates, full date on hover */}
          {sortedTimeline.length > 0 && (
            <Section title="Relevant Timeline Activity">
              <ul className="space-y-1 text-sm">
                {sortedTimeline.slice(0, 6).map((e, i) => {
                  const rel = relativeDate(e.event_date || e.change_date);
                  return (
                    <li key={i} className="text-muted-foreground">
                      <span className="text-foreground" title={rel?.title}>{rel?.label || '—'}</span> — {e.summary || e.event_type}
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          {/* Suggested next action */}
          <Section title="Suggested Next Action">
            <div className="flex items-start gap-1.5 text-sm text-foreground">
              <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>{rec.suggestedAction}</span>
            </div>
          </Section>
        </div>

        {/* Navigation + status actions */}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            {onDismiss && rec.status === 'Open' && (
              <Button variant="outline" size="sm" onClick={() => { onDismiss(rec.id); onOpenChange(false); }}>
                <Ban className="h-4 w-4" /> Dismiss
              </Button>
            )}
            {onComplete && rec.status === 'Open' && (
              <Button variant="outline" size="sm" onClick={() => { onComplete(rec.id); onOpenChange(false); }}>
                <CheckCircle2 className="h-4 w-4" /> Mark Completed
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {navButtons.map((b) => (
              <Button key={b.label} size="sm" asChild>
                <Link to={b.href} onClick={() => onOpenChange(false)}>
                  {b.label} <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
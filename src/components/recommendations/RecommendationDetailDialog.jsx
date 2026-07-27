import React from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ExternalLink, Ban, CheckCircle2 } from 'lucide-react';

const PRIORITY_VARIANT = { Critical: 'danger', High: 'warning', Medium: 'info', Low: 'neutral' };

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr.length > 10 ? dateStr : dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// Detailed panel for a single recommendation. Shows the summary, the explicit
// reasons it exists, supporting stewardship context, related timeline entries,
// the suggested next action, direct navigation, and status actions.
export default function RecommendationDetailDialog({ rec, open, onOpenChange, onDismiss, onComplete, timeline = [] }) {
  if (!rec) return null;

  const navButtons = [];
  if (rec.household_id) navButtons.push({ label: 'Open Champion', href: `/champions/${rec.household_id}` });
  if (rec.assignment_id) navButtons.push({ label: 'Open Assignment', href: `/assignments/${rec.assignment_id}` });
  if (rec.volunteer_team_id) navButtons.push({ label: 'Open Team', href: `/volunteer-teams/${rec.volunteer_team_id}` });

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
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why this recommendation exists</p>
            <ul className="mt-1 space-y-1 rounded-md bg-muted/50 p-3 text-sm text-foreground">
              {rec.why.map((w, i) => <li key={i}>• {w}</li>)}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Champion</p>
              <p className="font-medium text-foreground">{rec.championName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Assigned Volunteer</p>
              <p className="font-medium text-foreground">{rec.assignedVolunteer}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Volunteer Team</p>
              <p className="font-medium text-foreground">{rec.teamName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Suggested Action</p>
              <p className="font-medium text-foreground">{rec.suggestedAction}</p>
            </div>
          </div>

          {timeline.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Related Timeline</p>
              <ul className="mt-1 space-y-1 text-sm">
                {timeline.slice(0, 6).map((e, i) => (
                  <li key={i} className="text-muted-foreground">
                    <span className="text-foreground">{fmt(e.event_date || e.change_date)}</span> — {e.summary || e.event_type}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
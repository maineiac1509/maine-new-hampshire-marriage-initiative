import React from 'react';
import { CalendarClock, CalendarCheck, User, Flag, ListChecks } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// Derive the most relevant pending follow-up across activities for badge display.
// Returns one of the four standardized follow-up states.
export function getFollowUpStatus(activities) {
  const pending = (activities || []).filter((a) => a.follow_up_required && a.follow_up_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!pending.length) {
    return { label: 'No Follow-up Scheduled', variant: 'neutral', date: null };
  }
  const next = pending
    .map((a) => ({ date: new Date(a.follow_up_date + 'T00:00:00'), str: a.follow_up_date }))
    .sort((a, b) => a.date - b.date)[0];
  const diff = Math.round((next.date - today) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: 'Follow-up Overdue', variant: 'danger', date: next.str };
  if (diff === 0) return { label: 'Due Today', variant: 'warning', date: next.str };
  return { label: 'Up To Date', variant: 'success', date: next.str };
}

export default function RelationshipSummary({ activities }) {
  const sorted = [...(activities || [])].sort(
    (a, b) => new Date(b.activity_date || b.created_date) - new Date(a.activity_date || a.created_date)
  );
  const last = sorted[0];
  const followUps = (activities || [])
    .filter((a) => a.follow_up_required && a.follow_up_date)
    .map((a) => a.follow_up_date)
    .sort();
  const nextFu = followUps[0] || null;

  const stats = [
    { icon: CalendarCheck, label: 'Last Contact Date', value: fmt(last?.activity_date) },
    { icon: User, label: 'Last Contacted By', value: last?.created_by || '—' },
    { icon: Flag, label: 'Last Outcome', value: last?.outcome || '—' },
    { icon: CalendarClock, label: 'Next Follow-up Date', value: fmt(nextFu) },
    { icon: ListChecks, label: 'Total Activities', value: String((activities || []).length) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((s) => (
        <div key={s.label} className="rounded-lg border bg-card p-3 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <s.icon className="h-3.5 w-3.5" />
            {s.label}
          </div>
          <div className="mt-1 break-words text-sm font-medium text-foreground">{s.value}</div>
        </div>
      ))}
    </div>
  );
}
import React from 'react';
import { Users, UserPlus, CalendarClock, AlertTriangle, History } from 'lucide-react';

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// At-a-glance metrics for the logged-in user's assigned Champions.
export default function MyChampionsSummary({ stats }) {
  const items = [
    { icon: Users, label: 'Total Assigned', value: String(stats.total ?? 0) },
    { icon: UserPlus, label: 'Need First Contact', value: String(stats.needFirstContact ?? 0) },
    { icon: CalendarClock, label: 'Due Today', value: String(stats.dueToday ?? 0) },
    { icon: AlertTriangle, label: 'Overdue', value: String(stats.overdue ?? 0) },
    { icon: History, label: 'Last Activity', value: fmtDate(stats.lastActivity) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((it) => (
        <div key={it.label} className="rounded-lg border bg-card p-3 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <it.icon className="h-3.5 w-3.5" />
            {it.label}
          </div>
          <div className="mt-1 text-lg font-semibold text-foreground">{it.value}</div>
        </div>
      ))}
    </div>
  );
}
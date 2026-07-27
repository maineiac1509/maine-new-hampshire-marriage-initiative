import React from 'react';
import { Users, CalendarDays, AlertCircle, Clock, Timer, TrendingUp } from 'lucide-react';

export default function TeamStatistics({ stats }) {
  const cards = [
    { icon: Users, label: 'Active Champions', value: stats.activeChampions },
    { icon: CalendarDays, label: 'New This Year', value: stats.newThisYear },
    { icon: AlertCircle, label: 'Open Follow-Ups', value: stats.openFollowUps },
    { icon: Clock, label: 'Last Activity', value: stats.lastActivity },
    { icon: Timer, label: 'Avg Follow-Up Time', value: stats.avgFollowUpDays != null ? `${stats.avgFollowUpDays}d` : '—' },
    { icon: TrendingUp, label: 'Relationships Started', value: stats.relationshipsStarted },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground"><c.icon className="h-4 w-4" /></div>
          <p className="mt-2 text-2xl font-bold text-foreground">{c.value}</p>
          <p className="text-xs text-muted-foreground">{c.label}</p>
        </div>
      ))}
    </div>
  );
}
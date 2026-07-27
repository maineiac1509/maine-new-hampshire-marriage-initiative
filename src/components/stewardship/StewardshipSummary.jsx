import React from 'react';
import { Users, AlertCircle, Activity, CheckCircle2 } from 'lucide-react';

const CARDS = [
  { key: 'myChampions', label: 'My Champions', icon: Users, tone: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500' },
  { key: 'openActions', label: 'Open Action Items', icon: AlertCircle, tone: 'bg-rose-100 text-rose-700', bar: 'bg-rose-500' },
  { key: 'recentActivity', label: 'Recent Stewardship Activity', icon: Activity, tone: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' },
  { key: 'completed', label: 'Assignments Completed This Month', icon: CheckCircle2, tone: 'bg-violet-100 text-violet-700', bar: 'bg-violet-500' },
];

export default function StewardshipSummary({ counts }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {CARDS.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.key} className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm">
            <span className={`absolute inset-x-0 top-0 h-1 ${c.bar}`} />
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${c.tone}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-3xl font-bold tabular-nums text-foreground">{counts[c.key] ?? 0}</p>
                <p className="truncate text-xs text-muted-foreground">{c.label}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
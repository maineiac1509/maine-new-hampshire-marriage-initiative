import React from 'react';
import { BarChart3, FileBarChart, Users, CheckSquare, TrendingUp } from 'lucide-react';

const REPORTS = [
  {
    icon: CheckSquare,
    title: 'Contact Progress',
    description: 'Track outreach completion across volunteers and areas.',
  },
  {
    icon: Users,
    title: 'Assignment Summary',
    description: 'Champion-to-volunteer coverage and capacity overview.',
  },
  {
    icon: TrendingUp,
    title: 'Weekend Progress',
    description: 'Readiness toward the upcoming Weekend to Remember.',
  },
  {
    icon: FileBarChart,
    title: 'Volunteer Activity',
    description: 'Individual volunteer engagement and contact volume.',
  },
];

export default function Reports() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">Insights and progress tracking</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {REPORTS.map((r) => (
          <div key={r.title} className="flex flex-col rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <r.icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-sm font-semibold">{r.title}</h3>
            <p className="mt-1 flex-1 text-xs text-muted-foreground">{r.description}</p>
            <div className="mt-4 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <BarChart3 className="h-3.5 w-3.5" />
              Coming soon
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
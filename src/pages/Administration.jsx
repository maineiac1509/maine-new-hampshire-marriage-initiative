import React from 'react';
import { Settings, Upload, ListChecks } from 'lucide-react';
import VolunteerTeamsPanel from '@/components/teams/VolunteerTeamsPanel';

const SECTIONS = [
  {
    icon: Settings,
    title: 'System Settings',
    description: 'Configure app-wide preferences and event details.',
  },
  {
    icon: Upload,
    title: 'Import Data',
    description: 'Bulk import Marriage Champions from spreadsheets.',
  },
  {
    icon: ListChecks,
    title: 'Assignment Rules',
    description: 'Define matching rules for the future Assignment Engine.',
  },
];

export default function Administration() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Administration</h1>
        <p className="text-sm text-muted-foreground">System configuration and management</p>
      </div>

      <VolunteerTeamsPanel />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <div key={s.title} className="flex items-start gap-4 rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <s.icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">{s.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
              <span className="mt-3 inline-block text-xs text-muted-foreground">Coming soon</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Settings, Upload, ListChecks, UsersRound, ArrowRight } from 'lucide-react';

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          to="/users"
          className="group flex items-start gap-4 rounded-xl border bg-card p-5 shadow-sm transition-colors hover:bg-muted/40"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Users & Roles</h3>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Manage user accounts and assign Administrator or Volunteer roles.</p>
          </div>
        </Link>

        <Link
          to="/volunteer-teams"
          className="group flex items-start gap-4 rounded-xl border bg-card p-5 shadow-sm transition-colors hover:bg-muted/40"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <UsersRound className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Volunteer Teams</h3>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Manage volunteer teams, members, and Champion assignments.</p>
          </div>
        </Link>

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
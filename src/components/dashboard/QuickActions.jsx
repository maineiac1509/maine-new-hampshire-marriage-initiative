import React from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, ClipboardList, LayoutDashboard, Users2, BookOpen } from 'lucide-react';

const ACTIONS = [
  { label: 'New Champion', icon: UserPlus, to: '/champions' },
  { label: 'Assign Champion', icon: ClipboardList, to: '/champions' },
  { label: 'View Assignment Workspace', icon: LayoutDashboard, to: '/assignments' },
  { label: 'Volunteer Teams', icon: Users2, to: '/volunteer-teams' },
  { label: 'Champion Directory', icon: BookOpen, to: '/champions' },
];

export default function QuickActions() {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quick Actions</h2>
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.label}
              to={a.to}
              className="flex w-full items-center gap-3 rounded-lg border bg-background px-4 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{a.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
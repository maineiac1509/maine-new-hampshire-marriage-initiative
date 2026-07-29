import React from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, ClipboardList, BookOpen, Users2, LayoutDashboard } from 'lucide-react';

const ACTIONS = [
  { label: 'New Champion', desc: 'Add a new Champion household.', icon: UserPlus, to: '/champions' },
  { label: 'Assign Champion', desc: 'Connect a Champion with an MC Relationship Builder.', icon: ClipboardList, to: '/champions' },
  { label: 'Champion Directory', desc: 'Browse and manage Champion profiles.', icon: BookOpen, to: '/champions' },
  { label: 'MC Relationship Builders', desc: 'View and manage MC Relationship Builders.', icon: Users2, to: '/volunteer-teams' },
  { label: 'Assignment Workspace', desc: 'Manage active and closed Assignments.', icon: LayoutDashboard, to: '/assignments' },
];

export default function QuickActions() {
  return (
    <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Quick Actions</h2>
        <p className="text-sm text-muted-foreground">Launch the most common ministry tasks with one click.</p>
      </div>
      <div className="space-y-2.5">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.label}
              to={a.to}
              className="flex w-full items-center gap-3 rounded-lg border bg-background px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{a.label}</p>
                <p className="truncate text-xs text-muted-foreground">{a.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
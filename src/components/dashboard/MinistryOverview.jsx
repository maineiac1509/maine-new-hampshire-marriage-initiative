import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Home, UserCheck, Users2, UserPlus, Archive } from 'lucide-react';

const CARDS = [
  { key: 'active', label: 'Active Champions', icon: Users, tone: 'bg-emerald-100 text-emerald-700', to: '/champions' },
  { key: 'households', label: 'Households', icon: Home, tone: 'bg-blue-100 text-blue-700', to: '/champions' },
  { key: 'assignments', label: 'Active Assignments', icon: UserCheck, tone: 'bg-violet-100 text-violet-700', to: '/assignments' },
  { key: 'teams', label: 'Volunteer Teams', icon: Users2, tone: 'bg-amber-100 text-amber-700', to: '/volunteer-teams' },
  { key: 'awaiting', label: 'Champions Awaiting Assignment', icon: UserPlus, tone: 'bg-rose-100 text-rose-700', to: '/champions' },
  { key: 'closed', label: 'Assignments Closed This Month', icon: Archive, tone: 'bg-slate-100 text-slate-600', to: '/assignments' },
];

export default function MinistryOverview({ metrics }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {CARDS.map((c) => {
        const Icon = c.icon;
        return (
          <Link
            key={c.key}
            to={c.to}
            className="flex items-center gap-4 rounded-xl border bg-card p-5 shadow-sm transition-colors hover:bg-muted/40"
          >
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${c.tone}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-3xl font-bold tabular-nums text-foreground">{metrics[c.key] ?? 0}</p>
              <p className="truncate text-sm text-muted-foreground">{c.label}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
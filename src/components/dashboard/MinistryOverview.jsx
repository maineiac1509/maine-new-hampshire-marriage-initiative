import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Home, UserCheck, Users2, UserPlus, Archive } from 'lucide-react';

const CARDS = [
  { key: 'active', label: 'Active Champions', icon: Users, tone: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500', to: '/champions' },
  { key: 'households', label: 'Households', icon: Home, tone: 'bg-blue-100 text-blue-700', bar: 'bg-blue-500', to: '/champions' },
  { key: 'assignments', label: 'Active Assignments', icon: UserCheck, tone: 'bg-violet-100 text-violet-700', bar: 'bg-violet-500', to: '/assignments?status=Active' },
  { key: 'teams', label: 'MC Relationship Builders', icon: Users2, tone: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500', to: '/volunteer-teams' },
  { key: 'awaiting', label: 'Champions Awaiting Assignment', icon: UserPlus, tone: 'bg-rose-100 text-rose-700', bar: 'bg-rose-500', to: '/champions?view=unassigned' },
  { key: 'closed', label: 'Stewardship Changes This Month', icon: Archive, tone: 'bg-slate-100 text-slate-600', bar: 'bg-slate-400', to: '/assignments?status=Ended&month=current' },
];

export default function MinistryOverview({ metrics }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Ministry Overview</h2>
        <p className="text-sm text-muted-foreground">A snapshot of the current health and activity of the ministry.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.key}
              to={c.to}
              className="group relative cursor-pointer overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span className={`absolute inset-x-0 top-0 h-1 ${c.bar}`} />
              <div className="flex items-center gap-4">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${c.tone}`}>
                  <Icon className="h-7 w-7" />
                </div>
                <div className="min-w-0">
                  <p className="text-4xl font-bold tabular-nums text-foreground">{metrics[c.key] ?? 0}</p>
                  <p className="truncate text-sm text-muted-foreground">{c.label}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
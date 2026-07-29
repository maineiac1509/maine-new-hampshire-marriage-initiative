import React from 'react';
import { HandHelping, ShieldCheck } from 'lucide-react';

export default function StewardshipBanner({ user, team, isAdmin }) {
  const firstName = (user?.full_name || user?.email || 'Friend').split(' ')[0];
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200/70 bg-amber-50/80 p-4 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        {isAdmin ? <ShieldCheck className="h-5 w-5" /> : <HandHelping className="h-5 w-5" />}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700/80">
          {isAdmin ? 'Ministry Administration' : 'Your Stewardship'}
        </p>
        <p className="text-sm font-semibold text-foreground">
          {isAdmin
            ? `${firstName}, you are overseeing the whole ministry.`
            : team
              ? `Serving through MC Relationship Builder: ${team.team_name}`
              : `${firstName}, you are not yet assigned to an MC Relationship Builder.`}
        </p>
      </div>
    </div>
  );
}
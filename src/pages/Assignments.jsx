import React from 'react';
import { UserCheck, CalendarClock, Info } from 'lucide-react';

export default function Assignments() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assignments</h1>
        <p className="text-sm text-muted-foreground">Assignment Engine</p>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card p-10 text-center shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <UserCheck className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">Assignment Automation Coming Soon</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          The Assignment Engine will automatically match Marriage Champions with volunteers and
          directors based on area, capacity, and configurable rules. This will be implemented in a
          future iteration.
        </p>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          Phase 1 — foundation only
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <CalendarClock className="h-5 w-5 text-muted-foreground" />
          <h3 className="mt-3 text-sm font-semibold">Auto-Assignment Rules</h3>
          <p className="mt-1 text-xs text-muted-foreground">Configure matching criteria</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <UserCheck className="h-5 w-5 text-muted-foreground" />
          <h3 className="mt-3 text-sm font-semibold">Volunteer Capacity</h3>
          <p className="mt-1 text-xs text-muted-foreground">Balance workloads</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <Info className="h-5 w-5 text-muted-foreground" />
          <h3 className="mt-3 text-sm font-semibold">Manual Overrides</h3>
          <p className="mt-1 text-xs text-muted-foreground">Director adjustments</p>
        </div>
      </div>
    </div>
  );
}
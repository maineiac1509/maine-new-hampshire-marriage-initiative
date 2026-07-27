import React from 'react';
import { MessageSquare, Info } from 'lucide-react';

export default function ContactHistory() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contact History</h1>
        <p className="text-sm text-muted-foreground">Marriage Champion contact logs</p>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card p-10 text-center shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <MessageSquare className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">Contact Logging Coming Soon</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          A timeline of every touchpoint with each Marriage Champion — calls, emails, texts, and
          in-person visits — will be recorded here. This module will be activated in a future
          iteration.
        </p>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          Phase 1 — foundation only
        </div>
      </div>
    </div>
  );
}
import React from 'react';
import { GitBranch } from 'lucide-react';
import { AI_FOUNDATION_VERSION, PROMPT_VERSION, CONTEXT_VERSION } from '@/lib/ministryCoachConfig';

export default function VersionInfoSection({ config }) {
  const items = [
    { label: 'AI Foundation Version', value: AI_FOUNDATION_VERSION },
    { label: 'Prompt Version', value: PROMPT_VERSION },
    { label: 'Context Version', value: CONTEXT_VERSION },
    { label: 'Last Configuration Update', value: config.last_updated || 'Not yet configured' },
  ];

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <GitBranch className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Version Information</h2>
          <p className="text-sm text-muted-foreground">System version details for troubleshooting and support.</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
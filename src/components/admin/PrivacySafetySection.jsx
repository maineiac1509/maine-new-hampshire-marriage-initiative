import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';

export default function PrivacySafetySection({ config }) {
  const items = [
    {
      label: 'Metadata-Only Logging',
      status: 'Enabled',
      variant: 'success',
      description: 'AI request logs contain only operational metadata — provider, model, duration, token counts, and success/failure status. No ministry content, prompts, or responses are ever stored.',
    },
    {
      label: 'Prompt Logging',
      status: 'Disabled',
      variant: 'neutral',
      description: 'Prompts and AI responses are never logged or persisted. They exist only in memory for the duration of the request and are discarded after the response is returned.',
    },
    {
      label: 'Context Retention',
      status: 'Per-Request',
      variant: 'info',
      description: 'Ministry context is assembled fresh for each AI request from the database. It is not cached or stored between requests. Each request sees only the current, authorized data.',
    },
    {
      label: 'Data Access Boundaries',
      status: 'RLS-Enforced',
      variant: 'success',
      description: "The AI only sees data the requesting user is authorized to access. Row-Level Security is enforced on every context retrieval — the AI never sees data outside the user's permission scope.",
    },
  ];

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Privacy & Safety</h2>
          <p className="text-sm text-muted-foreground">How the Ministry Coach protects ministry data and respects privacy.</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">{item.label}</p>
              <StatusBadge variant={item.variant}>{item.status}</StatusBadge>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
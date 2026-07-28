import React from 'react';

// Consistent section shell for the Ministry Intelligence Dashboard: numbered
// title, icon, and a highlighted human-readable summary bar generated from real
// calculations (never AI).
export default function Section({ index, title, summary, icon: Icon, children }) {
  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {Icon && <Icon className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <span className="text-xs font-bold text-muted-foreground">{String(index).padStart(2, '0')}</span>
            {title}
          </h2>
        </div>
      </div>
      {summary && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm text-foreground">
          {summary}
        </div>
      )}
      {children}
    </section>
  );
}
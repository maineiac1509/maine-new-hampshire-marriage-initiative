import React from 'react';
import { BookOpen } from 'lucide-react';

// Deterministic narrative summary assembled from active signals + intelligence.
// Each line is a real calculated statement — never AI.
export default function MinistryStory({ lines }) {
  if (!lines || !lines.length) return null;
  return (
    <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BookOpen className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Current Ministry Story</h2>
          <div className="mt-2 space-y-1.5">
            {lines.map((line, i) => (
              <p key={i} className="text-sm text-foreground">{line}</p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
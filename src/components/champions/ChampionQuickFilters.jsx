import React from 'react';
import { cn } from '@/lib/utils';

// Built-in quick filter tabs for the Champions page.
// Designed to later support Saved Views / Smart Assignment / Daily Call Queue.
const FILTERS = [
  { key: 'my', label: 'My Champions' },
  { key: 'all', label: 'All Champions' },
  { key: 'first-contact', label: 'Needs First Contact' },
  { key: 'follow-up', label: 'Needs Follow-up' },
  { key: 'recent', label: 'Recently Contacted' },
  { key: 'unassigned', label: 'Unassigned' },
];

export default function ChampionQuickFilters({ active, onChange, counts = {} }) {
  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map((f) => {
        const isActive = active === f.key;
        const count = counts[f.key];
        return (
          <button
            key={f.key}
            type="button"
            onClick={() => onChange(f.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            {f.label}
            {typeof count === 'number' && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-xs',
                  isActive ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground'
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
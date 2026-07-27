import React, { useMemo } from 'react';
import { HeartHandshake } from 'lucide-react';
import { STEWARDSHIP_HEALTH_LEVELS, computeHealthDistribution } from '@/lib/stewardshipHealth';
import { cn } from '@/lib/utils';

// Stewardship Health dashboard widget. Sits beneath the Action Center in the
// My Stewardship section. Each category is clickable and filters the Champion
// directory. Soft colors and encouraging language — this is a care indicator,
// not a performance score.
export default function StewardshipHealthCard({ households, activities, onSelect }) {
  const activitiesByHouse = useMemo(() => {
    const map = {};
    (activities || []).forEach((a) => {
      (map[a.household_id] = map[a.household_id] || []).push(a);
    });
    return map;
  }, [activities]);

  const counts = useMemo(
    () => computeHealthDistribution(households, activitiesByHouse),
    [households, activitiesByHouse]
  );

  const total = (households || []).length;
  const allHealthy = total > 0 && counts.healthy === total;

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <HeartHandshake className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Stewardship Health</h2>
          <p className="text-sm text-muted-foreground">Relationships that may benefit from intentional care.</p>
        </div>
      </div>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">No Champions in your stewardship scope yet.</p>
      ) : allHealthy ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 text-center">
          <p className="text-sm font-semibold text-emerald-800">Wonderful work!</p>
          <p className="mt-1 text-sm text-emerald-700">
            Every Champion relationship currently reflects healthy stewardship activity. Continue investing faithfully in these relationships.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {STEWARDSHIP_HEALTH_LEVELS.map((lvl) => {
            const count = counts[lvl.key] || 0;
            const selectable = onSelect && count > 0;
            const Tag = selectable ? 'button' : 'div';
            return (
              <Tag
                key={lvl.key}
                type={selectable ? 'button' : undefined}
                onClick={selectable ? () => onSelect(lvl.key) : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                  selectable
                    ? 'cursor-pointer hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                    : 'opacity-60'
                )}
              >
                <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', lvl.tone)}>
                  <span className={cn('h-2 w-2 rounded-full', lvl.dot)} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-bold tabular-nums text-foreground">{count}</p>
                  <p className="truncate text-xs text-muted-foreground">{lvl.label}</p>
                </div>
              </Tag>
            );
          })}
        </div>
      )}
    </section>
  );
}
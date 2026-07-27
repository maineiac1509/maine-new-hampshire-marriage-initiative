import React from 'react';
import { computeStewardshipHealth } from '@/lib/stewardshipHealth';
import { cn } from '@/lib/utils';

// Small, soft stewardship health indicator shown on Champion profiles. Uses the
// shared four-color health system so terminology and color stay consistent across
// the dashboard widget, profile, and directory.
export default function StewardshipHealthBadge({ activities, fallbackDate, className }) {
  const { level } = computeStewardshipHealth({ activities, fallbackDate });
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        level.tone,
        className
      )}
      title="Stewardship Health — an operational indicator of relationships that may benefit from intentional care."
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', level.dot)} />
      {level.label}
    </span>
  );
}
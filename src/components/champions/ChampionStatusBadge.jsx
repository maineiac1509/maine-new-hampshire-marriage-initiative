import React from 'react';
import { householdIndicator } from '@/lib/championUtils';

// Visual follow-up badge for a Champion row/card.
export default function ChampionStatusBadge({ activities }) {
  const ind = householdIndicator(activities);
  if (!ind.label) return null;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ind.tone}`}
    >
      {ind.label}
    </span>
  );
}
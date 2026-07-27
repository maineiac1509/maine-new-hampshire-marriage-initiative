import React from 'react';
import { AlertCircle, Clock, CheckCircle2, CircleDashed } from 'lucide-react';
import { householdIndicator } from '@/lib/championUtils';

// Consistent icon per follow-up indicator state.
const INDICATOR_ICONS = {
  overdue: AlertCircle,
  'due-today': Clock,
  'up-to-date': CheckCircle2,
  'no-follow-up': CircleDashed,
};

// Standardized follow-up indicator badge — four states, consistent colors throughout.
export default function ChampionStatusBadge({ activities }) {
  const ind = householdIndicator(activities);
  if (!ind.label) return null;
  const Icon = INDICATOR_ICONS[ind.key];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${ind.tone}`}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {ind.label}
    </span>
  );
}
import React from 'react';
import { AlertCircle, Clock, CheckCircle2, CircleDashed } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { householdIndicator } from '@/lib/championUtils';

const INDICATOR_ICONS = {
  overdue: AlertCircle,
  'due-today': Clock,
  'up-to-date': CheckCircle2,
  'no-follow-up': CircleDashed,
};

const INDICATOR_VARIANTS = {
  overdue: 'danger',
  'due-today': 'warning',
  'up-to-date': 'success',
  'no-follow-up': 'neutral',
};

// Standardized follow-up indicator — four consistent states that share the
// StatusBadge design language: Overdue, Due Today, Up To Date, No Follow-up.
export default function ChampionStatusBadge({ activities }) {
  const ind = householdIndicator(activities);
  if (!ind.label) return null;
  return (
    <StatusBadge variant={INDICATOR_VARIANTS[ind.key]} icon={INDICATOR_ICONS[ind.key]}>
      {ind.label}
    </StatusBadge>
  );
}
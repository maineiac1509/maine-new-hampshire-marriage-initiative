import React from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { RELATIONSHIP_STATUS_VARIANTS } from '@/lib/config';

// Counts tracked in the "My Champions" summary view.
const TRACKED_STATUSES = [
  'New',
  'First Contact Needed',
  'Following Up',
  'Registered for Weekend',
  'Attended Weekend',
];

const SHORT_LABELS = {
  'Registered for Weekend': 'Registered',
  'Attended Weekend': 'Attended',
  'First Contact Needed': 'First Contact',
};

// Relationship Status breakdown shown above the Champion list in "My Champions" view.
export default function RelationshipStatusSummary({ counts }) {
  const items = TRACKED_STATUSES.map((s) => ({
    status: s,
    label: SHORT_LABELS[s] || s,
    count: counts[s] || 0,
    variant: RELATIONSHIP_STATUS_VARIANTS[s] || 'neutral',
  }));

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((it) => (
        <div key={it.status} className="rounded-lg border bg-card p-3 shadow-sm">
          <StatusBadge variant={it.variant}>{it.label}</StatusBadge>
          <div className="mt-1.5 text-lg font-semibold text-foreground">{it.count}</div>
        </div>
      ))}
    </div>
  );
}
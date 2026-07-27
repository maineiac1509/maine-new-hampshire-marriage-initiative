import React from 'react';
import { RELATIONSHIP_STATUS_STYLES } from '@/lib/config';

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
    tone: RELATIONSHIP_STATUS_STYLES[s] || 'bg-slate-100 text-slate-600',
  }));

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((it) => (
        <div key={it.status} className="rounded-lg border bg-card p-3 shadow-sm">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${it.tone}`}>
            {it.label}
          </span>
          <div className="mt-1.5 text-lg font-semibold text-foreground">{it.count}</div>
        </div>
      ))}
    </div>
  );
}
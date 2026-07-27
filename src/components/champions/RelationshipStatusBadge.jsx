import React from 'react';
import { RELATIONSHIP_STATUS_STYLES } from '@/lib/config';

// Colored badge for a Champion's current Relationship Status.
export default function RelationshipStatusBadge({ status }) {
  if (!status) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        RELATIONSHIP_STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'
      }`}
    >
      {status}
    </span>
  );
}
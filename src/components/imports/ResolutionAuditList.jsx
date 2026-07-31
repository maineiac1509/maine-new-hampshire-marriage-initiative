import React from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Clock, User, ArrowRight } from 'lucide-react';
import { fieldLabel } from '@/lib/importLabels';

const EVENT_TYPE_LABEL = {
  RESOLUTION_CREATED: 'Resolution Created',
  RESOLUTION_CHANGED: 'Resolution Changed',
  BULK_RESOLUTION_APPLIED: 'Bulk Resolution',
  BULK_RESOLUTION_REVERSED: 'Bulk Reversed',
  MANUAL_MATCH_SELECTED: 'Manual Match',
  NEW_RECORD_DISCARDED: 'New Record Discarded',
  ROW_SKIPPED: 'Row Skipped',
  ROW_BLOCKED: 'Row Blocked',
  RESTRICTION_REDUCTION_ATTEMPTED: 'Restriction Removal Attempted',
  RESTRICTION_REDUCTION_APPROVED: 'Restriction Removal Approved',
  BATCH_READINESS_GRANTED: 'Readiness Granted',
  BATCH_READINESS_REVOKED: 'Readiness Revoked',
  RESOLUTIONS_INVALIDATED: 'Resolutions Invalidated',
};

const EVENT_VARIANT = {
  RESOLUTION_CREATED: 'success',
  RESOLUTION_CHANGED: 'info',
  BULK_RESOLUTION_APPLIED: 'info',
  BULK_RESOLUTION_REVERSED: 'warning',
  MANUAL_MATCH_SELECTED: 'info',
  NEW_RECORD_DISCARDED: 'neutral',
  ROW_SKIPPED: 'neutral',
  ROW_BLOCKED: 'danger',
  RESTRICTION_REDUCTION_ATTEMPTED: 'danger',
  RESTRICTION_REDUCTION_APPROVED: 'danger',
  BATCH_READINESS_GRANTED: 'success',
  BATCH_READINESS_REVOKED: 'warning',
  RESOLUTIONS_INVALIDATED: 'neutral',
};

// Audit trail for resolution lifecycle events.
export default function ResolutionAuditList({ audits }) {
  if (!audits?.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <Clock className="h-6 w-6 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No audit entries yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {audits.map((a) => (
        <div key={a.id} className="flex gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
          <div className="flex flex-col items-start gap-1">
            <StatusBadge variant={EVENT_VARIANT[a.event_type] || 'neutral'}>
              {EVENT_TYPE_LABEL[a.event_type] || a.event_type}
            </StatusBadge>
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {a.canonical_field_name && (
                <span className="font-medium capitalize">{fieldLabel(a.canonical_field_name)}</span>
              )}
              {a.prior_decision && a.new_decision && (
                <span className="text-muted-foreground">
                  {a.prior_decision} <ArrowRight className="inline h-3 w-3" /> {a.new_decision}
                </span>
              )}
              {a.manual_match_target_type && (
                <span className="text-muted-foreground">
                  Target: {a.manual_match_target_type}
                  {a.manual_match_target_id ? ` (${a.manual_match_target_id.slice(0, 8)}…)` : ''}
                </span>
              )}
            </div>
            {a.reason && <p className="text-xs text-muted-foreground">Reason: {a.reason}</p>}
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <User className="h-3 w-3" />
              <span>{a.admin_user_name || 'Unknown admin'}</span>
              <span>·</span>
              <span>{new Date(a.event_at || a.created_date).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
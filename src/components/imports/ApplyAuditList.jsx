import React from 'react';
import { Clock, User, ArrowRight } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { fieldLabel, APPLY_RESULT_VARIANT, APPLY_RESULT_LABEL } from '@/lib/importLabels';

const OPERATION_TYPE_LABEL = {
  UPDATE_HOUSEHOLD_FIELD: 'Update Household Field',
  UPDATE_MEMBER_FIELD: 'Update Member Field',
  CREATE_HOUSEHOLD: 'Create Household',
  CREATE_MEMBER: 'Create Member',
  ADD_RESTRICTION: 'Add Restriction',
  SKIP_FIELD: 'Skip Field',
  BLOCK_FIELD: 'Block Field',
  KEEP_CURRENT: 'Keep Current',
  SYNC_METADATA_UPDATE: 'Sync Metadata',
};

const DRIFT_LABEL = {
  NOT_CHECKED: 'Not Checked',
  NO_DRIFT: 'No Drift',
  NORMALIZATION_ONLY_DRIFT: 'Normalization Only',
  MATERIAL_DRIFT: 'Material Drift',
  TARGET_RECORD_MISSING: 'Target Missing',
  TARGET_RELATION_CHANGED: 'Relation Changed',
  PROVENANCE_CHANGED: 'Provenance Changed',
};

const DRIFT_VARIANT = {
  NOT_CHECKED: 'neutral',
  NO_DRIFT: 'success',
  NORMALIZATION_ONLY_DRIFT: 'info',
  MATERIAL_DRIFT: 'danger',
  TARGET_RECORD_MISSING: 'danger',
  TARGET_RELATION_CHANGED: 'danger',
  PROVENANCE_CHANGED: 'warning',
};

// Apply audit trail viewer. Shows every event from the production
// apply engine lifecycle. Sensitive values are stored only in this
// admin-only audit record.
export default function ApplyAuditList({ audits }) {
  if (!audits?.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <Clock className="h-6 w-6 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No apply audit entries yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {audits.map((a) => (
        <div key={a.id} className="flex gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
          <div className="flex flex-col items-start gap-1">
            <StatusBadge variant={APPLY_RESULT_VARIANT[a.apply_result] || 'neutral'}>
              {APPLY_RESULT_LABEL[a.apply_result] || a.apply_result}
            </StatusBadge>
            {a.operation_type && (
              <span className="text-[10px] text-muted-foreground">{OPERATION_TYPE_LABEL[a.operation_type] || a.operation_type}</span>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {a.canonical_field_name && (
                <span className="font-medium capitalize">{fieldLabel(a.canonical_field_name)}</span>
              )}
              {a.entity_id && (
                <span className="text-muted-foreground font-mono text-[10px]">{a.entity_type}: {a.entity_id.slice(0, 8)}…</span>
              )}
              {a.prior_value != null && a.applied_value != null && a.apply_result !== 'NO_CHANGE' && (
                <span className="text-muted-foreground">
                  {a.prior_value || '—'} <ArrowRight className="inline h-3 w-3" /> {a.applied_value || '—'}
                </span>
              )}
            </div>
            {a.drift_status && a.drift_status !== 'NOT_CHECKED' && a.drift_status !== 'NO_DRIFT' && (
              <StatusBadge variant={DRIFT_VARIANT[a.drift_status] || 'neutral'}>
                {DRIFT_LABEL[a.drift_status] || a.drift_status}
              </StatusBadge>
            )}
            {a.error_message && <p className="text-xs text-red-600">{a.error_message}</p>}
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <User className="h-3 w-3" />
              <span>{new Date(a.applied_at || a.created_date).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
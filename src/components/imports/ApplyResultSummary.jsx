import React from 'react';
import { CheckCircle2, AlertCircle, Users, FileSpreadsheet, Shield, Ban, Layers } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { APPLY_STATUS_VARIANT, APPLY_STATUS_LABEL } from '@/lib/importLabels';

// Post-apply summary shown on the Reconciliation Dashboard after
// a batch has been successfully (or partially) applied.
export default function ApplyResultSummary({ batch }) {
  if (!batch) return null;

  const isApplied = batch.status === 'APPLIED';
  const isFailed = batch.apply_status === 'FAILED' || batch.apply_status === 'PARTIALLY_FAILED';
  const summary = batch.apply_summary || {};

  return (
    <div className="space-y-3">
      {/* Status banner */}
      {isApplied && (
        <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Import Applied Successfully</p>
            <p className="mt-1 text-emerald-700">
              Applied on {batch.applied_at ? new Date(batch.applied_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—'} by an administrator.
            </p>
          </div>
        </div>
      )}
      {isFailed && (
        <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Apply {batch.apply_status === 'PARTIALLY_FAILED' ? 'Partially Failed' : 'Failed'}</p>
            {batch.apply_error && <p className="mt-1 text-red-700">{batch.apply_error}</p>}
            <p className="mt-1 text-red-600 text-xs">This batch requires administrator review.</p>
          </div>
        </div>
      )}

      {/* Counts grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard icon={FileSpreadsheet} label="Households Created" value={batch.created_household_count} tone="emerald" />
        <StatCard icon={Users} label="Households Updated" value={batch.updated_household_count} tone="blue" />
        <StatCard icon={FileSpreadsheet} label="Members Created" value={batch.created_member_count} tone="emerald" />
        <StatCard icon={Users} label="Members Updated" value={batch.updated_member_count} tone="blue" />
        <StatCard icon={Layers} label="Fields Applied" value={batch.applied_field_count} tone="muted" />
        <StatCard icon={Shield} label="Restrictions Added" value={summary.restrictions_added || 0} tone="amber" />
        <StatCard icon={Ban} label="Fields Skipped" value={summary.fields_skipped || 0} tone="muted" />
        <StatCard icon={Ban} label="Fields Blocked" value={summary.fields_blocked || 0} tone="muted" />
      </div>

      {/* Verification status */}
      {summary.verification_passed !== undefined && (
        <div className="flex items-center gap-2 text-sm">
          <StatusBadge variant={summary.verification_passed ? 'success' : 'danger'}>
            {summary.verification_passed ? 'Verification Passed' : 'Verification Failed'}
          </StatusBadge>
          {summary.drift_blocked_count > 0 && (
            <StatusBadge variant="warning">
              {summary.drift_blocked_count} Drift-Blocked
            </StatusBadge>
          )}
          {summary.custom_values_applied > 0 && (
            <StatusBadge variant="info">
              {summary.custom_values_applied} Custom Values
            </StatusBadge>
          )}
        </div>
      )}

      {/* Apply status badge */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Apply Status:</span>
        <StatusBadge variant={APPLY_STATUS_VARIANT[batch.apply_status] || 'neutral'}>
          {APPLY_STATUS_LABEL[batch.apply_status] || batch.apply_status || 'Pending'}
        </StatusBadge>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone = 'muted' }) {
  const tones = {
    muted: 'bg-muted/50 text-muted-foreground border-border',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <div className={`flex items-center gap-2 rounded-lg border p-2.5 ${tones[tone] || tones.muted}`}>
      <Icon className="h-4 w-4 shrink-0 opacity-70" />
      <div className="min-w-0">
        <div className="text-lg font-semibold leading-tight">{value ?? 0}</div>
        <div className="truncate text-[11px] leading-tight opacity-80">{label}</div>
      </div>
    </div>
  );
}
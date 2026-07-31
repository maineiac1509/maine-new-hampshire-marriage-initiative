import React from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AlertTriangle, Info, AlertOctagon, Ban } from 'lucide-react';
import { ISSUE_SEVERITY_VARIANT, ISSUE_TYPE_LABEL, fieldLabel } from '@/lib/importLabels';

// List of validation and processing issues for an import batch.
const SEVERITY_ICON = {
  INFO: Info,
  WARNING: AlertTriangle,
  ERROR: AlertOctagon,
  BLOCKING: Ban,
};

export default function IssueList({ issues }) {
  if (!issues?.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Info className="h-6 w-6 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No issues detected in this batch.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {issues.map((issue) => {
        const Icon = SEVERITY_ICON[issue.severity] || Info;
        return (
          <div
            key={issue.id}
            className={`flex gap-3 rounded-lg border p-3 text-sm ${
              issue.severity === 'BLOCKING' || issue.severity === 'ERROR'
                ? 'border-red-200 bg-red-50/50'
                : issue.severity === 'WARNING'
                ? 'border-amber-200 bg-amber-50/50'
                : 'border-border bg-muted/30'
            }`}
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${
              issue.severity === 'BLOCKING' || issue.severity === 'ERROR' ? 'text-red-500'
              : issue.severity === 'WARNING' ? 'text-amber-500' : 'text-muted-foreground'
            }`} />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge variant={ISSUE_SEVERITY_VARIANT[issue.severity] || 'neutral'}>
                  {issue.severity}
                </StatusBadge>
                <span className="text-xs font-medium">{ISSUE_TYPE_LABEL[issue.issue_type] || issue.issue_type}</span>
                {issue.source_column && (
                  <span className="text-xs text-muted-foreground">
                    Column: <span className="font-mono">{issue.source_column}</span>
                  </span>
                )}
                {issue.canonical_field_name && (
                  <span className="text-xs text-muted-foreground">
                    Field: <span className="capitalize">{fieldLabel(issue.canonical_field_name)}</span>
                  </span>
                )}
              </div>
              <p className="text-sm text-foreground">{issue.message}</p>
              {issue.raw_value && (
                <p className="font-mono text-xs text-muted-foreground">
                  Raw value: "{issue.raw_value}"
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
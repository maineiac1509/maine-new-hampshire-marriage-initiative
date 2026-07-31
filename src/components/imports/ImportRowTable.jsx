import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  MATCH_STATUS_VARIANT, MATCH_STATUS_LABEL,
  RECORD_CLASSIFICATION_VARIANT, RECORD_CLASSIFICATION_LABEL,
  ROW_RESOLUTION_STATUS_VARIANT, ROW_RESOLUTION_STATUS_LABEL,
  fieldLabel,
} from '@/lib/importLabels';

// Table of staged import rows with match status and classification.
// Each row expands to show validation messages and match details.
function ConfidenceBadge({ confidence }) {
  const variant = confidence === 'high' ? 'success' : confidence === 'medium' ? 'info' : confidence === 'low' ? 'warning' : 'neutral';
  return <StatusBadge variant={variant}>{confidence || 'none'}</StatusBadge>;
}

function RowExpansion({ row }) {
  const hasErrors = row.validation_errors?.length > 0;
  const hasWarnings = row.validation_warnings?.length > 0;
  const hasMatchDetail = row.match_method || row.possible_match_ids?.length;

  if (!hasErrors && !hasWarnings && !hasMatchDetail) {
    return <p className="px-4 py-2 text-xs text-muted-foreground">No additional details.</p>;
  }

  return (
    <div className="space-y-2 px-4 py-2 text-xs">
      {row.match_method && (
        <div>
          <span className="font-medium text-muted-foreground">Match method: </span>
          <span>{row.match_method}</span>
        </div>
      )}
      {row.possible_match_ids?.length > 0 && (
        <div>
          <span className="font-medium text-muted-foreground">Possible matches: </span>
          <span>{row.possible_match_ids.length} record(s)</span>
        </div>
      )}
      {hasErrors && (
        <div className="rounded border border-red-200 bg-red-50 p-2">
          <p className="font-medium text-red-700">Validation errors ({row.validation_errors.length})</p>
          <ul className="mt-1 space-y-0.5 text-red-600">
            {row.validation_errors.map((e, i) => <li key={i}>• {e}</li>)}
          </ul>
        </div>
      )}
      {hasWarnings && (
        <div className="rounded border border-amber-200 bg-amber-50 p-2">
          <p className="font-medium text-amber-700">Validation warnings ({row.validation_warnings.length})</p>
          <ul className="mt-1 space-y-0.5 text-amber-600">
            {row.validation_warnings.map((w, i) => <li key={i}>• {w}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ImportRowTable({ rows, onRowClick }) {
  const [expanded, setExpanded] = useState(null);

  if (!rows?.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No staged rows in this batch.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="max-h-[600px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-muted/80 text-left text-xs text-muted-foreground backdrop-blur">
            <tr>
              <th className="w-8 px-2 py-2"></th>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Member</th>
              <th className="px-3 py-2 font-medium">Household</th>
              <th className="px-3 py-2 font-medium">Match</th>
              <th className="px-3 py-2 font-medium">Classification</th>
              <th className="px-3 py-2 font-medium">Resolution</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isOpen = expanded === row.id;
              const hasDetail = row.validation_errors?.length || row.validation_warnings?.length || row.match_method;
              return (
                <React.Fragment key={row.id}>
                  <tr
                    className={`border-t transition-colors hover:bg-muted/30 ${isOpen ? 'bg-muted/40' : ''} ${
                      row.validation_status === 'invalid' ? 'bg-red-50/40' : ''
                    } ${row.row_resolution_status === 'DISCARDED' || row.row_resolution_status === 'SKIPPED' || row.row_resolution_status === 'BLOCKED' ? 'opacity-50' : ''}`}
                  >
                    <td className="px-2 py-2 text-center">
                      {hasDetail ? (
                        <button
                          onClick={() => setExpanded(isOpen ? null : row.id)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{row.row_number}</td>
                    <td className="px-3 py-2 font-medium">
                      {row.member_first_name} {row.member_last_name}
                      {row.is_household_representative && (
                        <span className="ml-1 text-[10px] text-muted-foreground">(rep)</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{row.household_name || '—'}</td>
                    <td className="px-3 py-2">
                      <StatusBadge variant={MATCH_STATUS_VARIANT[row.match_status] || 'neutral'}>
                        {MATCH_STATUS_LABEL[row.match_status] || row.match_status}
                      </StatusBadge>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge variant={RECORD_CLASSIFICATION_VARIANT[row.record_classification] || 'neutral'}>
                        {RECORD_CLASSIFICATION_LABEL[row.record_classification] || row.record_classification}
                      </StatusBadge>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge variant={ROW_RESOLUTION_STATUS_VARIANT[row.row_resolution_status] || 'neutral'}>
                        {ROW_RESOLUTION_STATUS_LABEL[row.row_resolution_status] || 'Pending'}
                      </StatusBadge>
                    </td>
                    <td className="px-3 py-2">
                      {onRowClick ? (
                        <button
                          onClick={() => onRowClick(row)}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          Review →
                        </button>
                      ) : row.matched_household_id ? (
                        <Link
                          to={`/champions/${row.matched_household_id}`}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          View Champion <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-muted/20">
                      <td colSpan={8} className="p-0">
                        <RowExpansion row={row} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
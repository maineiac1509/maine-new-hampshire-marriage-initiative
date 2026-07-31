import React, { useState, useMemo } from 'react';
import {
  Loader2, Trash2, SkipForward, Ban, GitBranch, ChevronLeft, ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  MATCH_STATUS_LABEL, MATCH_STATUS_VARIANT, RECORD_CLASSIFICATION_LABEL,
  RECORD_CLASSIFICATION_VARIANT, ROW_RESOLUTION_STATUS_LABEL, ROW_RESOLUTION_STATUS_VARIANT,
  fieldLabel,
} from '@/lib/importLabels';
import ResolutionControls from './ResolutionControls';
import ResolutionAuditList from './ResolutionAuditList';
import ManualMatchDialog from './ManualMatchDialog';

// Row detail dialog showing full comparison + resolution controls,
// row-level actions, and audit history. Supports next/prev navigation
// between rows.
export default function RowDetailDialog({
  open, onOpenChange, rows, currentIndex, comparisons, resolutions, audits,
  onSaveResolution, onRowAction, onManualMatch, onNavigate, saving,
}) {
  const [showMatchDialog, setShowMatchDialog] = useState(false);

  const row = rows?.[currentIndex];
  const rowComparisons = useMemo(
    () => (comparisons || []).filter((c) => c.import_row_id === row?.id),
    [comparisons, row],
  );
  const rowResolutions = useMemo(
    () => (resolutions || []).filter((r) => r.import_row_id === row?.id && (r.status === 'PENDING' || r.status === 'RESOLVED')),
    [resolutions, row],
  );
  const rowAudits = useMemo(
    () => (audits || []).filter((a) => a.import_row_id === row?.id),
    [audits, row],
  );

  const resolutionMap = useMemo(() => {
    const m = new Map();
    for (const r of rowResolutions) m.set(r.field_comparison_id, r);
    return m;
  }, [rowResolutions]);

  function handleClose(open) {
    if (!open) setShowMatchDialog(false);
    onOpenChange(open);
  }

  if (!row) {
    return <Dialog open={open} onOpenChange={handleClose}><DialogContent><p className="py-4 text-center text-sm text-muted-foreground">No row selected.</p></DialogContent></Dialog>;
  }

  const rowStatus = row.row_resolution_status || 'PENDING';
  const isRowLocked = ['DISCARDED', 'SKIPPED', 'BLOCKED'].includes(rowStatus);

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Row {row.row_number}: {row.member_first_name} {row.member_last_name}
              {row.is_household_representative && <span className="text-xs text-muted-foreground">(household rep)</span>}
            </DialogTitle>
            <DialogDescription>{row.household_name || 'Unknown household'}</DialogDescription>
          </DialogHeader>

          {/* Match info */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <StatusBadge variant={MATCH_STATUS_VARIANT[row.match_status] || 'neutral'}>
              {MATCH_STATUS_LABEL[row.match_status] || row.match_status}
            </StatusBadge>
            <StatusBadge variant={RECORD_CLASSIFICATION_VARIANT[row.record_classification] || 'neutral'}>
              {RECORD_CLASSIFICATION_LABEL[row.record_classification] || row.record_classification}
            </StatusBadge>
            <StatusBadge variant={ROW_RESOLUTION_STATUS_VARIANT[rowStatus] || 'neutral'}>
              {ROW_RESOLUTION_STATUS_LABEL[rowStatus] || rowStatus}
            </StatusBadge>
          </div>
          {row.match_method && <p className="text-xs text-muted-foreground">{row.match_method}</p>}

          {/* Validation issues */}
          {row.validation_errors?.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs">
              <p className="font-medium text-red-700">Validation errors ({row.validation_errors.length})</p>
              <ul className="mt-1 space-y-0.5 text-red-600">
                {row.validation_errors.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            </div>
          )}

          {/* Row actions */}
          {!isRowLocked && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowMatchDialog(true)} disabled={saving}>
                <GitBranch className="h-3 w-3" /> Manual Match
              </Button>
              {row.record_classification === 'NEW_RECORD' && (
                <Button variant="outline" size="sm" onClick={() => onRowAction('discard', row.id)} disabled={saving}>
                  <Trash2 className="h-3 w-3" /> Discard New Record
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => onRowAction('skip', row.id)} disabled={saving}>
                <SkipForward className="h-3 w-3" /> Skip Row
              </Button>
              <Button variant="outline" size="sm" onClick={() => onRowAction('block', row.id)} disabled={saving}>
                <Ban className="h-3 w-3" /> Block Row
              </Button>
            </div>
          )}

          {isRowLocked && (
            <div className="flex gap-2 rounded-lg border border-muted bg-muted/30 p-3 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>This row is {rowStatus.toLowerCase()}. Its field resolutions have been invalidated and will not be applied.</span>
            </div>
          )}

          {/* Field comparisons with resolution controls */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Field Comparisons ({rowComparisons.length})</p>
            {rowComparisons.length === 0 ? (
              <p className="text-xs text-muted-foreground">No field comparisons for this row.</p>
            ) : (
              <div className="space-y-1.5">
                {rowComparisons.map((c) => (
                  <div key={c.id} className="rounded-lg border p-2.5">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-sm font-medium capitalize">{fieldLabel(c.canonical_field_name)}</span>
                      <span className="text-xs text-muted-foreground">{c.entity_type === 'ChampionHousehold' ? 'Household' : 'Member'}</span>
                    </div>
                    <div className="mb-2 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Current: </span>
                        <span className="font-mono">{c.current_normalized_value || '—'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Incoming: </span>
                        <span className="font-mono">{c.incoming_normalized_value || '—'}</span>
                      </div>
                    </div>
                    <ResolutionControls
                      comparison={c}
                      resolution={resolutionMap.get(c.id)}
                      onSave={onSaveResolution}
                      disabled={isRowLocked}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Audit history */}
          {rowAudits.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Resolution History</p>
              <ResolutionAuditList audits={rowAudits} />
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between border-t pt-3">
            <Button variant="ghost" size="sm" onClick={() => onNavigate(currentIndex - 1)} disabled={currentIndex <= 0}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <span className="text-xs text-muted-foreground">{currentIndex + 1} of {rows.length}</span>
            <Button variant="ghost" size="sm" onClick={() => onNavigate(currentIndex + 1)} disabled={currentIndex >= rows.length - 1}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ManualMatchDialog
        open={showMatchDialog}
        onOpenChange={setShowMatchDialog}
        row={row}
        onConfirm={(payload) => { onManualMatch(payload); setShowMatchDialog(false); }}
        saving={saving}
      />
    </>
  );
}
import React, { useState, useEffect } from 'react';
import { Loader2, AlertTriangle, CheckCircle2, ShieldAlert, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { applyPreflight, applyImport } from '@/lib/applyApi';

// Confirmation dialog for the production apply engine.
// Shows backend-computed preflight counts and requires the admin
// to type "APPLY" to confirm. The frontend never sends field values
// or write instructions — only the batch ID and confirmation text.
export default function ApplyImportDialog({ open, onOpenChange, batchId, batchFileName, onApplied }) {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preflight, setPreflight] = useState(null);
  const [error, setError] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (open && batchId) {
      setPreflight(null);
      setError(null);
      setConfirmText('');
      setResult(null);
      loadPreflight();
    }
  }, [open, batchId]);

  async function loadPreflight() {
    setLoading(true);
    setError(null);
    try {
      const res = await applyPreflight(batchId);
      setPreflight(res);
      if (!res.passed) {
        setError(res.errors?.join(' ') || 'Preflight validation failed.');
      }
    } catch (err) {
      setError(err?.message || 'Could not run preflight check.');
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    setApplying(true);
    setError(null);
    try {
      const res = await applyImport(batchId, 'APPLY');
      setResult(res);
      if (res.success) {
        onApplied?.(res);
      } else {
        setError(res.error || 'Apply failed.');
      }
    } catch (err) {
      setError(err?.message || 'Apply failed.');
    } finally {
      setApplying(false);
    }
  }

  const canConfirm = preflight?.passed && confirmText === 'APPLY' && !applying;
  const counts = preflight?.counts;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Apply Import to Production
          </DialogTitle>
          <DialogDescription>
            {batchFileName || 'Import batch'} — This will write approved resolutions to production Champion records.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Running preflight checks…</span>
          </div>
        )}

        {!loading && preflight && (
          <div className="space-y-3">
            {/* Preflight status */}
            {preflight.passed ? (
              <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Preflight validation passed. All checks are ready.</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Preflight validation failed. This batch cannot be applied.</span>
                </div>
                {preflight.errors?.length > 0 && (
                  <ul className="ml-4 space-y-0.5 text-xs text-red-700">
                    {preflight.errors.map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                )}
              </div>
            )}

            {/* Counts */}
            {counts && (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Production Write Plan Summary</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <CountRow label="Total rows" value={counts.total_rows} />
                  <CountRow label="Unresolved items" value={counts.unresolved_items} danger={counts.unresolved_items > 0} />
                  <CountRow label="New households" value={counts.new_households_to_create} highlight />
                  <CountRow label="New members" value={counts.new_members_to_create} highlight />
                  <CountRow label="Update households" value={counts.existing_households_to_update} />
                  <CountRow label="Update members" value={counts.existing_members_to_update} />
                  <CountRow label="Safe FL updates" value={counts.safe_familylife_updates} />
                  <CountRow label="Shared use incoming" value={counts.shared_use_incoming} />
                  <CountRow label="Shared keep current" value={counts.shared_keep_current} />
                  <CountRow label="Custom values" value={counts.custom_values} />
                  <CountRow label="Restrictions added" value={counts.restrictions_added} warning />
                  <CountRow label="Blocked fields" value={counts.blocked_fields} />
                  <CountRow label="Skipped rows" value={counts.skipped_rows} />
                  <CountRow label="Discarded rows" value={counts.discarded_rows} />
                </div>
              </div>
            )}

            {/* Warnings */}
            {preflight.warnings?.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <p className="font-medium">Warnings</p>
                <ul className="mt-1 space-y-0.5">
                  {preflight.warnings.map((w, i) => <li key={i}>• {w}</li>)}
                </ul>
              </div>
            )}

            {/* Confirmation */}
            {preflight.passed && !result && (
              <div className="space-y-2">
                <div className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>
                    This action will permanently update production Champion records. It cannot be undone from this screen.
                    Type <strong>APPLY</strong> to confirm.
                  </span>
                </div>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder='Type "APPLY" to confirm'
                  disabled={applying}
                  className="font-mono"
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <p className="font-medium">Error</p>
                <p className="mt-1 text-xs">{error}</p>
              </div>
            )}

            {/* Success result */}
            {result?.success && (
              <div className="space-y-2">
                <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Import applied successfully!</span>
                </div>
                <ApplyResultSummary result={result} />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {!result?.success && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
                Cancel
              </Button>
              <Button
                onClick={handleApply}
                disabled={!canConfirm}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {applying ? 'Applying…' : 'Apply to Production'}
              </Button>
            </>
          )}
          {result?.success && (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CountRow({ label, value, highlight, danger, warning }) {
  const tone = danger ? 'text-red-700' : warning ? 'text-amber-700' : highlight ? 'text-emerald-700' : 'text-foreground';
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${tone}`}>{value ?? 0}</span>
    </div>
  );
}

function ApplyResultSummary({ result }) {
  const s = result.summary;
  if (!s) return null;
  return (
    <div className="rounded-lg border p-3 space-y-1.5 text-sm">
      <p className="text-xs font-medium text-muted-foreground">Apply Results</p>
      <div className="grid grid-cols-2 gap-1.5">
        <CountRow label="Households created" value={s.created_households} highlight />
        <CountRow label="Households updated" value={s.updated_households} />
        <CountRow label="Members created" value={s.created_members} highlight />
        <CountRow label="Members updated" value={s.updated_members} />
        <CountRow label="Fields applied" value={s.fields_applied} />
        <CountRow label="Restrictions added" value={s.restrictions_added} warning />
        <CountRow label="Fields skipped" value={s.fields_skipped} />
        <CountRow label="Fields blocked" value={s.fields_blocked} />
      </div>
    </div>
  );
}
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Loader2, AlertTriangle, CheckCircle2, ShieldAlert, FileSpreadsheet,
  Play, Pause, RotateCcw, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { applyPreflight, applyStart, applyChunk, applyStatus, applyReset } from '@/lib/applyApi';
import { APPLY_PHASE_LABEL } from '@/lib/importLabels';

const POLL_INTERVAL = 2500; // 2.5 seconds between chunk calls

export default function ApplyImportDialog({ open, onOpenChange, batchId, batchFileName, onApplied }) {
  const [loading, setLoading] = useState(false);
  const [preflight, setPreflight] = useState(null);
  const [error, setError] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [progress, setProgress] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [phase, setPhase] = useState(null);
  const [result, setResult] = useState(null);
  const [canResume, setCanResume] = useState(false);
  const [canReset, setCanReset] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const pollRef = useRef(null);
  const inFlightRef = useRef(false);

  // Load preflight on open
  useEffect(() => {
    if (open && batchId) {
      setPreflight(null);
      setError(null);
      setConfirmText('');
      setProgress(null);
      setResult(null);
      setExecuting(false);
      loadPreflight();
      loadStatus();
    }
    return () => { if (pollRef.current) clearTimeout(pollRef.current); inFlightRef.current = false; };
  }, [open, batchId]);

  // Check for existing in-progress execution
  async function loadStatus() {
    try {
      const res = await applyStatus(batchId);
      if (res.apply_status === 'PAUSED' || res.apply_status === 'APPLYING') {
        setProgress(res.apply_progress);
        setPhase(res.apply_phase);
        setCanResume(res.can_resume);
        setCanReset(res.can_reset);
        setIsStale(res.is_stale);
        if (res.apply_status === 'PAUSED') {
          setExecuting(false); // Ready to resume
        }
      } else if (res.apply_status === 'APPLIED') {
        setResult({ completed: true, summary: res.apply_summary });
        setProgress({ ...res.apply_progress, percent_complete: 100 });
        setPhase('COMPLETED');
      }
    } catch (_) { /* ignore — may not have started yet */ }
  }

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

  // Start execution
  async function handleStart() {
    setExecuting(true);
    setError(null);
    try {
      const res = await applyStart(batchId, 'APPLY');
      setProgress(res.progress);
      setPhase(res.phase);
      setResult(null);
      // Start polling chunks
      startChunkPolling();
    } catch (err) {
      setError(err?.message || 'Failed to start apply.');
      setExecuting(false);
    }
  }

  // Resume after interruption
  async function handleResume() {
    setExecuting(true);
    setError(null);
    try {
      // Re-acquire lock via start (it detects existing ops)
      const res = await applyStart(batchId, 'APPLY');
      setProgress(res.progress);
      setPhase(res.phase);
      startChunkPolling();
    } catch (err) {
      setError(err?.message || 'Failed to resume.');
      setExecuting(false);
    }
  }

  // Reset execution
  async function handleReset() {
    if (!confirm('Reset the apply execution? This will delete all checkpoint data. No production records will be affected if none were written yet.')) return;
    setExecuting(true);
    setError(null);
    try {
      const res = await applyReset(batchId);
      if (res.reset) {
        setProgress(null);
        setPhase(null);
        setCanResume(false);
        setCanReset(false);
        setIsStale(false);
        await loadPreflight();
      } else {
        setError(res.error || 'Reset failed.');
      }
    } catch (err) {
      setError(err?.message || 'Reset failed.');
    } finally {
      setExecuting(false);
    }
  }

  // Polling loop — call chunk repeatedly until complete.
  // Uses recursive setTimeout (not setInterval) so the next chunk
  // only fires AFTER the prior request fully completes, preventing
  // overlapping 409s. An inFlightRef provides a second guard.
  const startChunkPolling = useCallback(() => {
    if (pollRef.current) clearTimeout(pollRef.current);

    const poll = async () => {
      // Guard: never send a chunk if one is already in flight
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const res = await applyChunk(batchId);
        if (res.completed) {
          setResult(res);
          setProgress({ ...res.progress, percent_complete: 100 });
          setPhase('COMPLETED');
          setExecuting(false);
          onApplied?.(res);
          return; // Stop polling
        } else if (res.chunk_already_running) {
          // Harmless duplicate — a prior chunk is still processing.
          // Update progress and continue polling without error.
          setProgress(res.progress);
          setPhase(res.phase);
          pollRef.current = setTimeout(poll, POLL_INTERVAL);
        } else if (res.error) {
          setError(res.error);
          setExecuting(false);
          await loadStatus();
          return; // Stop polling
        } else {
          setProgress(res.progress);
          setPhase(res.phase || res.new_phase);
          // Schedule next poll only after this one completes
          pollRef.current = setTimeout(poll, POLL_INTERVAL);
        }
      } catch (err) {
        setError(err?.message || 'Chunk processing failed.');
        setExecuting(false);
        await loadStatus();
        return; // Stop polling on error
      } finally {
        inFlightRef.current = false;
      }
    };

    poll(); // Start immediately
  }, [batchId, onApplied]);

  // Handle dialog close
  function handleClose(open) {
    if (!open && executing) {
      // Don't close while executing — user should wait or pause
      if (!confirm('The apply is still running. Closing this dialog will not stop execution, but you will lose the live progress view. You can resume later. Close anyway?')) {
        return;
      }
    }
    if (pollRef.current) clearTimeout(pollRef.current);
    inFlightRef.current = false;
    setExecuting(false);
    onOpenChange(open);
    if (!open) {
      // Refresh parent data
      window.location.reload();
    }
  }

  const canConfirm = preflight?.passed && confirmText === 'APPLY' && !executing && !progress;
  const hasInProgress = progress && !result?.completed;
  const percent = progress?.percent_complete || 0;
  const phaseLabel = phase ? (APPLY_PHASE_LABEL[phase] || phase) : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
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

        {!loading && (
          <div className="space-y-3">
            {/* Preflight status */}
            {preflight && !hasInProgress && !result?.completed && (
              <>
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
              </>
            )}

            {/* Counts */}
            {preflight?.counts && !hasInProgress && !result?.completed && (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Production Write Plan Summary</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <CountRow label="Total rows" value={preflight.counts.total_rows} />
                  <CountRow label="Unresolved items" value={preflight.counts.unresolved_items} danger={preflight.counts.unresolved_items > 0} />
                  <CountRow label="New households" value={preflight.counts.new_households_to_create} highlight />
                  <CountRow label="New members" value={preflight.counts.new_members_to_create} highlight />
                  <CountRow label="Update households" value={preflight.counts.existing_households_to_update} />
                  <CountRow label="Update members" value={preflight.counts.existing_members_to_update} />
                  <CountRow label="Safe FL updates" value={preflight.counts.safe_familylife_updates} />
                  <CountRow label="Shared use incoming" value={preflight.counts.shared_use_incoming} />
                  <CountRow label="Custom values" value={preflight.counts.custom_values} />
                  <CountRow label="Restrictions" value={preflight.counts.restrictions_added} warning />
                </div>
              </div>
            )}

            {/* In-progress execution */}
            {hasInProgress && (
              <div className="space-y-3">
                <div className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  {executing ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  ) : (
                    <Pause className="h-4 w-4 shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">
                      {executing ? 'Applying to Production…' : 'Execution Paused'}
                    </p>
                    {phaseLabel && (
                      <p className="mt-0.5 text-xs text-blue-700">
                        Phase: {phaseLabel}
                        {isStale && ' (stale — safe to resume)'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {progress?.applied || 0} applied · {progress?.verified || 0} verified · {progress?.failed || 0} failed · {progress?.skipped || 0} skipped
                    </span>
                    <span className="font-medium">{percent}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {progress?.pending || 0} of {progress?.total_operations || 0} operations remaining
                  </p>
                </div>

                {/* Resume/Reset controls (when paused) */}
                {!executing && (canResume || isStale) && (
                  <div className="flex gap-2">
                    <Button onClick={handleResume} size="sm" className="flex-1">
                      <Play className="h-3.5 w-3.5" />
                      Resume Execution
                    </Button>
                    {canReset && (
                      <Button onClick={handleReset} size="sm" variant="outline">
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reset
                      </Button>
                    )}
                  </div>
                )}

                {/* Error during execution */}
                {error && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <p className="font-medium">Chunk Error (safe to resume)</p>
                    <p className="mt-1">{error}</p>
                  </div>
                )}
              </div>
            )}

            {/* Confirmation (before start) */}
            {preflight?.passed && !hasInProgress && !result?.completed && (
              <div className="space-y-2">
                <div className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>
                    This will permanently update production Champion records in bounded chunks.
                    The execution is resumable — if interrupted, you can safely continue from where it left off.
                    Type <strong>APPLY</strong> to confirm.
                  </span>
                </div>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder='Type "APPLY" to confirm'
                  disabled={executing}
                  className="font-mono"
                />
              </div>
            )}

            {/* Preflight error */}
            {error && !hasInProgress && !result?.completed && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <p className="font-medium">Error</p>
                <p className="mt-1 text-xs">{error}</p>
              </div>
            )}

            {/* Success result */}
            {result?.completed && (
              <div className="space-y-2">
                <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Import applied successfully!</span>
                </div>
                {result.summary && (
                  <div className="rounded-lg border p-3 space-y-1.5 text-sm">
                    <p className="text-xs font-medium text-muted-foreground">Apply Results</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <CountRow label="Households created" value={result.summary.created_households} highlight />
                      <CountRow label="Households updated" value={result.summary.updated_households} />
                      <CountRow label="Members created" value={result.summary.created_members} highlight />
                      <CountRow label="Members updated" value={result.summary.updated_members} />
                      <CountRow label="Fields applied" value={result.summary.fields_applied} />
                      <CountRow label="Restrictions added" value={result.summary.restrictions_added} warning />
                      <CountRow label="Fields skipped" value={result.summary.fields_skipped} />
                      <CountRow label="Fields blocked" value={result.summary.fields_blocked} />
                      <CountRow label="Failed" value={result.summary.failed_count} danger={result.summary.failed_count > 0} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {!result?.completed && !hasInProgress && (
            <>
              <Button variant="outline" onClick={() => handleClose(false)} disabled={executing}>
                Cancel
              </Button>
              <Button
                onClick={handleStart}
                disabled={!canConfirm}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {executing ? 'Starting…' : 'Start Apply'}
              </Button>
            </>
          )}
          {hasInProgress && !executing && !result?.completed && !canResume && !isStale && (
            <Button onClick={() => handleClose(false)}>Close</Button>
          )}
          {result?.completed && (
            <Button onClick={() => handleClose(false)}>Done</Button>
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
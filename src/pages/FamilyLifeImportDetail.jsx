import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileSpreadsheet, Trash2, Loader2, AlertCircle, Copy, Check,
  Zap, CheckCircle2, RefreshCw, Rocket,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import ImportBatchSummary from '@/components/imports/ImportBatchSummary';
import ImportRowTable from '@/components/imports/ImportRowTable';
import ComparisonResolutionTable from '@/components/imports/ComparisonResolutionTable';
import IssueList from '@/components/imports/IssueList';
import ResolutionSummary from '@/components/imports/ResolutionSummary';
import BulkActionBar from '@/components/imports/BulkActionBar';
import RowDetailDialog from '@/components/imports/RowDetailDialog';
import ResolutionAuditList from '@/components/imports/ResolutionAuditList';
import ApplyImportDialog from '@/components/imports/ApplyImportDialog';
import ApplyResultSummary from '@/components/imports/ApplyResultSummary';
import ApplyAuditList from '@/components/imports/ApplyAuditList';
import {
  BATCH_STATUS_VARIANT, BATCH_STATUS_LABEL,
  READINESS_STATUS_VARIANT, READINESS_STATUS_LABEL,
  APPLY_STATUS_VARIANT, APPLY_STATUS_LABEL,
} from '@/lib/importLabels';
import {
  generateDefaults, saveResolution, bulkResolve, manualMatch,
  discardNewRecord, skipRow, blockRow, checkReadiness,
} from '@/lib/resolutionApi';
import { computeComparisonSummary } from '@/lib/comparisonClassification';

const TABS = [
  { key: 'comparisons', label: 'Comparisons' },
  { key: 'rows', label: 'Rows' },
  { key: 'issues', label: 'Issues' },
  { key: 'audit', label: 'Resolution Audit' },
  { key: 'apply_audit', label: 'Apply Audit' },
];

export default function FamilyLifeImportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [batch, setBatch] = useState(null);
  const [rows, setRows] = useState([]);
  const [comparisons, setComparisons] = useState([]);
  const [resolutions, setResolutions] = useState([]);
  const [issues, setIssues] = useState([]);
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('comparisons');
  const [discarding, setDiscarding] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rowDetailIndex, setRowDetailIndex] = useState(null);
  const [filteredComparisonIds, setFilteredComparisonIds] = useState([]);
  const [toast, setToast] = useState(null);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applyAudits, setApplyAudits] = useState([]);

  const showToast = (msg, tone = 'info') => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 4000);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, r, c, res, i, aud, appAudits] = await Promise.all([
        base44.entities.FamilyLifeImportBatch.get(id),
        base44.entities.FamilyLifeImportRow.filter({ import_batch_id: id }, 'row_number', 5000),
        base44.entities.FamilyLifeImportFieldComparison.filter({ import_batch_id: id }, undefined, 5000),
        base44.entities.FamilyLifeImportResolution.filter({ import_batch_id: id }, undefined, 5000),
        base44.entities.FamilyLifeImportIssue.filter({ import_batch_id: id }, undefined, 5000),
        base44.entities.FamilyLifeImportResolutionAudit.filter({ import_batch_id: id }, '-created_date', 200),
        base44.entities.FamilyLifeImportApplyAudit.filter({ import_batch_id: id }, '-created_date', 200),
      ]);
      setBatch(b);
      setRows(r || []);
      setComparisons(c || []);
      setResolutions(res || []);
      setIssues(i || []);
      setAudits(aud || []);
      setApplyAudits(appAudits || []);
    } catch (err) {
      setError(err?.message || 'Could not load this batch.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Compute comparison classification summary for the dashboard cards
  const comparisonSummary = useMemo(
    () => computeComparisonSummary(comparisons, resolutions),
    [comparisons, resolutions]
  );

  // Auto-generate defaults on first load if no resolutions exist yet
  useEffect(() => {
    if (batch && comparisons.length > 0 && resolutions.length === 0 && batch.status === 'READY_FOR_REVIEW') {
      handleGenerateDefaults();
    }
  }, [batch, comparisons, resolutions, batch?.status]);

  async function handleGenerateDefaults() {
    setActionLoading(true);
    try {
      const result = await generateDefaults(id);
      showToast(`${result.created} default resolutions created, ${result.skipped} require manual review.`);
      await loadAll();
    } catch (err) {
      showToast(err?.message || 'Failed to generate defaults.', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSaveResolution(payload) {
    try {
      await saveResolution(id, payload);
      showToast('Resolution saved.');
      await loadAll();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to save resolution.';
      showToast(msg, 'error');
    }
  }

  async function handleBulkAction(actionType) {
    setActionLoading(true);
    try {
      const payload = { action_type: actionType };
      // For selection-based actions, include the currently filtered comparison IDs
      if (actionType === 'USE_INCOMING_FOR_SELECTED_CONFLICTS' || actionType === 'SKIP_SELECTED_FIELDS') {
        payload.comparison_ids = filteredComparisonIds;
      }
      const result = await bulkResolve(id, payload);
      showToast(`Bulk action complete: ${result.affected_count} resolution(s) updated.`);
      await loadAll();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Bulk action failed.';
      showToast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRowAction(action, rowId) {
    setActionLoading(true);
    try {
      if (action === 'discard') await discardNewRecord(id, rowId);
      else if (action === 'skip') await skipRow(id, rowId);
      else if (action === 'block') await blockRow(id, rowId);
      showToast(`Row ${action}ed.`);
      await loadAll();
    } catch (err) {
      showToast(err?.message || 'Row action failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleManualMatch(payload) {
    setActionLoading(true);
    try {
      const result = await manualMatch(id, payload);
      showToast(`Match updated: ${result.new_comparisons} new comparisons, ${result.new_default_resolutions} default resolutions.`);
      await loadAll();
    } catch (err) {
      showToast(err?.message || 'Manual match failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCheckReadiness() {
    setActionLoading(true);
    try {
      const result = await checkReadiness(id);
      if (result.ready) {
        showToast('Batch is ready to apply!', 'success');
      } else {
        showToast(`Not ready: ${result.reason}`, 'error');
      }
      await loadAll();
    } catch (err) {
      showToast(err?.message || 'Readiness check failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDiscard() {
    if (!confirm('Discard this staged import batch? All staged rows, comparisons, resolutions, and issues will be deleted. No production records are affected.')) return;
    setDiscarding(true);
    try {
      await base44.entities.FamilyLifeImportResolution.deleteMany({ import_batch_id: id });
      await base44.entities.FamilyLifeImportResolutionAudit.deleteMany({ import_batch_id: id });
      await base44.entities.FamilyLifeImportBulkResolution.deleteMany({ import_batch_id: id });
      await base44.entities.FamilyLifeImportRow.deleteMany({ import_batch_id: id });
      await base44.entities.FamilyLifeImportFieldComparison.deleteMany({ import_batch_id: id });
      await base44.entities.FamilyLifeImportIssue.deleteMany({ import_batch_id: id });
      await base44.entities.FamilyLifeImportBatch.update(id, { status: 'DISCARDED' });
      navigate('/imports/familylife');
    } catch (err) {
      alert('Could not discard batch: ' + (err?.message || 'Unknown error'));
    } finally {
      setDiscarding(false);
    }
  }

  function copyBatchId() {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm font-medium">Could not load this import batch</p>
        <p className="max-w-sm text-xs text-muted-foreground">{error || 'Batch not found.'}</p>
        <Link to="/imports/familylife"><Button variant="outline" className="mt-2">Back to Imports</Button></Link>
      </div>
    );
  }

  const isDiscarded = batch.status === 'DISCARDED';
  const isReadyToApply = batch.status === 'READY_TO_APPLY';
  const isApplied = batch.status === 'APPLIED';
  const isApplying = batch.status === 'APPLYING';
  const isApplyPaused = batch.apply_status === 'PAUSED';
  const readOnly = isDiscarded || isReadyToApply || isApplied || isApplying;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/imports/familylife" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Imports
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">{batch.file_name || 'Untitled Import'}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <StatusBadge variant={BATCH_STATUS_VARIANT[batch.status] || 'neutral'}>
              {BATCH_STATUS_LABEL[batch.status] || batch.status}
            </StatusBadge>
            <StatusBadge variant={READINESS_STATUS_VARIANT[batch.readiness_status] || 'neutral'}>
              {READINESS_STATUS_LABEL[batch.readiness_status] || 'Not Ready'}
            </StatusBadge>
            {batch.source_period && <span>Period: {batch.source_period}</span>}
            <span>· {new Date(batch.created_date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            <button onClick={copyBatchId} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted" title="Copy batch ID">
              {copiedId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copiedId ? 'Copied' : 'Copy ID'}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!readOnly && (
            <>
              <Button variant="outline" onClick={handleGenerateDefaults} disabled={actionLoading}>
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Generate Defaults
              </Button>
              <Button onClick={handleCheckReadiness} disabled={actionLoading}>
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Check Readiness
              </Button>
            </>
          )}
          {isReadyToApply && !isApplyPaused && (
            <Button onClick={() => setApplyDialogOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Rocket className="h-4 w-4" />
              Apply to Production
            </Button>
          )}
          {isApplyPaused && (
            <Button onClick={() => setApplyDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
              <RefreshCw className="h-4 w-4" />
              Resume Apply ({batch.apply_progress?.percent_complete || 0}%)
            </Button>
          )}
          {!isDiscarded && !isApplied && (
            <Button variant="outline" onClick={handleDiscard} disabled={discarding}>
              {discarding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Discard Batch
            </Button>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
          toast.tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' :
          toast.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
          'border-blue-200 bg-blue-50 text-blue-700'
        }`}>
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Notices */}
      {batch.status === 'PROCESSING_FAILED' && (
        <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Processing failed</p>
            {batch.failure_reason && <p className="mt-1 text-red-700">{batch.failure_reason}</p>}
          </div>
        </div>
      )}
      {isDiscarded && (
        <div className="flex gap-3 rounded-lg border border-muted bg-muted/30 p-4 text-sm text-muted-foreground">
          <FileSpreadsheet className="h-5 w-5 shrink-0" />
          <p>This batch has been discarded. Its staged data has been removed.</p>
        </div>
      )}
      {batch.possible_duplicate_batch_id && (
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Possible duplicate import</p>
            <p className="mt-1 text-amber-700">
              A prior batch with the same content signature was detected.{' '}
              <Link to={`/imports/familylife/${batch.possible_duplicate_batch_id}`} className="underline">View the original batch</Link>
            </p>
          </div>
        </div>
      )}
      {isReadyToApply && (
        <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Ready to Apply</p>
            <p className="mt-1 text-emerald-700">All required decisions are complete. Click "Apply to Production" above to execute the approved resolutions.</p>
          </div>
        </div>
      )}
      {isApplying && !isApplyPaused && (
        <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
          <div className="flex-1">
            <p className="font-medium">Applying to Production</p>
            <p className="mt-1 text-blue-700">
              The apply engine is executing chunk {batch.apply_progress?.chunk_index || 0}. Do not navigate away or submit again.
            </p>
            {batch.apply_progress && (
              <div className="mt-2">
                <div className="h-1.5 rounded-full bg-blue-200 overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${batch.apply_progress.percent_complete || 0}%` }} />
                </div>
                <p className="mt-1 text-xs text-blue-600">
                  {batch.apply_progress.applied || 0} applied · {batch.apply_progress.verified || 0} verified · {batch.apply_progress.percent_complete || 0}%
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      {isApplyPaused && (
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <RefreshCw className="h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Apply Execution Paused — Resumable</p>
            <p className="mt-1 text-amber-700">
              The apply execution was interrupted but all progress is saved.
              Click "Resume Apply" above to continue from where it left off.
            </p>
            {batch.apply_progress && (
              <div className="mt-2">
                <div className="h-1.5 rounded-full bg-amber-200 overflow-hidden">
                  <div className="h-full bg-amber-500" style={{ width: `${batch.apply_progress.percent_complete || 0}%` }} />
                </div>
                <p className="mt-1 text-xs text-amber-600">
                  {batch.apply_progress.applied || 0} applied · {batch.apply_progress.pending || 0} pending · {batch.apply_progress.percent_complete || 0}%
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      {isApplied && (
        <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Batch Applied</p>
            <p className="mt-1 text-emerald-700">
              This batch was successfully applied to production on{' '}
              {batch.applied_at ? new Date(batch.applied_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}.
              All resolutions and decisions are now read-only.
            </p>
          </div>
        </div>
      )}

      {/* Staging summary */}
      <ImportBatchSummary batch={batch} />

      {/* Resolution summary */}
      {!isApplied && !isApplying && !isApplyPaused && (
        <div className="rounded-lg border p-4">
          <ResolutionSummary
            summary={batch.resolution_summary}
            comparisonSummary={comparisonSummary}
            readinessStatus={batch.readiness_status}
            readinessReason={batch.readiness_reason}
          />
        </div>
      )}

      {/* Apply result summary (shown after apply) */}
      {(isApplied || batch.apply_status === 'APPLIED' || batch.apply_status === 'FAILED' || batch.apply_status === 'PARTIALLY_FAILED') && !isApplyPaused && (
        <div className="rounded-lg border p-4">
          <ApplyResultSummary batch={batch} />
        </div>
      )}

      {/* Bulk actions */}
      {!readOnly && !isApplyPaused && (
        <div className="rounded-lg border p-4">
          <BulkActionBar
            batchId={id}
            selectedCount={filteredComparisonIds.length}
            onBulkAction={handleBulkAction}
            disabled={actionLoading}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-foreground" />}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'comparisons' && (
          <ComparisonResolutionTable
            comparisons={comparisons}
            resolutions={resolutions}
            onSaveResolution={handleSaveResolution}
            onFilteredIdsChange={setFilteredComparisonIds}
          />
        )}
        {activeTab === 'rows' && (
          <ImportRowTable rows={rows} onRowClick={(row) => setRowDetailIndex(rows.indexOf(row))} />
        )}
        {activeTab === 'issues' && <IssueList issues={issues} />}
        {activeTab === 'audit' && <ResolutionAuditList audits={audits} />}
        {activeTab === 'apply_audit' && <ApplyAuditList audits={applyAudits} />}
      </div>

      {/* Row detail dialog */}
      {rowDetailIndex !== null && (
        <RowDetailDialog
          open={rowDetailIndex !== null}
          onOpenChange={(open) => { if (!open) setRowDetailIndex(null); }}
          rows={rows}
          currentIndex={rowDetailIndex}
          comparisons={comparisons}
          resolutions={resolutions}
          audits={audits}
          onSaveResolution={handleSaveResolution}
          onRowAction={handleRowAction}
          onManualMatch={handleManualMatch}
          onNavigate={setRowDetailIndex}
          saving={actionLoading}
        />
      )}
      {/* Apply dialog */}
      <ApplyImportDialog
        open={applyDialogOpen}
        onOpenChange={(open) => {
          setApplyDialogOpen(open);
          if (!open) loadAll();
        }}
        batchId={id}
        batchFileName={batch.file_name}
      />
    </div>
  );
}
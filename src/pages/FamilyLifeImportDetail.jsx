import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileSpreadsheet, Trash2, Loader2, AlertCircle, Copy, Check,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import ImportBatchSummary from '@/components/imports/ImportBatchSummary';
import ImportRowTable from '@/components/imports/ImportRowTable';
import ComparisonTable from '@/components/imports/ComparisonTable';
import IssueList from '@/components/imports/IssueList';
import { BATCH_STATUS_VARIANT, BATCH_STATUS_LABEL } from '@/lib/importLabels';

// Reconciliation Dashboard for a single staged import batch.
// Tabs: Rows | Comparisons | Issues.
// This is a READ-ONLY review surface — no production records are
// modified here. Future phases will add resolution controls and apply.

const TABS = [
  { key: 'rows', label: 'Staged Rows' },
  { key: 'comparisons', label: 'Field Comparisons' },
  { key: 'issues', label: 'Issues' },
];

export default function FamilyLifeImportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [batch, setBatch] = useState(null);
  const [rows, setRows] = useState([]);
  const [comparisons, setComparisons] = useState([]);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('rows');
  const [discarding, setDiscarding] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, r, c, i] = await Promise.all([
        base44.entities.FamilyLifeImportBatch.get(id),
        base44.entities.FamilyLifeImportRow.filter({ import_batch_id: id }, 'row_number', 500),
        base44.entities.FamilyLifeImportFieldComparison.filter({ import_batch_id: id }, undefined, 500),
        base44.entities.FamilyLifeImportIssue.filter({ import_batch_id: id }, undefined, 500),
      ]);
      setBatch(b);
      setRows(r || []);
      setComparisons(c || []);
      setIssues(i || []);
    } catch (err) {
      setError(err?.message || 'Could not load this batch.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function handleDiscard() {
    if (!confirm('Discard this staged import batch? All staged rows, comparisons, and issues will be deleted. No production records are affected.')) return;
    setDiscarding(true);
    try {
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
        <Link to="/imports/familylife">
          <Button variant="outline" className="mt-2">Back to Imports</Button>
        </Link>
      </div>
    );
  }

  const isDiscarded = batch.status === 'DISCARDED';

  return (
    <div className="space-y-6">
      <div>
        <Link to="/imports/familylife" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Imports
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">{batch.file_name || 'Untitled Import'}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <StatusBadge variant={BATCH_STATUS_VARIANT[batch.status] || 'neutral'}>
              {BATCH_STATUS_LABEL[batch.status] || batch.status}
            </StatusBadge>
            {batch.source_period && <span>Period: {batch.source_period}</span>}
            <span>· {new Date(batch.created_date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            <button
              onClick={copyBatchId}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
              title="Copy batch ID"
            >
              {copiedId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copiedId ? 'Copied' : 'Copy ID'}
            </button>
          </div>
        </div>
        {!isDiscarded && batch.status !== 'APPLIED' && (
          <Button variant="outline" onClick={handleDiscard} disabled={discarding}>
            {discarding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Discard Batch
          </Button>
        )}
      </div>

      {/* Processing failure notice */}
      {batch.status === 'PROCESSING_FAILED' && (
        <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Processing failed</p>
            {batch.failure_reason && <p className="mt-1 text-red-700">{batch.failure_reason}</p>}
          </div>
        </div>
      )}

      {/* Discarded notice */}
      {isDiscarded && (
        <div className="flex gap-3 rounded-lg border border-muted bg-muted/30 p-4 text-sm text-muted-foreground">
          <FileSpreadsheet className="h-5 w-5 shrink-0" />
          <p>This batch has been discarded. Its staged data has been removed.</p>
        </div>
      )}

      {/* Possible duplicate notice */}
      {batch.possible_duplicate_batch_id && (
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Possible duplicate import</p>
            <p className="mt-1 text-amber-700">
              A prior batch with the same content signature was detected.
              {' '}
              <Link to={`/imports/familylife/${batch.possible_duplicate_batch_id}`} className="underline">
                View the original batch
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <ImportBatchSummary batch={batch} />

      {/* Governance summary */}
      {batch.summary && (
        <div className="rounded-lg border bg-muted/30 p-4 text-sm">
          <p className="font-medium">Governance Protection</p>
          <div className="mt-2 flex flex-wrap gap-4 text-xs">
            <span className="text-muted-foreground">
              Restrictive preferences added: <strong className="text-foreground">{batch.summary.restrictive_preferences_added || 0}</strong>
            </span>
            <span className="text-muted-foreground">
              Protected fields ignored: <strong className="text-foreground">{batch.summary.protected_fields_ignored || 0}</strong>
            </span>
            <span className="text-muted-foreground">
              Unknown fields blocked: <strong className="text-foreground">{batch.summary.unknown_fields_blocked || 0}</strong>
            </span>
            <span className="text-muted-foreground">
              Governance version: <strong className="text-foreground">{batch.governance_version || '—'}</strong>
            </span>
            <span className="text-muted-foreground">
              Mapping version: <strong className="text-foreground">{batch.mapping_version || '—'}</strong>
            </span>
          </div>
          {batch.summary.unmapped_columns?.length > 0 && (
            <div className="mt-2 text-xs text-amber-600">
              Unmapped columns: {batch.summary.unmapped_columns.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 bg-foreground" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'rows' && <ImportRowTable rows={rows} />}
        {activeTab === 'comparisons' && <ComparisonTable comparisons={comparisons} />}
        {activeTab === 'issues' && <IssueList issues={issues} />}
      </div>
    </div>
  );
}
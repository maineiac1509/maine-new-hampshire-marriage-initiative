import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileSpreadsheet, Plus, Trash2, ChevronRight, Inbox } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import ImportChampionsDialog from '@/components/champions/ImportChampionsDialog';
import { BATCH_STATUS_VARIANT, BATCH_STATUS_LABEL } from '@/lib/importLabels';

// Landing page for the FamilyLife import workflow.
// Lists all staged batches and provides a launch point for new imports.
export default function FamilyLifeImports() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const navigate = useNavigate();

  const loadBatches = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.FamilyLifeImportBatch.list('-created_date', 100);
      setBatches(list || []);
    } catch {
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBatches(); }, [loadBatches]);

  async function handleDiscard(batchId) {
    if (!confirm('Discard this staged import batch? The staged rows and comparisons will be deleted. No production records are affected.')) return;
    try {
      await base44.entities.FamilyLifeImportRow.deleteMany({ import_batch_id: batchId });
      await base44.entities.FamilyLifeImportFieldComparison.deleteMany({ import_batch_id: batchId });
      await base44.entities.FamilyLifeImportIssue.deleteMany({ import_batch_id: batchId });
      await base44.entities.FamilyLifeImportBatch.update(batchId, { status: 'DISCARDED' });
      loadBatches();
    } catch (err) {
      alert('Could not discard batch: ' + (err?.message || 'Unknown error'));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="FamilyLife Imports"
        subtitle="Stage and reconcile annual FamilyLife data before it touches your ministry records."
        actions={
          <Button onClick={() => setShowImport(true)}>
            <Plus className="h-4 w-4" /> New Import
          </Button>
        }
      />

      {/* Info banner */}
      <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <FileSpreadsheet className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium">Safe staging — nothing is applied yet</p>
          <p className="mt-1 text-blue-700">
            Every import is staged, matched against existing champions, and compared field-by-field.
            Production records are never modified during staging. Review the batch before approving any changes.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-foreground" />
        </div>
      ) : batches.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">No import batches yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Upload a FamilyLife export to stage it for review. Staged batches appear here for reconciliation.
          </p>
          <Button onClick={() => setShowImport(true)} className="mt-2">
            <Plus className="h-4 w-4" /> Stage Your First Import
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">File</th>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Rows</th>
                <th className="px-4 py-3 font-medium">New</th>
                <th className="px-4 py-3 font-medium">Updates</th>
                <th className="px-4 py-3 font-medium">Conflicts</th>
                <th className="px-4 py-3 font-medium">Blocked</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-t transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link to={`/imports/familylife/${b.id}`} className="font-medium hover:underline">
                      {b.file_name || 'Untitled'}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {new Date(b.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{b.source_period || '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge variant={BATCH_STATUS_VARIANT[b.status] || 'neutral'}>
                      {BATCH_STATUS_LABEL[b.status] || b.status}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3">{b.total_rows ?? 0}</td>
                  <td className="px-4 py-3 text-emerald-600">{b.new_record_rows || 0}</td>
                  <td className="px-4 py-3 text-blue-600">{b.safe_update_rows || 0}</td>
                  <td className="px-4 py-3">
                    <span className={b.conflict_rows ? 'font-medium text-amber-600' : 'text-muted-foreground'}>
                      {b.conflict_rows || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={b.blocked_field_count ? 'font-medium text-red-600' : 'text-muted-foreground'}>
                      {b.blocked_field_count || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {b.status === 'READY_FOR_REVIEW' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDiscard(b.id)}
                          title="Discard batch"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Link to={`/imports/familylife/${b.id}`}>
                        <Button variant="ghost" size="icon">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ImportChampionsDialog
        open={showImport}
        onOpenChange={setShowImport}
        onImported={loadBatches}
      />
    </div>
  );
}
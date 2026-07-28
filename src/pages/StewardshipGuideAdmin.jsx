import React, { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Plus, Pencil, Trash2, Archive, ArchiveRestore, Loader2, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import GuideFormDialog from '@/components/stewardship/GuideFormDialog';
import { situationLabel } from '@/lib/stewardshipGuideMatcher';

export default function StewardshipGuideAdmin() {
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    base44.entities.StewardshipGuide.list('display_order')
      .then((gs) => setGuides(gs || []))
      .catch(() => setGuides([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(data) {
    if (editing?.id) {
      await base44.entities.StewardshipGuide.update(editing.id, data);
    } else {
      await base44.entities.StewardshipGuide.create(data);
    }
    setFormOpen(false);
    setEditing(null);
    load();
  }

  async function quickUpdate(g, patch) {
    await base44.entities.StewardshipGuide.update(g.id, patch);
    load();
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await base44.entities.StewardshipGuide.delete(deleteId);
      setDeleteId(null);
      load();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/stewardship-guides"><ArrowLeft className="h-4 w-4" /> Back to Guides</Link>
      </Button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage Stewardship Guides</h1>
          <p className="text-sm text-muted-foreground">Create, edit, and organize ministry guidance.</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4" /> New Guide
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : guides.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          No guides yet. Create your first guide.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Situations</th>
                <th className="px-3 py-2 text-center">Order</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {guides.map((g) => (
                <tr key={g.id} className={g.archived ? 'opacity-50' : ''}>
                  <td className="px-3 py-2 font-medium text-foreground">{g.title}</td>
                  <td className="px-3 py-2 text-muted-foreground">{g.category}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {Array.isArray(g.situations) && g.situations.length
                      ? g.situations.map((s) => situationLabel(s)).join(', ')
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-center text-muted-foreground">{g.display_order ?? 100}</td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${g.enabled === false ? 'bg-muted text-muted-foreground' : 'bg-emerald-100 text-emerald-700'}`}>
                        {g.enabled === false ? 'Disabled' : 'Enabled'}
                      </span>
                      {g.archived && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          Archived
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => { setEditing(g); setFormOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title={g.enabled === false ? 'Enable' : 'Disable'} onClick={() => quickUpdate(g, { enabled: g.enabled === false })}>
                        {g.enabled === false ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title={g.archived ? 'Unarchive' : 'Archive'} onClick={() => quickUpdate(g, { archived: !g.archived })}>
                        {g.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Delete" onClick={() => setDeleteId(g.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <GuideFormDialog
        open={formOpen}
        guide={editing}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }}
        onSave={handleSave}
      />

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this guide?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the Stewardship Guide. Consider archiving instead if you may need it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
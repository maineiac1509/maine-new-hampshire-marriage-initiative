import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Pencil, Trash2, Archive, ArchiveRestore, Eye, EyeOff,
  Loader2, Tag, Layers, Star,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import ResourceFormDialog from '@/components/resources/ResourceFormDialog';

const TABS = [
  { key: 'resources', label: 'Resources', icon: Tag },
  { key: 'categories', label: 'Categories', icon: Layers },
];

export default function ResourceAdmin() {
  const [tab, setTab] = useState('resources');
  const [resources, setResources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [guides, setGuides] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Category state
  const [newCat, setNewCat] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      base44.entities.Resource.list('display_order'),
      base44.entities.ResourceCategory.filter({}, 'display_order'),
      base44.entities.StewardshipGuide.filter({ archived: false }).catch(() => []),
      base44.entities.CommunicationTemplate.filter({ archived: false }).catch(() => []),
    ]).then(([res, cats, gs, ts]) => {
      setResources(res || []);
      setCategories(cats || []);
      setGuides(gs || []);
      setTemplates(ts || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const categoryNames = categories.map((c) => c.name);
  const guideTitles = guides.map((g) => g.title);
  const templateTitles = templates.map((t) => t.title);

  async function handleSaveResource(data) {
    if (editing?.id) await base44.entities.Resource.update(editing.id, data);
    else await base44.entities.Resource.create(data);
    setFormOpen(false);
    setEditing(null);
    load();
  }

  async function quickUpdate(r, patch) {
    await base44.entities.Resource.update(r.id, patch);
    load();
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await base44.entities.Resource.delete(deleteId);
      setDeleteId(null);
      load();
    } finally {
      setDeleting(false);
    }
  }

  async function addCategory() {
    if (!newCat.trim()) return;
    await base44.entities.ResourceCategory.create({ name: newCat.trim(), enabled: true });
    setNewCat('');
    load();
  }

  async function deleteCategory(catId) {
    await base44.entities.ResourceCategory.delete(catId);
    load();
  }

  async function toggleCategoryField(cat, field) {
    await base44.entities.ResourceCategory.update(cat.id, { [field]: !cat[field] });
    load();
  }

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/resources"><ArrowLeft className="h-4 w-4" /> Back to Library</Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Resource Library Administration</h1>
        <p className="text-sm text-muted-foreground">Manage resources, categories, and relationships—all data-driven.</p>
      </div>

      <div className="flex gap-1 border-b">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition ${
                tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : tab === 'resources' ? (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> New Resource</Button>
          </div>
          {resources.length === 0 ? (
            <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">No resources yet.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2 text-center">Featured</th>
                    <th className="px-3 py-2 text-center">Status</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {resources.map((r) => (
                    <tr key={r.id} className={r.archived ? 'opacity-50' : ''}>
                      <td className="px-3 py-2 font-medium text-foreground">{r.title}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.resource_type}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.category || '—'}</td>
                      <td className="px-3 py-2 text-center">
                        {r.featured && <Star className="mx-auto h-4 w-4 fill-amber-400 text-amber-400" />}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${r.active === false ? 'bg-muted text-muted-foreground' : 'bg-emerald-100 text-emerald-700'}`}>
                            {r.active === false ? 'Disabled' : 'Active'}
                          </span>
                          {r.archived && <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">Archived</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => { setEditing(r); setFormOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title={r.featured ? 'Unfeature' : 'Feature'} onClick={() => quickUpdate(r, { featured: !r.featured })}>
                            <Star className={`h-3.5 w-3.5 ${r.featured ? 'fill-amber-400 text-amber-400' : ''}`} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title={r.active === false ? 'Enable' : 'Disable'} onClick={() => quickUpdate(r, { active: r.active === false })}>
                            {r.active === false ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title={r.archived ? 'Unarchive' : 'Archive'} onClick={() => quickUpdate(r, { archived: !r.archived })}>
                            {r.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Delete" onClick={() => setDeleteId(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category name" />
            <Button onClick={addCategory}><Plus className="h-4 w-4" /> Add</Button>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2 text-center">Order</th>
                  <th className="px-3 py-2 text-center">Enabled</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {categories.map((c) => (
                  <tr key={c.id} className={c.archived ? 'opacity-50' : ''}>
                    <td className="px-3 py-2 font-medium">{c.name}</td>
                    <td className="px-3 py-2 text-center text-muted-foreground">{c.display_order ?? 100}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${c.enabled === false ? 'bg-muted text-muted-foreground' : 'bg-emerald-100 text-emerald-700'}`}>
                        {c.enabled === false ? 'Disabled' : 'Enabled'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title={c.enabled === false ? 'Enable' : 'Disable'} onClick={() => toggleCategoryField(c, 'enabled')}>
                          {c.enabled === false ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title={c.archived ? 'Unarchive' : 'Archive'} onClick={() => toggleCategoryField(c, 'archived')}>
                          {c.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteCategory(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {categories.length === 0 && <p className="text-sm text-muted-foreground">No categories yet.</p>}
        </div>
      )}

      <ResourceFormDialog
        open={formOpen}
        resource={editing}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }}
        onSave={handleSaveResource}
        categories={categoryNames}
        guideTitles={guideTitles}
        templateTitles={templateTitles}
      />

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this resource?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the resource. Consider archiving instead.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
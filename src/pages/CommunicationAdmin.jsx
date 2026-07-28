import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, Archive, ArchiveRestore, Eye, EyeOff, Loader2, Tag, Layers, Merge } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import TemplateFormDialog from '@/components/communication/TemplateFormDialog';

const TABS = [
  { key: 'templates', label: 'Templates', icon: Tag },
  { key: 'categories', label: 'Categories', icon: Layers },
  { key: 'fields', label: 'Merge Fields', icon: Merge },
];

export default function CommunicationAdmin() {
  const [tab, setTab] = useState('templates');
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      base44.entities.CommunicationTemplate.list('display_order'),
      base44.entities.CommunicationCategory.filter({}, 'display_order'),
      base44.entities.MergeField.filter({}, 'display_order'),
    ]).then(([ts, cs, fs]) => {
      setTemplates(ts || []);
      setCategories(cs || []);
      setFields(fs || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const categoryNames = categories.map((c) => c.name);

  async function handleSaveTemplate(data) {
    if (editing?.id) await base44.entities.CommunicationTemplate.update(editing.id, data);
    else await base44.entities.CommunicationTemplate.create(data);
    setFormOpen(false);
    setEditing(null);
    load();
  }

  async function quickUpdate(t, patch) {
    await base44.entities.CommunicationTemplate.update(t.id, patch);
    load();
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      // template delete
      await base44.entities.CommunicationTemplate.delete(deleteId);
      setDeleteId(null);
      load();
    } finally {
      setDeleting(false);
    }
  }

  // Category management
  const [newCat, setNewCat] = useState('');
  async function addCategory() {
    if (!newCat.trim()) return;
    await base44.entities.CommunicationCategory.create({ name: newCat.trim(), enabled: true, display_order: 100 });
    setNewCat('');
    load();
  }
  async function deleteCategory(id) {
    await base44.entities.CommunicationCategory.delete(id);
    load();
  }

  // Merge field management
  const [newField, setNewField] = useState({ key: '', label: '', description: '', example_value: '' });
  async function addField() {
    if (!newField.key.trim() || !newField.label.trim()) return;
    await base44.entities.MergeField.create({ ...newField, builtin: false, display_order: 100 });
    setNewField({ key: '', label: '', description: '', example_value: '' });
    load();
  }
  async function deleteField(id) {
    await base44.entities.MergeField.delete(id);
    load();
  }

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/communication"><ArrowLeft className="h-4 w-4" /> Back to Communication Center</Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Communication Center Administration</h1>
        <p className="text-sm text-muted-foreground">Manage templates, categories, and merge fields—all data-driven.</p>
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
      ) : tab === 'templates' ? (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> New Template</Button>
          </div>
          {templates.length === 0 ? (
            <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">No templates yet.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2 text-center">Order</th>
                    <th className="px-3 py-2 text-center">Status</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {templates.map((t) => (
                    <tr key={t.id} className={t.archived ? 'opacity-50' : ''}>
                      <td className="px-3 py-2 font-medium text-foreground">{t.title}</td>
                      <td className="px-3 py-2 text-muted-foreground">{t.category || '—'}</td>
                      <td className="px-3 py-2 text-center text-muted-foreground">{t.display_order ?? 100}</td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${t.enabled === false ? 'bg-muted text-muted-foreground' : 'bg-emerald-100 text-emerald-700'}`}>
                            {t.enabled === false ? 'Disabled' : 'Enabled'}
                          </span>
                          {t.archived && <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">Archived</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => { setEditing(t); setFormOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title={t.enabled === false ? 'Enable' : 'Disable'} onClick={() => quickUpdate(t, { enabled: t.enabled === false })}>
                            {t.enabled === false ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title={t.archived ? 'Unarchive' : 'Archive'} onClick={() => quickUpdate(t, { archived: !t.archived })}>
                            {t.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Delete" onClick={() => setDeleteId(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : tab === 'categories' ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category name" />
            <Button onClick={addCategory}><Plus className="h-4 w-4" /> Add</Button>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-3 py-2">Category</th><th className="px-3 py-2 text-center">Order</th><th className="px-3 py-2 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y">
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2 font-medium">{c.name}</td>
                    <td className="px-3 py-2 text-center text-muted-foreground">{c.display_order ?? 100}</td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteCategory(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {categories.length === 0 && <p className="text-sm text-muted-foreground">No categories yet.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/50 dark:bg-blue-950/30">
            <p className="text-xs text-blue-900 dark:text-blue-100">
              Built-in fields are auto-resolved from Champion and volunteer data. Custom fields appear as fill-in prompts in the composer. Add new fields here—no code changes needed.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input value={newField.key} onChange={(e) => setNewField((f) => ({ ...f, key: e.target.value }))} placeholder="Field key (e.g. ChildName)" />
            <Input value={newField.label} onChange={(e) => setNewField((f) => ({ ...f, label: e.target.value }))} placeholder="Label (e.g. Child's Name)" />
            <Input value={newField.description} onChange={(e) => setNewField((f) => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" />
            <Input value={newField.example_value} onChange={(e) => setNewField((f) => ({ ...f, example_value: e.target.value }))} placeholder="Example value" />
          </div>
          <Button onClick={addField} disabled={!newField.key.trim() || !newField.label.trim()}><Plus className="h-4 w-4" /> Add Merge Field</Button>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-3 py-2">Key</th><th className="px-3 py-2">Label</th><th className="px-3 py-2">Example</th><th className="px-3 py-2 text-center">Type</th><th className="px-3 py-2 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y">
                {fields.map((f) => (
                  <tr key={f.id}>
                    <td className="px-3 py-2 font-mono text-xs">{`{{${f.key}}}`}</td>
                    <td className="px-3 py-2">{f.label}</td>
                    <td className="px-3 py-2 text-muted-foreground">{f.example_value || '—'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${f.builtin ? 'bg-blue-100 text-blue-700' : 'bg-accent text-accent-foreground'}`}>
                        {f.builtin ? 'Built-in' : 'Custom'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!f.builtin && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteField(f.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {fields.length === 0 && <p className="text-sm text-muted-foreground">No merge fields registered.</p>}
        </div>
      )}

      <TemplateFormDialog
        open={formOpen}
        template={editing}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }}
        onSave={handleSaveTemplate}
        categories={categoryNames}
      />

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the communication template. Consider archiving instead.</AlertDialogDescription>
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
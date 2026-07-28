import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { CHAMPION_SITUATIONS, RESOURCE_CATEGORIES } from '@/lib/stewardshipGuideMatcher';
import { BUILTIN_MERGE_FIELDS } from '@/lib/mergeFields';

const EMPTY = {
  title: '', category: '', description: '', recommended_situations: [],
  body: '', suggested_tone: '', estimated_reading_time: '', tags: [],
  related_guides: [], related_resources: [], recommended_followup: '', admin_notes: '',
  enabled: true, archived: false, display_order: 100,
};

function deepCopy(t) {
  return {
    ...EMPTY,
    ...t,
    recommended_situations: [...(t?.recommended_situations || [])],
    tags: [...(t?.tags || [])],
    related_guides: [...(t?.related_guides || [])],
    related_resources: (t?.related_resources || []).map((r) => ({ ...r })),
  };
}

export default function TemplateFormDialog({ open, template, onOpenChange, onSave, categories }) {
  const [form, setForm] = useState(deepCopy(null));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(deepCopy(template));
  }, [open, template]);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const toggleInArray = (field, key) =>
    setForm((f) => ({ ...f, [field]: f[field].includes(key) ? f[field].filter((s) => s !== key) : [...f[field], key] }));

  const updateResource = (i, sub, value) =>
    setForm((f) => ({ ...f, related_resources: f.related_resources.map((r, idx) => (idx === i ? { ...r, [sub]: value } : r)) }));
  const addResource = () => setForm((f) => ({ ...f, related_resources: [...f.related_resources, { title: '', description: '', category: 'FamilyLife Materials' }] }));
  const removeResource = (i) => setForm((f) => ({ ...f, related_resources: f.related_resources.filter((_, idx) => idx !== i) }));

  const updateStr = (field, i, value) => setForm((f) => ({ ...f, [field]: f[field].map((s, idx) => (idx === i ? value : s)) }));
  const addStr = (field) => setForm((f) => ({ ...f, [field]: [...f[field], ''] }));
  const removeStr = (field, i) => setForm((f) => ({ ...f, [field]: f[field].filter((_, idx) => idx !== i) }));

  function insertMergeField(key) {
    setForm((f) => ({ ...f, body: (f.body || '') + ` {{${key}}}` }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        ...form,
        display_order: Number(form.display_order) || 100,
        tags: form.tags.filter(Boolean),
        related_guides: form.related_guides.filter(Boolean),
        related_resources: form.related_resources.filter((r) => r.title?.trim()),
      });
    } finally {
      setSaving(false);
    }
  }

  const categoryList = categories || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit Template' : 'Create Template'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. First Contact Text" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input list="comm-categories" value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="Select or type a new category" />
              <datalist id="comm-categories">
                {categoryList.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} placeholder="When to use this template…" />
          </div>

          <div className="space-y-1.5">
            <Label>Recommended Situations</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CHAMPION_SITUATIONS.map((s) => (
                <label key={s.key} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <input type="checkbox" checked={form.recommended_situations.includes(s.key)} onChange={() => toggleInArray('recommended_situations', s.key)} className="h-4 w-4 rounded border-input accent-primary" />
                  {s.label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Template Body</Label>
            <Textarea value={form.body} onChange={(e) => set('body', e.target.value)} rows={8} placeholder="Write the message. Use {{MergeField}} for personalization." />
            <div className="flex flex-wrap gap-1.5">
              {BUILTIN_MERGE_FIELDS.map((mf) => (
                <button key={mf.key} type="button" onClick={() => insertMergeField(mf.key)} className="rounded-full border bg-background px-2 py-0.5 text-[11px] text-foreground hover:border-primary/40">
                  {`{{${mf.key}}}`}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Suggested Tone</Label>
              <Input value={form.suggested_tone} onChange={(e) => set('suggested_tone', e.target.value)} placeholder="Warm, brief" />
            </div>
            <div className="space-y-1.5">
              <Label>Est. Reading Time</Label>
              <Input value={form.estimated_reading_time} onChange={(e) => set('estimated_reading_time', e.target.value)} placeholder="~30 sec" />
            </div>
            <div className="space-y-1.5">
              <Label>Display Order</Label>
              <Input type="number" value={form.display_order} onChange={(e) => set('display_order', e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Tags (comma-separated)</Label>
            <Input value={form.tags.join(', ')} onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))} placeholder="welcome, first contact" />
          </div>

          <div className="space-y-1.5">
            <Label>Related Stewardship Guides (titles, comma-separated)</Label>
            <Input value={form.related_guides.join(', ')} onChange={(e) => set('related_guides', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))} placeholder="First Contact, Building Trust" />
          </div>

          <div className="space-y-2">
            <Label>Related Resources</Label>
            {form.related_resources.map((r, i) => (
              <div key={i} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Resource {i + 1}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeResource(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
                <Input value={r.title} onChange={(e) => updateResource(i, 'title', e.target.value)} placeholder="Title" />
                <Input value={r.description} onChange={(e) => updateResource(i, 'description', e.target.value)} placeholder="Description" />
                <Select value={r.category || 'FamilyLife Materials'} onValueChange={(v) => updateResource(i, 'category', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RESOURCE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addResource}><Plus className="h-4 w-4" /> Add Resource</Button>
          </div>

          <div className="space-y-1.5">
            <Label>Recommended Follow-up</Label>
            <Input value={form.recommended_followup} onChange={(e) => set('recommended_followup', e.target.value)} placeholder="e.g. Follow up in 3 days if no reply" />
          </div>

          <div className="space-y-1.5">
            <Label>Administrator Notes</Label>
            <Textarea value={form.admin_notes} onChange={(e) => set('admin_notes', e.target.value)} rows={2} placeholder="Internal notes (not shown to volunteers)" />
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 rounded-md border p-2 text-sm">
              <input type="checkbox" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} className="h-4 w-4 rounded border-input accent-primary" />
              Enabled
            </label>
            <label className="flex items-center gap-2 rounded-md border p-2 text-sm">
              <input type="checkbox" checked={form.archived} onChange={(e) => set('archived', e.target.checked)} className="h-4 w-4 rounded border-input accent-primary" />
              Archived
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.title.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {template ? 'Save Changes' : 'Create Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
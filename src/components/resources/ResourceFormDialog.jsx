import React, { useState, useEffect } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
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
import { RESOURCE_TYPES, DEFAULT_LIFE_STAGES, DEFAULT_MINISTRY_SITUATIONS } from '@/lib/resourceTypes';

const EMPTY = {
  title: '', subtitle: '', description: '', summary: '',
  author: '', organization: '', publisher: '', publication_date: '',
  resource_type: 'Articles', category: '', language: 'English',
  internal_external: 'Internal', featured: false, active: true, archived: false,
  topics: [], tags: [], life_stages: [], ministry_situations: [], scripture_topics: [],
  estimated_reading_time: '', estimated_viewing_time: '',
  thumbnail_url: '', content_url: '', download_url: '', external_url: '',
  related_guides: [], related_templates: [], related_resources: [],
  admin_notes: '', display_order: 100,
};

function deepCopy(r) {
  return {
    ...EMPTY,
    ...r,
    topics: [...(r?.topics || [])],
    tags: [...(r?.tags || [])],
    life_stages: [...(r?.life_stages || [])],
    ministry_situations: [...(r?.ministry_situations || [])],
    scripture_topics: [...(r?.scripture_topics || [])],
    related_guides: [...(r?.related_guides || [])],
    related_templates: [...(r?.related_templates || [])],
    related_resources: [...(r?.related_resources || [])],
  };
}

function StringList({ label, items, placeholder, datalistId, onChange }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Textarea
        value={items.join('\n')}
        onChange={(e) => onChange(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
        rows={Math.min(items.length + 1, 4)}
        placeholder={placeholder}
        className="text-sm"
        list={datalistId}
      />
      {datalistId && (
        <datalist id={datalistId}>
          {/* Populated by parent via options prop if needed */}
        </datalist>
      )}
    </div>
  );
}

export default function ResourceFormDialog({ open, resource, onOpenChange, onSave, categories, guideTitles, templateTitles }) {
  const [form, setForm] = useState(deepCopy(null));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(deepCopy(resource));
  }, [open, resource]);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        ...form,
        display_order: Number(form.display_order) || 100,
      });
    } finally {
      setSaving(false);
    }
  }

  const catList = categories || [];
  const guideList = guideTitles || [];
  const templateList = templateTitles || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{resource ? 'Edit Resource' : 'Create Resource'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Basic Info */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Resource title" />
            </div>
            <div className="space-y-1.5">
              <Label>Subtitle</Label>
              <Input value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} placeholder="Optional subtitle" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} placeholder="Short description for cards and lists" />
            </div>
            <div className="space-y-1.5">
              <Label>Summary</Label>
              <Textarea value={form.summary} onChange={(e) => set('summary', e.target.value)} rows={3} placeholder="Longer summary for the detail page" />
            </div>
          </div>

          {/* Authorship */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Author</Label>
              <Input value={form.author} onChange={(e) => set('author', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Organization</Label>
              <Input value={form.organization} onChange={(e) => set('organization', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Publisher</Label>
              <Input value={form.publisher} onChange={(e) => set('publisher', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Publication Date</Label>
              <Input type="date" value={form.publication_date} onChange={(e) => set('publication_date', e.target.value)} />
            </div>
          </div>

          {/* Classification */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Resource Type</Label>
              <Select value={form.resource_type} onValueChange={(v) => set('resource_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RESOURCE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input list="res-categories" value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="Select or type" />
              <datalist id="res-categories">{catList.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="space-y-1.5">
              <Label>Internal / External</Label>
              <Select value={form.internal_external} onValueChange={(v) => set('internal_external', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Internal">Internal</SelectItem>
                  <SelectItem value="External">External</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Topics & Tags */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StringList label="Topics (one per line)" items={form.topics} placeholder="e.g. Communication" onChange={(v) => set('topics', v)} />
            <StringList label="Tags (one per line)" items={form.tags} placeholder="e.g. newlyweds" onChange={(v) => set('tags', v)} />
            <StringList label="Life Stages (one per line)" items={form.life_stages} placeholder="Newly Married" onChange={(v) => set('life_stages', v)} />
            <StringList label="Ministry Situations (one per line)" items={form.ministry_situations} placeholder="New Champion" onChange={(v) => set('ministry_situations', v)} />
          </div>

          {/* Time Estimates */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Estimated Reading Time</Label>
              <Input value={form.estimated_reading_time} onChange={(e) => set('estimated_reading_time', e.target.value)} placeholder="~5 min" />
            </div>
            <div className="space-y-1.5">
              <Label>Estimated Viewing Time</Label>
              <Input value={form.estimated_viewing_time} onChange={(e) => set('estimated_viewing_time', e.target.value)} placeholder="~12 min" />
            </div>
          </div>

          {/* Links */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Thumbnail Image URL</Label>
              <Input value={form.thumbnail_url} onChange={(e) => set('thumbnail_url', e.target.value)} placeholder="https://…" />
            </div>
            <div className="space-y-1.5">
              <Label>Content / Launch URL</Label>
              <Input value={form.content_url} onChange={(e) => set('content_url', e.target.value)} placeholder="https://…" />
            </div>
            <div className="space-y-1.5">
              <Label>Download URL</Label>
              <Input value={form.download_url} onChange={(e) => set('download_url', e.target.value)} placeholder="https://…" />
            </div>
            <div className="space-y-1.5">
              <Label>External Link URL</Label>
              <Input value={form.external_url} onChange={(e) => set('external_url', e.target.value)} placeholder="https://…" />
            </div>
          </div>

          {/* Relationships */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StringList label="Related Stewardship Guides (titles, one per line)" items={form.related_guides} placeholder="First Contact" onChange={(v) => set('related_guides', v)} />
            <StringList label="Related Communication Templates (titles, one per line)" items={form.related_templates} placeholder="First Contact Text" onChange={(v) => set('related_templates', v)} />
            <StringList label="Related Scripture Topics (one per line)" items={form.scripture_topics} placeholder="Forgiveness" onChange={(v) => set('scripture_topics', v)} />
            <StringList label="Related Resource Recommendations (titles, one per line)" items={form.related_resources} placeholder="Another resource title" onChange={(v) => set('related_resources', v)} />
          </div>

          {/* Status */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="flex items-center gap-2 rounded-md border p-2 text-sm">
              <input type="checkbox" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} className="h-4 w-4 rounded border-input accent-primary" />
              Featured
            </label>
            <label className="flex items-center gap-2 rounded-md border p-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} className="h-4 w-4 rounded border-input accent-primary" />
              Active
            </label>
            <label className="flex items-center gap-2 rounded-md border p-2 text-sm">
              <input type="checkbox" checked={form.archived} onChange={(e) => set('archived', e.target.checked)} className="h-4 w-4 rounded border-input accent-primary" />
              Archived
            </label>
            <div className="space-y-1">
              <Label className="text-xs">Order</Label>
              <Input type="number" value={form.display_order} onChange={(e) => set('display_order', e.target.value)} className="h-8" />
            </div>
          </div>

          {/* Language */}
          <div className="space-y-1.5">
            <Label>Language</Label>
            <Input value={form.language} onChange={(e) => set('language', e.target.value)} />
          </div>

          {/* Admin Notes */}
          <div className="space-y-1.5">
            <Label>Administrative Notes</Label>
            <Textarea value={form.admin_notes} onChange={(e) => set('admin_notes', e.target.value)} rows={2} placeholder="Internal notes (not shown to volunteers)" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.title.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {resource ? 'Save Changes' : 'Create Resource'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
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
import { CHAMPION_SITUATIONS, GUIDE_CATEGORIES } from '@/lib/stewardshipGuideMatcher';

const EMPTY = {
  title: '',
  category: 'General',
  situations: [],
  overview: '',
  suggested_approaches: [],
  conversation_ideas: [],
  scripture_encouragement: '',
  helpful_resources: [],
  things_to_remember: [],
  display_order: 100,
  enabled: true,
  archived: false,
};

function deepCopy(g) {
  return {
    ...EMPTY,
    ...g,
    situations: [...(g?.situations || [])],
    suggested_approaches: (g?.suggested_approaches || []).map((a) => ({ ...a })),
    conversation_ideas: [...(g?.conversation_ideas || [])],
    helpful_resources: (g?.helpful_resources || []).map((r) => ({ ...r })),
    things_to_remember: [...(g?.things_to_remember || [])],
  };
}

export default function GuideFormDialog({ open, guide, onOpenChange, onSave }) {
  const [form, setForm] = useState(deepCopy(null));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(deepCopy(guide));
  }, [open, guide]);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const toggleSituation = (key) => {
    setForm((f) => ({
      ...f,
      situations: f.situations.includes(key)
        ? f.situations.filter((s) => s !== key)
        : [...f.situations, key],
    }));
  };

  // Array-of-objects helpers
  const updateApproach = (i, field, value) =>
    setForm((f) => ({
      ...f,
      suggested_approaches: f.suggested_approaches.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)),
    }));
  const addApproach = () =>
    setForm((f) => ({ ...f, suggested_approaches: [...f.suggested_approaches, { title: '', description: '', why_effective: '' }] }));
  const removeApproach = (i) =>
    setForm((f) => ({ ...f, suggested_approaches: f.suggested_approaches.filter((_, idx) => idx !== i) }));

  const updateResource = (i, field, value) =>
    setForm((f) => ({
      ...f,
      helpful_resources: f.helpful_resources.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)),
    }));
  const addResource = () =>
    setForm((f) => ({ ...f, helpful_resources: [...f.helpful_resources, { title: '', description: '' }] }));
  const removeResource = (i) =>
    setForm((f) => ({ ...f, helpful_resources: f.helpful_resources.filter((_, idx) => idx !== i) }));

  // Array-of-strings helpers
  const updateStringItem = (field, i, value) =>
    setForm((f) => ({ ...f, [field]: f[field].map((s, idx) => (idx === i ? value : s)) }));
  const addStringItem = (field) => setForm((f) => ({ ...f, [field]: [...f[field], ''] }));
  const removeStringItem = (field, i) =>
    setForm((f) => ({ ...f, [field]: f[field].filter((_, idx) => idx !== i) }));

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        ...form,
        display_order: Number(form.display_order) || 100,
        suggested_approaches: form.suggested_approaches.filter((a) => a.title?.trim()),
        helpful_resources: form.helpful_resources.filter((r) => r.title?.trim()),
        conversation_ideas: form.conversation_ideas.filter((s) => s.trim()),
        things_to_remember: form.things_to_remember.filter((s) => s.trim()),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{guide ? 'Edit Stewardship Guide' : 'Create Stewardship Guide'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. First Contact" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => set('category', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GUIDE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Champion Situations</Label>
            <p className="text-xs text-muted-foreground">Select the ministry situations this Guide applies to.</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CHAMPION_SITUATIONS.map((s) => (
                <label key={s.key} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.situations.includes(s.key)}
                    onChange={() => toggleSituation(s.key)}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Overview</Label>
            <Textarea
              value={form.overview}
              onChange={(e) => set('overview', e.target.value)}
              rows={3}
              placeholder="Describe when this Guide is useful…"
            />
          </div>

          {/* Suggested Approaches */}
          <div className="space-y-2">
            <Label>Suggested Approaches</Label>
            {form.suggested_approaches.map((a, i) => (
              <div key={i} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Approach {i + 1}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeApproach(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Input value={a.title} onChange={(e) => updateApproach(i, 'title', e.target.value)} placeholder="Title (e.g. Friendly Text Message)" />
                <Textarea value={a.description} onChange={(e) => updateApproach(i, 'description', e.target.value)} rows={2} placeholder="Description" />
                <Textarea value={a.why_effective} onChange={(e) => updateApproach(i, 'why_effective', e.target.value)} rows={2} placeholder="Why this approach may be effective" />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addApproach}><Plus className="h-4 w-4" /> Add Approach</Button>
          </div>

          {/* Conversation Ideas */}
          <StringListEditor
            label="Conversation Ideas"
            items={form.conversation_ideas}
            placeholder="A conversation prompt (not a script)…"
            onChange={(i, v) => updateStringItem('conversation_ideas', i, v)}
            onAdd={() => addStringItem('conversation_ideas')}
            onRemove={(i) => removeStringItem('conversation_ideas', i)}
          />

          <div className="space-y-1.5">
            <Label>Scripture & Encouragement</Label>
            <Textarea
              value={form.scripture_encouragement}
              onChange={(e) => set('scripture_encouragement', e.target.value)}
              rows={3}
              placeholder="Bible passages, encouragement, and prayer ideas…"
            />
          </div>

          {/* Helpful Resources */}
          <div className="space-y-2">
            <Label>Helpful Resources</Label>
            {form.helpful_resources.map((r, i) => (
              <div key={i} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Resource {i + 1}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeResource(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Input value={r.title} onChange={(e) => updateResource(i, 'title', e.target.value)} placeholder="Resource title" />
                <Input value={r.description} onChange={(e) => updateResource(i, 'description', e.target.value)} placeholder="Short description" />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addResource}><Plus className="h-4 w-4" /> Add Resource</Button>
          </div>

          {/* Things to Remember */}
          <StringListEditor
            label="Things to Remember"
            items={form.things_to_remember}
            placeholder="Practical ministry wisdom…"
            onChange={(i, v) => updateStringItem('things_to_remember', i, v)}
            onAdd={() => addStringItem('things_to_remember')}
            onRemove={(i) => removeStringItem('things_to_remember', i)}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Display Order</Label>
              <Input type="number" value={form.display_order} onChange={(e) => set('display_order', e.target.value)} />
            </div>
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
            {guide ? 'Save Changes' : 'Create Guide'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StringListEditor({ label, items, placeholder, onChange, onAdd, onRemove }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input value={item} onChange={(e) => onChange(i, e.target.value)} placeholder={placeholder} />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => onRemove(i)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={onAdd}><Plus className="h-4 w-4" /> Add</Button>
    </div>
  );
}
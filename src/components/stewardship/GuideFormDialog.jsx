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
import { CHAMPION_SITUATIONS, GUIDE_CATEGORIES, RESOURCE_CATEGORIES } from '@/lib/stewardshipGuideMatcher';

const EMPTY = {
  title: '', category: 'Relationship Building', situations: [], tags: [],
  overview: '', suggested_approaches: [], conversation_ideas: [], prayer_prompts: [],
  scriptures: [], wisdom_callouts: [], helpful_resources: [], things_to_remember: [],
  reflection_questions: [], related_guides: [],
  display_order: 100, enabled: true, archived: false,
};

function deepCopy(g) {
  return {
    ...EMPTY,
    ...g,
    situations: [...(g?.situations || [])],
    tags: [...(g?.tags || [])],
    suggested_approaches: (g?.suggested_approaches || []).map((a) => ({ ...a })),
    conversation_ideas: [...(g?.conversation_ideas || [])],
    prayer_prompts: [...(g?.prayer_prompts || [])],
    scriptures: (g?.scriptures || []).map((s) => ({ ...s })),
    wisdom_callouts: (g?.wisdom_callouts || []).map((c) => ({ ...c })),
    helpful_resources: (g?.helpful_resources || []).map((r) => ({ ...r })),
    things_to_remember: [...(g?.things_to_remember || [])],
    reflection_questions: [...(g?.reflection_questions || [])],
    related_guides: [...(g?.related_guides || [])],
  };
}

export default function GuideFormDialog({ open, guide, onOpenChange, onSave }) {
  const [form, setForm] = useState(deepCopy(null));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(deepCopy(guide));
  }, [open, guide]);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const toggleInArray = (field, key) =>
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(key) ? f[field].filter((s) => s !== key) : [...f[field], key],
    }));

  // Object-array editor helper
  const updateObj = (field, i, sub, value) =>
    setForm((f) => ({ ...f, [field]: f[field].map((item, idx) => (idx === i ? { ...item, [sub]: value } : item)) }));
  const addObj = (field, template) => setForm((f) => ({ ...f, [field]: [...f[field], { ...template }] }));
  const removeObj = (field, i) => setForm((f) => ({ ...f, [field]: f[field].filter((_, idx) => idx !== i) }));

  // String-array helper
  const updateStr = (field, i, value) =>
    setForm((f) => ({ ...f, [field]: f[field].map((s, idx) => (idx === i ? value : s)) }));
  const addStr = (field) => setForm((f) => ({ ...f, [field]: [...f[field], ''] }));
  const removeStr = (field, i) => setForm((f) => ({ ...f, [field]: f[field].filter((_, idx) => idx !== i) }));

  async function handleSave() {
    setSaving(true);
    try {
      const clean = (arr) => (arr || []).filter((x) =>
        typeof x === 'string' ? x.trim() : x.title?.trim() || x.reference?.trim() || x.content?.trim() || x.label?.trim()
      );
      await onSave({
        ...form,
        display_order: Number(form.display_order) || 100,
        suggested_approaches: clean(form.suggested_approaches),
        scriptures: clean(form.scriptures),
        wisdom_callouts: clean(form.wisdom_callouts),
        helpful_resources: form.helpful_resources.filter((r) => r.title?.trim()),
        conversation_ideas: form.conversation_ideas.filter((s) => s.trim()),
        prayer_prompts: form.prayer_prompts.filter((s) => s.trim()),
        things_to_remember: form.things_to_remember.filter((s) => s.trim()),
        reflection_questions: form.reflection_questions.filter((s) => s.trim()),
        related_guides: form.related_guides.filter((s) => s.trim()),
        tags: form.tags.filter((s) => s.trim()),
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CHAMPION_SITUATIONS.map((s) => (
                <label key={s.key} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <input type="checkbox" checked={form.situations.includes(s.key)} onChange={() => toggleInArray('situations', s.key)} className="h-4 w-4 rounded border-input accent-primary" />
                  {s.label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Tags</Label>
            <p className="text-xs text-muted-foreground">Comma-separated keywords to improve search.</p>
            <Input value={form.tags.join(', ')} onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))} placeholder="trust, listening, new champion" />
          </div>

          <div className="space-y-1.5">
            <Label>Overview</Label>
            <Textarea value={form.overview} onChange={(e) => set('overview', e.target.value)} rows={3} placeholder="Describe when this Guide is useful…" />
          </div>

          {/* Suggested Approaches */}
          <div className="space-y-2">
            <Label>Suggested Approaches</Label>
            {form.suggested_approaches.map((a, i) => (
              <div key={i} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Approach {i + 1}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeObj('suggested_approaches', i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
                <Input value={a.title} onChange={(e) => updateObj('suggested_approaches', i, 'title', e.target.value)} placeholder="Title (e.g. Friendly Text Message)" />
                <Textarea value={a.description} onChange={(e) => updateObj('suggested_approaches', i, 'description', e.target.value)} rows={2} placeholder="Description" />
                <Textarea value={a.why_effective} onChange={(e) => updateObj('suggested_approaches', i, 'why_effective', e.target.value)} rows={2} placeholder="Why this approach may be effective" />
                <Textarea value={a.when_it_works} onChange={(e) => updateObj('suggested_approaches', i, 'when_it_works', e.target.value)} rows={2} placeholder="When it works well" />
                <Textarea value={a.when_to_consider_alternative} onChange={(e) => updateObj('suggested_approaches', i, 'when_to_consider_alternative', e.target.value)} rows={2} placeholder="When another approach might be better" />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addObj('suggested_approaches', { title: '', description: '', why_effective: '', when_it_works: '', when_to_consider_alternative: '' })}><Plus className="h-4 w-4" /> Add Approach</Button>
          </div>

          <StringList label="Conversation Starters" items={form.conversation_ideas} placeholder="An open-ended question that invites sharing…" onChange={(i, v) => updateStr('conversation_ideas', i, v)} onAdd={() => addStr('conversation_ideas')} onRemove={(i) => removeStr('conversation_ideas', i)} />
          <StringList label="Prayer Prompts" items={form.prayer_prompts} placeholder="A short prayer prompt…" onChange={(i, v) => updateStr('prayer_prompts', i, v)} onAdd={() => addStr('prayer_prompts')} onRemove={(i) => removeStr('prayer_prompts', i)} />
          <StringList label="Reflection Questions" items={form.reflection_questions} placeholder="A reflection question for the leader…" onChange={(i, v) => updateStr('reflection_questions', i, v)} onAdd={() => addStr('reflection_questions')} onRemove={(i) => removeStr('reflection_questions', i)} />
          <StringList label="Things to Remember" items={form.things_to_remember} placeholder="Practical ministry wisdom…" onChange={(i, v) => updateStr('things_to_remember', i, v)} onAdd={() => addStr('things_to_remember')} onRemove={(i) => removeStr('things_to_remember', i)} />
          <StringList label="Related Guides (titles)" items={form.related_guides} placeholder="Exact title of another guide…" onChange={(i, v) => updateStr('related_guides', i, v)} onAdd={() => addStr('related_guides')} onRemove={(i) => removeStr('related_guides', i)} />

          {/* Scriptures */}
          <div className="space-y-2">
            <Label>Scripture & Encouragement</Label>
            {form.scriptures.map((s, i) => (
              <div key={i} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Scripture {i + 1}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeObj('scriptures', i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
                <Input value={s.topic} onChange={(e) => updateObj('scriptures', i, 'topic', e.target.value)} placeholder="Topic (e.g. Encouragement)" />
                <Input value={s.reference} onChange={(e) => updateObj('scriptures', i, 'reference', e.target.value)} placeholder="Reference (e.g. 1 Thess 5:11)" />
                <Textarea value={s.encouragement} onChange={(e) => updateObj('scriptures', i, 'encouragement', e.target.value)} rows={2} placeholder="Short encouragement" />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addObj('scriptures', { topic: '', reference: '', encouragement: '' })}><Plus className="h-4 w-4" /> Add Scripture</Button>
          </div>

          {/* Ministry Wisdom Callouts */}
          <div className="space-y-2">
            <Label>Ministry Wisdom Callouts</Label>
            {form.wisdom_callouts.map((c, i) => (
              <div key={i} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Callout {i + 1}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeObj('wisdom_callouts', i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
                <Input value={c.label} onChange={(e) => updateObj('wisdom_callouts', i, 'label', e.target.value)} placeholder="Label (e.g. Experienced Leaders Often Notice…)" />
                <Textarea value={c.content} onChange={(e) => updateObj('wisdom_callouts', i, 'content', e.target.value)} rows={2} placeholder="Practical observation from experienced leaders" />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addObj('wisdom_callouts', { label: '', content: '' })}><Plus className="h-4 w-4" /> Add Callout</Button>
          </div>

          {/* Helpful Resources */}
          <div className="space-y-2">
            <Label>Helpful Resources</Label>
            {form.helpful_resources.map((r, i) => (
              <div key={i} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Resource {i + 1}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeObj('helpful_resources', i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
                <Input value={r.title} onChange={(e) => updateObj('helpful_resources', i, 'title', e.target.value)} placeholder="Resource title" />
                <Input value={r.description} onChange={(e) => updateObj('helpful_resources', i, 'description', e.target.value)} placeholder="Short description" />
                <Select value={r.category || 'FamilyLife Materials'} onValueChange={(v) => updateObj('helpful_resources', i, 'category', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RESOURCE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addObj('helpful_resources', { title: '', description: '', category: 'FamilyLife Materials' })}><Plus className="h-4 w-4" /> Add Resource</Button>
          </div>

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

function StringList({ label, items, placeholder, onChange, onAdd, onRemove }) {
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
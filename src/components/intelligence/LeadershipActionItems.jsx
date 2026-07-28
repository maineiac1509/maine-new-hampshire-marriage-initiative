import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Circle, Loader2, Plus, Trash2, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';

const PROGRESS_TONE = {
  'Not Started': 'bg-slate-100 text-slate-600',
  'In Progress': 'bg-blue-100 text-blue-700',
  'Completed': 'bg-emerald-100 text-emerald-700',
};

export default function LeadershipActionItems({ signalId, onChanged }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ assigned_to: '', due_date: '', priority: 'Medium', progress: 'Not Started' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.LeadershipActionItem.filter({ signal_id: signalId });
      setItems(list || []);
    } catch (e) { setItems([]); }
    setLoading(false);
  }, [signalId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!form.assigned_to.trim()) return;
    try {
      await base44.entities.LeadershipActionItem.create({ ...form, signal_id: signalId });
      setForm({ assigned_to: '', due_date: '', priority: 'Medium', progress: 'Not Started' });
      setAdding(false);
      load(); onChanged?.();
    } catch (e) {}
  }

  async function updateProgress(id, progress) {
    try { await base44.entities.LeadershipActionItem.update(id, { progress }); load(); onChanged?.(); } catch (e) {}
  }

  async function updateField(id, field, value) {
    try { await base44.entities.LeadershipActionItem.update(id, { [field]: value }); load(); onChanged?.(); } catch (e) {}
  }

  async function remove(id) {
    try { await base44.entities.LeadershipActionItem.delete(id); load(); onChanged?.(); } catch (e) {}
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <UserCog className="h-4 w-4 text-muted-foreground" /> Leadership Action Items
        </h4>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Action
          </Button>
        )}
      </div>

      {adding && (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Assigned To</Label>
              <Input value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} placeholder="Regional Director" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Due Date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={form.progress} onValueChange={(v) => setForm({ ...form, progress: v })}>
              <SelectTrigger><SelectValue placeholder="Progress" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Not Started">Not Started</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={!form.assigned_to.trim()}>Save</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : items.length ? (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="rounded-lg border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{it.assigned_to || 'Unassigned'}</p>
                  <p className="text-xs text-muted-foreground">
                    {it.due_date ? `Due ${it.due_date}` : 'No due date'} · {it.priority} priority
                  </p>
                </div>
                <button onClick={() => remove(it.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Select value={it.progress || 'Not Started'} onValueChange={(v) => updateProgress(it.id, v)}>
                  <SelectTrigger className="h-7 w-auto gap-1 text-xs">
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', PROGRESS_TONE[it.progress || 'Not Started'])}>
                      {it.progress === 'Completed' ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                      {it.progress || 'Not Started'}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Not Started">Not Started</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                className="mt-2 text-xs"
                placeholder="Outcome notes…"
                defaultValue={it.outcome_notes || ''}
                onBlur={(e) => { if (e.target.value !== (it.outcome_notes || '')) updateField(it.id, 'outcome_notes', e.target.value); }}
                rows={2}
              />
            </div>
          ))}
        </div>
      ) : (
        !adding && <p className="text-xs text-muted-foreground">No action items yet — record what leadership decided to do about this signal.</p>
      )}
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ACTIVITY_TYPE_OPTIONS, CONTACT_METHOD_OPTIONS, CONTACT_OUTCOME_OPTIONS, OUTCOME_STATUS_SUGGESTIONS } from '@/lib/config';
import { Loader2, Sparkles } from 'lucide-react';
import RelationshipStatusBadge from './RelationshipStatusBadge';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY = {
  activity_date: todayStr(),
  activity_type: 'Phone Call',
  contact_method: '',
  outcome: '',
  summary: '',
  detailed_notes: '',
  follow_up_required: false,
  follow_up_date: '',
};

export default function LogInteractionDialog({
  open,
  onOpenChange,
  householdId,
  activity,
  onSaved,
  onStatusChanged,
  currentStatus,
  canChangeStatus,
}) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [suggestion, setSuggestion] = useState(null);
  const [suggesting, setSuggesting] = useState(false);

  useEffect(() => {
    if (open) {
      setError('');
      setSuggestion(null);
      setForm(activity ? { ...activity } : { ...EMPTY, activity_date: todayStr() });
    }
  }, [open, activity]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    setError('');
    if (!form.activity_date || !form.activity_type || !form.summary?.trim()) {
      setError('Activity date, type, and summary are required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        household_id: householdId,
        activity_date: form.activity_date,
        activity_type: form.activity_type,
        contact_method: form.contact_method || '',
        outcome: form.outcome || '',
        summary: form.summary.trim(),
        detailed_notes: form.detailed_notes || '',
        follow_up_required: !!form.follow_up_required,
        follow_up_date: form.follow_up_required ? (form.follow_up_date || '') : '',
      };
      if (activity?.id) {
        await base44.entities.ChampionActivity.update(activity.id, payload);
      } else {
        await base44.entities.ChampionActivity.create(payload);
      }

      // Optional status suggestion — never auto-changes; user must confirm.
      const suggested = OUTCOME_STATUS_SUGGESTIONS[form.outcome];
      if (
        suggested &&
        canChangeStatus &&
        currentStatus &&
        suggested !== currentStatus
      ) {
        setSuggestion(suggested);
        onSaved?.();
        return; // keep dialog open for the suggestion
      }

      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      setError(err.message || 'Failed to save activity.');
    } finally {
      setSaving(false);
    }
  }

  async function applySuggestion() {
    setSuggesting(true);
    try {
      await base44.entities.RelationshipStatusChange.create({
        household_id: householdId,
        previous_status: currentStatus,
        new_status: suggestion,
        change_date: todayStr(),
      });
      await base44.entities.ChampionHousehold.update(householdId, {
        relationship_status: suggestion,
      });
      onStatusChanged?.();
      setSuggestion(null);
      onOpenChange(false);
    } catch (err) {
      setError(err.message || 'Failed to update status.');
    } finally {
      setSuggesting(false);
    }
  }

  function skipSuggestion() {
    setSuggestion(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{activity ? 'Edit Interaction' : 'Log Interaction'}</DialogTitle>
        </DialogHeader>

        {suggestion ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Based on this interaction, update the Relationship Status?
                </p>
                <div className="flex items-center gap-2">
                  <RelationshipStatusBadge status={currentStatus} />
                  <span className="text-muted-foreground">→</span>
                  <RelationshipStatusBadge status={suggestion} />
                </div>
                <p className="text-xs text-muted-foreground">
                  This will be recorded in the Relationship Timeline.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-h-[65vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Activity Date</Label>
                <Input type="date" value={form.activity_date || ''} onChange={(e) => set('activity_date', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Activity Type</Label>
                <Select value={form.activity_type || ''} onValueChange={(v) => set('activity_type', v)}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_TYPE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Contact Method</Label>
                <Select value={form.contact_method || ''} onValueChange={(v) => set('contact_method', v)}>
                  <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                  <SelectContent>
                    {CONTACT_METHOD_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Outcome</Label>
                <Select value={form.outcome || ''} onValueChange={(v) => set('outcome', v)}>
                  <SelectTrigger><SelectValue placeholder="Select outcome" /></SelectTrigger>
                  <SelectContent>
                    {CONTACT_OUTCOME_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Summary</Label>
                <Input value={form.summary || ''} onChange={(e) => set('summary', e.target.value)} placeholder="Brief one-line summary" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Detailed Notes</Label>
                <Textarea
                  value={form.detailed_notes || ''}
                  onChange={(e) => set('detailed_notes', e.target.value)}
                  rows={4}
                  placeholder="Conversation details, what was discussed, next steps…"
                />
              </div>
              <div className="flex items-center gap-3 sm:col-span-2">
                <Switch
                  id="follow-up"
                  checked={!!form.follow_up_required}
                  onCheckedChange={(v) => set('follow_up_required', v)}
                />
                <Label htmlFor="follow-up">Follow-up Required</Label>
              </div>
              {form.follow_up_required && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Follow-up Date</Label>
                  <Input type="date" value={form.follow_up_date || ''} onChange={(e) => set('follow_up_date', e.target.value)} />
                </div>
              )}
              {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
            </div>
          </div>
        )}

        <DialogFooter>
          {suggestion ? (
            <>
              <Button variant="outline" onClick={skipSuggestion} disabled={suggesting}>Skip</Button>
              <Button onClick={applySuggestion} disabled={suggesting}>
                {suggesting && <Loader2 className="h-4 w-4 animate-spin" />}
                Update Status
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {activity ? 'Save Changes' : 'Save'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
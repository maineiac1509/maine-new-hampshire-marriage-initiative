import React, { useState, useEffect } from 'react';
import { Loader2, Users as UsersIcon, Check, ChevronRight, ChevronLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { householdDisplay } from '@/lib/teamUtils';
import { todayISO, actorName, recordAssignmentEvent, recordChampionMilestone, recordTeamMilestone } from '@/lib/assignmentEvents';

const STEPS = ['Select Relationship Builder', 'Details', 'Review'];

export default function CreateAssignmentDialog({ open, onOpenChange, champion, currentUser, onCreated }) {
  const [step, setStep] = useState(1);
  const [teams, setTeams] = useState([]);
  const [champions, setChampions] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [form, setForm] = useState({ reason: '', notes: '', assigned_by: '', assigned_date: todayISO() });
  const [saving, setSaving] = useState(false);
  const [allAssignments, setAllAssignments] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSelectedTeam(null);
    setError('');
    setForm({ reason: '', notes: '', assigned_by: actorName(currentUser), assigned_date: todayISO() });
    setLoadingTeams(true);
    Promise.all([
      base44.entities.VolunteerTeam.list(),
      base44.entities.ChampionHousehold.list(),
      base44.entities.Assignment.list(),
    ])
      .then(([ts, chs, asgs]) => {
        setTeams((ts || []).filter((t) => t.active !== false));
        setChampions(chs || []);
        setAllAssignments(asgs || []);
      })
      .catch(() => {})
      .finally(() => setLoadingTeams(false));
  }, [open, currentUser]);

  function teamCapacity(team) {
    const activeHouseholdIds = new Set(
      allAssignments
        .filter((a) => a.volunteer_team_id === team.id && a.assignment_status === 'Active')
        .map((a) => a.household_id)
    );
    const active = champions.filter(
      (c) => activeHouseholdIds.has(c.id) && c.relationship_status !== 'Inactive'
    ).length;
    const target = Number(team.target_capacity) || 12;
    return { active, target, remaining: Math.max(target - active, 0) };
  }

  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  function next() {
    setError('');
    if (step === 1 && !selectedTeam) { setError('Please select an MC Relationship Builder.'); return; }
    if (step === 2 && !form.reason.trim()) { setError('Assignment Reason is required.'); return; }
    setStep((s) => Math.min(s + 1, 3));
  }
  function back() { setError(''); setStep((s) => Math.max(s - 1, 1)); }

  async function handleConfirm() {
    setSaving(true);
    setError('');
    try {
      // Business rule: one Active Assignment per Champion.
      const existing = await base44.entities.Assignment.filter({
        household_id: champion.id,
        assignment_status: 'Active',
      });
      if (existing && existing.length) {
        setError('This Champion already has an active Assignment. Close it before creating a new one.');
        setSaving(false);
        return;
      }
      const created = await base44.entities.Assignment.create({
        household_id: champion.id,
        volunteer_team_id: selectedTeam.id,
        assigned_by: form.assigned_by,
        assigned_date: form.assigned_date,
        assignment_method: 'Manual',
        assignment_status: 'Active',
        assignment_reason: form.reason,
        assignment_notes: form.notes || undefined,
      });
      // Keep denormalized team reference in sync.
      await base44.entities.ChampionHousehold.update(champion.id, { volunteer_team_id: selectedTeam.id });
      const actor = actorName(currentUser);
      const champName = householdDisplay(champion);
      await recordAssignmentEvent({ assignmentId: created.id, type: 'Created', actor, summary: `Assigned to ${selectedTeam.team_name}` });
      await recordChampionMilestone({ householdId: champion.id, type: 'Assignment Created', assignmentId: created.id, summary: `Assigned to ${selectedTeam.team_name}` });
      await recordTeamMilestone({ teamId: selectedTeam.id, householdId: champion.id, type: 'Assignment Created', assignmentId: created.id, summary: `${champName} assigned` });
      onOpenChange(false);
      onCreated?.(created);
    } catch (e) {
      setError('Could not create the Assignment. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const champName = champion ? householdDisplay(champion) : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign Relationship Builder — {champName}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 text-xs">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <React.Fragment key={label}>
                <div className={`flex items-center gap-1.5 ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${active ? 'bg-primary text-primary-foreground' : done ? 'bg-emerald-500 text-white' : 'bg-muted'}`}>
                    {done ? <Check className="h-3 w-3" /> : n}
                  </span>
                  {label}
                </div>
                {i < STEPS.length - 1 && <div className="h-px w-6 bg-border" />}
              </React.Fragment>
            );
          })}
        </div>

        {step === 1 && (
          <div className="space-y-2">
            {loadingTeams ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : teams.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No active MC Relationship Builders available.</p>
            ) : (
              teams.map((t) => {
                const cap = teamCapacity(t);
                const selected = selectedTeam?.id === t.id;
                return (
                  <button key={t.id} type="button" onClick={() => setSelectedTeam(t)} className={`w-full rounded-lg border p-3 text-left transition-colors ${selected ? 'border-primary ring-1 ring-primary' : 'hover:bg-muted/40'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{t.team_name}</p>
                      {selected && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge variant="info">{cap.active} active</StatusBadge>
                      <StatusBadge variant="neutral">Target {cap.target}</StatusBadge>
                      <StatusBadge variant={cap.remaining > 0 ? 'success' : 'danger'}>{cap.remaining} remaining</StatusBadge>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Assignment Reason *</Label>
              <Input value={form.reason} onChange={(e) => setField('reason', e.target.value)} placeholder="Why is this Champion being assigned to this team?" />
            </div>
            <div className="space-y-1">
              <Label>Assignment Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setField('notes', e.target.value)} rows={3} placeholder="Optional stewardship notes…" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Assigned By</Label>
                <Input value={form.assigned_by} onChange={(e) => setField('assigned_by', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Assigned Date</Label>
                <Input type="date" value={form.assigned_date} onChange={(e) => setField('assigned_date', e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
            <div className="mb-2 flex items-center gap-2 text-muted-foreground"><UsersIcon className="h-4 w-4" /> Review Assignment</div>
            <ReviewRow label="Champion" value={champName} />
            <ReviewRow label="MC Relationship Builder" value={selectedTeam?.team_name} />
            <ReviewRow label="Assignment Reason" value={form.reason} />
            <ReviewRow label="Assigned By" value={form.assigned_by} />
            <ReviewRow label="Assignment Date" value={form.assigned_date} />
            {form.notes && <ReviewRow label="Notes" value={form.notes} />}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="justify-between sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <div className="flex gap-2">
            {step > 1 && <Button variant="outline" onClick={back} disabled={saving}><ChevronLeft className="h-4 w-4" /> Back</Button>}
            {step < 3 && <Button onClick={next}>Next <ChevronRight className="h-4 w-4" /></Button>}
            {step === 3 && <Button onClick={handleConfirm} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirm Assignment</Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="col-span-2 font-medium text-foreground">{value || '—'}</dd>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { householdDisplay } from '@/lib/teamUtils';
import { todayISO, actorName, recordAssignmentEvent, recordChampionMilestone, recordTeamMilestone } from '@/lib/assignmentEvents';

export default function CloseAssignmentDialog({ open, onOpenChange, assignment, champion, currentUser, onClosed }) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setReason(''); setNotes(''); setError(''); }
  }, [open]);

  async function handleClose() {
    if (!reason.trim()) { setError('A closing reason is required.'); return; }
    setSaving(true);
    setError('');
    try {
      await base44.entities.Assignment.update(assignment.id, {
        assignment_status: 'Closed',
        end_date: todayISO(),
        closing_reason: reason,
        closing_notes: notes || undefined,
      });
      const actor = actorName(currentUser);
      const champName = champion ? householdDisplay(champion) : 'Champion';
      await recordAssignmentEvent({ assignmentId: assignment.id, type: 'Closed', actor, summary: reason });
      await recordChampionMilestone({ householdId: assignment.household_id, type: 'Assignment Closed', assignmentId: assignment.id, summary: reason });
      await recordTeamMilestone({ teamId: assignment.volunteer_team_id, householdId: assignment.household_id, type: 'Assignment Closed', assignmentId: assignment.id, summary: `${champName} assignment closed` });
      onOpenChange(false);
      onClosed?.();
    } catch (e) {
      setError('Could not close the Assignment. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> Close Assignment</DialogTitle>
          <p className="text-sm text-muted-foreground">
            This ends the stewardship relationship. The Assignment record is preserved permanently in ministry history.
          </p>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Closing Reason *</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this Assignment being closed?" />
          </div>
          <div className="space-y-1">
            <Label>Closing Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Optional closing notes…" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button variant="destructive" onClick={handleClose} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Close Assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
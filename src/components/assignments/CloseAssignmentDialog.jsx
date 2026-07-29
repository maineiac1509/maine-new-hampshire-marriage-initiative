import React, { useState, useEffect } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { householdDisplay } from '@/lib/teamUtils';
import { todayISO, actorName, recordAssignmentEvent, recordChampionMilestone, recordTeamMilestone } from '@/lib/assignmentEvents';

const END_REASONS = [
  'Reassigned to another Volunteer Team',
  'Champion Requested Pause',
  'Champion No Longer Interested',
  'Do Not Contact',
  'Champion Moved Away',
  'Administrative Cleanup',
  'Other',
];

export default function CloseAssignmentDialog({ open, onOpenChange, assignment, champion, currentUser, onClosed }) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setReason(''); setNotes(''); setError(''); }
  }, [open]);

  const isOther = reason === 'Other';

  async function handleEnd() {
    if (!reason) { setError('An end reason is required.'); return; }
    if (isOther && !notes.trim()) { setError('Please provide a short explanation for "Other".'); return; }
    setSaving(true);
    setError('');
    try {
      await base44.entities.Assignment.update(assignment.id, {
        assignment_status: 'Ended',
        end_date: todayISO(),
        end_reason: reason,
        end_reason_notes: isOther ? notes.trim() : undefined,
      });
      const actor = actorName(currentUser);
      const champName = champion ? householdDisplay(champion) : 'Champion';
      await recordAssignmentEvent({ assignmentId: assignment.id, type: 'Ended', actor, summary: reason });
      await recordChampionMilestone({ householdId: assignment.household_id, type: 'Assignment Ended', assignmentId: assignment.id, summary: reason });
      await recordTeamMilestone({ teamId: assignment.volunteer_team_id, householdId: assignment.household_id, type: 'Assignment Ended', assignmentId: assignment.id, summary: `${champName} stewardship ended` });
      onOpenChange(false);
      onClosed?.();
    } catch (e) {
      setError('Could not end the Assignment. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> End Assignment</DialogTitle>
          <p className="text-sm text-muted-foreground">
            This concludes this Relationship Builder's stewardship of the Champion relationship. The Assignment record is preserved permanently in ministry history, and the Champion becomes available for reassignment.
          </p>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>End Reason *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder="Select a reason…" /></SelectTrigger>
              <SelectContent>
                {END_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isOther && (
            <div className="space-y-1">
              <Label>Explanation *</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Briefly explain why this stewardship is ending…" />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button variant="destructive" onClick={handleEnd} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} End Assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
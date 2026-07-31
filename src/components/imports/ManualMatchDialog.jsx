import React, { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

// Manual match dialog for ambiguous / possible-duplicate rows.
// Lets the admin choose: match to existing household, match to
// existing member, treat as new household, treat as new member in
// existing household, skip, or block.
export default function ManualMatchDialog({ open, onOpenChange, row, onConfirm, saving }) {
  const [targetType, setTargetType] = useState('');
  const [targetId, setTargetId] = useState('');

  function handleClose(open) {
    if (!open) {
      setTargetType('');
      setTargetId('');
    }
    onOpenChange(open);
  }

  function handleConfirm() {
    if (!targetType) return;
    onConfirm({
      row_id: row?.id,
      target_type: targetType,
      target_id: targetId || undefined,
    });
  }

  const OPTIONS = [
    { value: 'HOUSEHOLD', label: 'Match to an existing household', needsId: true, idLabel: 'Household ID' },
    { value: 'MEMBER', label: 'Match to an existing member', needsId: true, idLabel: 'Member ID' },
    { value: 'NEW_HOUSEHOLD', label: 'Treat as a new household', needsId: false },
    { value: 'NEW_MEMBER_IN_EXISTING_HOUSEHOLD', label: 'New member in an existing household', needsId: true, idLabel: 'Existing Household ID' },
  ];

  const selectedOption = OPTIONS.find((o) => o.value === targetType);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Resolve Match — Row {row?.row_number}</DialogTitle>
          <DialogDescription>
            {row?.member_first_name} {row?.member_last_name} — {row?.household_name || 'Unknown household'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {row?.match_method && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="font-medium">Current match result</p>
              <p className="mt-1">{row.match_method}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Choose how to resolve this row</Label>
            {OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-2 rounded-lg border p-2.5 text-sm cursor-pointer transition-colors ${
                  targetType === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                }`}
              >
                <input
                  type="radio"
                  name="targetType"
                  value={opt.value}
                  checked={targetType === opt.value}
                  onChange={(e) => setTargetType(e.target.value)}
                  className="h-4 w-4"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>

          {selectedOption?.needsId && (
            <div>
              <Label htmlFor="targetId">{selectedOption.idLabel}</Label>
              <Input
                id="targetId"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder={`Paste the ${selectedOption.idLabel.toLowerCase()}…`}
                className="mt-1 font-mono text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Open the Champion Profile to copy the ID from the URL.
              </p>
            </div>
          )}

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
            <p className="font-medium">What happens next</p>
            <p className="mt-1">
              The comparison engine will re-run against the selected target. Prior comparisons and resolutions for this row will be invalidated, and fresh default resolutions will be generated.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!targetType || (selectedOption?.needsId && !targetId.trim()) || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Confirm Match
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
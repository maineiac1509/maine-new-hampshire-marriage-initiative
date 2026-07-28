import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RELATIONSHIP_STATUS_OPTIONS } from '@/lib/config';
import RelationshipStatusBadge from './RelationshipStatusBadge';
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Prominent status control for the Champion detail page.
// canChange is computed by the parent from the Assignment entity.
export default function RelationshipStatusControl({ household, canChange, onStatusChanged }) {
  const [saving, setSaving] = useState(false);
  const current = household?.relationship_status || 'New';

  async function handleChange(newStatus) {
    if (!household || newStatus === current || saving) return;
    setSaving(true);
    try {
      await base44.entities.RelationshipStatusChange.create({
        household_id: household.id,
        previous_status: current,
        new_status: newStatus,
        change_date: todayStr(),
      });
      await base44.entities.ChampionHousehold.update(household.id, {
        relationship_status: newStatus,
      });
      onStatusChanged?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">Relationship Status</span>
      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      {canChange ? (
        <Select value={current} onValueChange={handleChange} disabled={saving}>
          <SelectTrigger className="h-8 w-auto min-w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RELATIONSHIP_STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <RelationshipStatusBadge status={current} />
      )}
    </div>
  );
}
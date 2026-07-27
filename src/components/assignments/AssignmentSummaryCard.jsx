import React from 'react';
import { ClipboardList } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AssignmentSection from './AssignmentSection';
import { fmtDate } from '@/lib/teamUtils';

// Closed is a terminal state — it is only reachable via the Close Assignment
// workflow, so the edit-mode status selector offers Active / On Hold only.
const EDIT_STATUS_OPTIONS = ['Active', 'On Hold'];
const STATUS_VARIANT = { Active: 'success', 'On Hold': 'warning', Closed: 'neutral' };
const METHOD_OPTIONS = ['Manual', 'Recommendation', 'Auto Assignment'];

export default function AssignmentSummaryCard({ assignment, form, editing, onField, championName, teamName }) {
  const a = editing ? form : assignment;
  const isClosed = a?.assignment_status === 'Closed';
  return (
    <AssignmentSection icon={ClipboardList} title="Assignment Summary">
      <dl className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Champion</label>
          <p className="text-sm text-foreground">{championName}</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Volunteer Team</label>
          <p className="text-sm text-foreground">{teamName}</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Assigned By</label>
          {editing ? <Input value={a?.assigned_by ?? ''} onChange={(e) => onField('assigned_by', e.target.value)} /> : <p className="text-sm text-foreground">{a?.assigned_by || '—'}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Assigned Date</label>
          {editing ? <Input type="date" value={a?.assigned_date ?? ''} onChange={(e) => onField('assigned_date', e.target.value)} /> : <p className="text-sm text-foreground">{fmtDate(a?.assigned_date)}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Current Status</label>
          {editing && !isClosed ? (
            <Select value={a?.assignment_status || 'Active'} onValueChange={(v) => onField('assignment_status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{EDIT_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <StatusBadge variant={STATUS_VARIANT[a?.assignment_status] || 'neutral'}>{a?.assignment_status || '—'}</StatusBadge>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Assignment Method</label>
          {editing ? (
            <Select value={a?.assignment_method || 'Manual'} onValueChange={(v) => onField('assignment_method', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{METHOD_OPTIONS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-foreground">{a?.assignment_method || '—'}</p>
          )}
        </div>
      </dl>
    </AssignmentSection>
  );
}
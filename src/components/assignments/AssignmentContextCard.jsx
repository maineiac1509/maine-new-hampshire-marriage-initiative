import React from 'react';
import { FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import AssignmentSection from './AssignmentSection';

export default function AssignmentContextCard({ assignment, form, editing, onField }) {
  const a = editing ? form : assignment;
  return (
    <AssignmentSection icon={FileText} title="Ministry Context">
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Assignment Reason</label>
          {editing ? (
            <Input value={a?.assignment_reason ?? ''} onChange={(e) => onField('assignment_reason', e.target.value)} placeholder="Why was this Champion assigned to this team?" />
          ) : (
            <p className="text-sm text-foreground">{a?.assignment_reason || '—'}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Assignment Notes</label>
          {editing ? (
            <Textarea value={a?.assignment_notes ?? ''} onChange={(e) => onField('assignment_notes', e.target.value)} rows={4} placeholder="Additional stewardship notes…" />
          ) : (
            <p className="whitespace-pre-wrap text-sm text-foreground">{a?.assignment_notes || '—'}</p>
          )}
        </div>
      </div>
    </AssignmentSection>
  );
}
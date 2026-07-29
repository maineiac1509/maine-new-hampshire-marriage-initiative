import React from 'react';
import { StickyNote } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import TeamSection from './TeamSection';

export default function TeamNotesCard({ team, form, editing, onField }) {
  const t = editing ? form : team;
  return (
    <TeamSection icon={StickyNote} title="Notes">
      {editing ? (
        <Textarea value={t?.ministry_notes || ''} onChange={(e) => onField('ministry_notes', e.target.value)} rows={4} placeholder="Add notes about this Relationship Builder…" />
      ) : (
        <p className="whitespace-pre-wrap text-sm text-foreground">{team?.ministry_notes || 'No notes recorded yet.'}</p>
      )}
    </TeamSection>
  );
}
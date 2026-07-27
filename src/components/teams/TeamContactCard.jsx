import React from 'react';
import { MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import TeamSection from './TeamSection';
import { fmtDate } from '@/lib/teamUtils';

function Field({ label, value, editing, onChange, type = 'text' }) {
  return (
    <div className="space-y-1">
      <label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</label>
      {editing ? (
        <Input type={type} value={value ?? ''} onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)} />
      ) : (
        <p className="text-sm text-foreground">{value || '—'}</p>
      )}
    </div>
  );
}

export default function TeamContactCard({ team, form, editing, onField }) {
  const t = editing ? form : team;
  return (
    <TeamSection icon={MapPin} title="Contact Information">
      <dl className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><Field label="Street Address" value={t?.address} editing={editing} onChange={(v) => onField('address', v)} /></div>
        <Field label="City" value={t?.city} editing={editing} onChange={(v) => onField('city', v)} />
        <Field label="State" value={t?.state} editing={editing} onChange={(v) => onField('state', v)} />
        <Field label="ZIP Code" value={t?.zip_code} editing={editing} onChange={(v) => onField('zip_code', v)} />
        <Field label="Date Created" value={fmtDate(team?.created_date, true)} editing={false} onChange={() => {}} />
      </dl>
    </TeamSection>
  );
}
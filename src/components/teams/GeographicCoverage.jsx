import React from 'react';
import { MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import TeamSection from './TeamSection';

function Field({ label, value, editing, onChange, type = 'text', textarea = false }) {
  return (
    <div className="space-y-1">
      <label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</label>
      {editing ? (
        textarea ? (
          <Textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} rows={3} />
        ) : (
          <Input type={type} value={value ?? ''} onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)} />
        )
      ) : (
        <p className="text-sm text-foreground">{value || '—'}</p>
      )}
    </div>
  );
}

// Geographic coverage metadata for the future Stewardship Engine.
// Maps and geographic calculations are explicitly out of scope.
export default function GeographicCoverage({ team, form, editing, onField }) {
  const t = editing ? form : team;
  const homeLocation = [t?.address, t?.city, t?.state, t?.zip_code].filter(Boolean).join(', ');
  return (
    <TeamSection icon={MapPin} title="Geographic Coverage">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Home Location" value={homeLocation} editing={false} onChange={() => {}} />
        <Field label="Travel Radius (miles)" value={t?.travel_radius_miles} editing={editing} type="number" onChange={(v) => onField('travel_radius_miles', v)} />
        <Field label="Counties / Regions Served" value={t?.coverage_regions} editing={editing} onChange={(v) => onField('coverage_regions', v)} />
        <div className="sm:col-span-2">
          <Field label="Coverage Notes" value={t?.coverage_notes} editing={editing} textarea onChange={(v) => onField('coverage_notes', v)} />
        </div>
      </dl>
    </TeamSection>
  );
}
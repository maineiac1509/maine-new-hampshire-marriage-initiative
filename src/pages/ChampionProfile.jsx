import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, User, MapPin, ClipboardList, Users as UsersIcon, StickyNote, Phone, Mail, Calendar } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

function Section({ icon: Icon, title, children }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      {children}
    </section>
  );
}

function Field({ label, value }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value || '—'}</dd>
    </div>
  );
}

export default function ChampionProfile() {
  const { id } = useParams();
  const [champion, setChampion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    base44.entities.MarriageChampion.get(id)
      .then((c) => { setChampion(c); setNotFound(!c); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="py-20 text-center text-muted-foreground">Loading champion…</div>;
  }
  if (notFound || !champion) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/champions"><ArrowLeft className="h-4 w-4" /> Back to Champions</Link>
        </Button>
        <p className="text-muted-foreground">Champion not found.</p>
      </div>
    );
  }

  const c = champion;
  const fullName = `${c.first_name || ''} ${c.last_name || ''}`.trim();

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/champions"><ArrowLeft className="h-4 w-4" /> Back to Champions</Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
            {(c.first_name?.[0] || '')}{(c.last_name?.[0] || '')}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{fullName || 'Unnamed Champion'}</h1>
            <p className="text-sm text-muted-foreground">{c.area ? `${c.area} · ` : ''}{c.status || 'New'}</p>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">ID: {c.id}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Basic Info */}
        <Section icon={User} title="Basic Information">
          <dl className="grid grid-cols-2 gap-4">
            <Field label="First Name" value={c.first_name} />
            <Field label="Last Name" value={c.last_name} />
            <Field label="Group Name" value={c.group_name} />
            <Field label="Area" value={c.area} />
            <Field label="Home Phone" value={c.home_phone} />
            <Field label="Mobile Phone" value={c.mobile_phone} />
            <Field label="Email" value={c.email} />
          </dl>
          {c.mobile_phone && (
            <div className="mt-4 flex flex-wrap gap-2">
              {c.mobile_phone && <Button size="sm" variant="outline"><Phone className="h-4 w-4" /> Call</Button>}
              {c.email && <Button size="sm" variant="outline"><Mail className="h-4 w-4" /> Email</Button>}
            </div>
          )}
        </Section>

        {/* Address */}
        <Section icon={MapPin} title="Address">
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Street Address" value={c.address} />
            <Field label="City" value={c.city} />
            <Field label="State" value={c.state} />
            <Field label="Zip Code" value={c.zip_code} />
          </dl>
        </Section>

        {/* Registration */}
        <Section icon={ClipboardList} title="Registration Information">
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Registration Date" value={c.registration_date} />
            <Field label="Registration Type" value={c.registration_type} />
            <Field label="Group Name" value={c.group_name} />
            <Field label="Status" value={c.status} />
          </dl>
        </Section>

        {/* Assignment */}
        <Section icon={UsersIcon} title="Assignment Information">
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Assigned Volunteer" value={c.assigned_volunteer} />
            <Field label="Assigned Director" value={c.assigned_director} />
          </dl>
        </Section>

        {/* Relationship Summary */}
        <Section icon={Calendar} title="Relationship Summary">
          <p className="text-sm text-muted-foreground">Relationship tracking will appear here in a future iteration.</p>
        </Section>

        {/* Notes */}
        <Section icon={StickyNote} title="Notes">
          <p className="whitespace-pre-wrap text-sm">{c.notes || 'No notes recorded.'}</p>
        </Section>
      </div>

      {/* Contact History placeholder */}
      <Section icon={Phone} title="Contact History">
        <p className="text-sm text-muted-foreground">Contact log entries will be displayed here once the Contact History module is activated.</p>
      </Section>

      {/* Future Follow-up placeholder */}
      <Section icon={Calendar} title="Future Follow-up">
        <p className="text-sm text-muted-foreground">Scheduled follow-ups will appear here in a future iteration.</p>
      </Section>
    </div>
  );
}
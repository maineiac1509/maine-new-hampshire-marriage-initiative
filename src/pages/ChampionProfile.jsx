import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Home, MapPin, ClipboardList, Users as UsersIcon, StickyNote, Phone, Mail } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

const RELATIONSHIP_STYLES = {
  Primary: 'bg-blue-100 text-blue-700',
  Spouse: 'bg-pink-100 text-pink-700',
  Member: 'bg-slate-100 text-slate-600',
};

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

function householdDisplay(h, members) {
  if (h?.household_name) return h.household_name;
  const ln = (members || []).find((m) => m.last_name)?.last_name;
  return ln ? `${ln} Household` : 'Unnamed Household';
}

export default function ChampionProfile() {
  const { id } = useParams();
  const [household, setHousehold] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      base44.entities.ChampionHousehold.get(id),
      base44.entities.HouseholdMember.filter({ household_id: id }),
    ])
      .then(([h, ms]) => {
        setHousehold(h);
        setMembers(ms || []);
        setNotFound(!h);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="py-20 text-center text-muted-foreground">Loading household…</div>;
  }
  if (notFound || !household) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/champions"><ArrowLeft className="h-4 w-4" /> Back to Champions</Link>
        </Button>
        <p className="text-muted-foreground">Household not found.</p>
      </div>
    );
  }

  const h = household;
  const name = householdDisplay(h, members);

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/champions"><ArrowLeft className="h-4 w-4" /> Back to Champions</Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
            <Home className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
            <p className="text-sm text-muted-foreground">
              {h.area ? `${h.area} · ` : ''}{h.status || 'New'} · {members.length} {members.length === 1 ? 'contact' : 'contacts'}
            </p>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">ID: {h.id}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Contacts / Members */}
        <Section icon={UsersIcon} title="Contacts">
          <div className="space-y-3">
            {members.length === 0 && (
              <p className="text-sm text-muted-foreground">No contacts in this household.</p>
            )}
            {members.map((m) => (
              <div key={m.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{m.first_name} {m.last_name}</span>
                  {m.relationship && (
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${RELATIONSHIP_STYLES[m.relationship] || 'bg-slate-100 text-slate-600'}`}>
                      {m.relationship}
                    </span>
                  )}
                </div>
                <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Field label="Email" value={m.email} />
                  <Field label="Mobile Phone" value={m.mobile_phone} />
                </dl>
                {(m.mobile_phone || m.email) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.mobile_phone && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={`tel:${m.mobile_phone}`}><Phone className="h-4 w-4" /> Call</a>
                      </Button>
                    )}
                    {m.email && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={`mailto:${m.email}`}><Mail className="h-4 w-4" /> Email</a>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* Address */}
        <Section icon={MapPin} title="Address">
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Street Address" value={h.address} />
            <Field label="City" value={h.city} />
            <Field label="State" value={h.state} />
            <Field label="Zip Code" value={h.zip_code} />
            <Field label="Home Phone" value={h.home_phone} />
          </dl>
          {h.home_phone && (
            <div className="mt-4">
              <Button size="sm" variant="outline" asChild>
                <a href={`tel:${h.home_phone}`}><Phone className="h-4 w-4" /> Call Home</a>
              </Button>
            </div>
          )}
        </Section>

        {/* Registration */}
        <Section icon={ClipboardList} title="Registration Information">
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Registration Date" value={h.registration_date} />
            <Field label="Registration Type" value={h.registration_type} />
            <Field label="Group Name" value={h.group_name} />
            <Field label="Area" value={h.area} />
            <Field label="Status" value={h.status} />
          </dl>
        </Section>

        {/* Assignment */}
        <Section icon={UsersIcon} title="Assignment Information">
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Assigned Volunteer" value={h.assigned_volunteer} />
            <Field label="Assigned Director" value={h.assigned_director} />
          </dl>
        </Section>

        {/* Notes */}
        <Section icon={StickyNote} title="Notes">
          <p className="whitespace-pre-wrap text-sm">{h.notes || 'No notes recorded.'}</p>
        </Section>
      </div>
    </div>
  );
}
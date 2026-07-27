import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Home, MapPin, ClipboardList, Users as UsersIcon, StickyNote, Phone, Mail,
  Save, X, Plus, Trash2, Loader2,
} from 'lucide-react';
import RelationshipSummary, { getFollowUpStatus } from '@/components/champions/RelationshipSummary';
import RelationshipStatusControl from '@/components/champions/RelationshipStatusControl';
import RelationshipTimeline from '@/components/champions/RelationshipTimeline';
import { isAssignedTo } from '@/lib/championUtils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { STATUS_OPTIONS, REGISTRATION_TYPE_OPTIONS } from '@/lib/config';

const RELATIONSHIP_OPTIONS = ['Primary', 'Spouse', 'Member'];

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

function FieldRow({ label, value, onChange, editing, type = 'text', options }) {
  if (!editing) {
    return (
      <div className="space-y-0.5">
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className="text-sm text-foreground">{value || '—'}</dd>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</label>
      {type === 'select' ? (
        <Select value={value || ''} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder={label} /></SelectTrigger>
          <SelectContent>
            {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : type === 'textarea' ? (
        <Textarea value={value || ''} onChange={(e) => onChange(e.target.value)} rows={4} />
      ) : (
        <Input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function householdDisplay(h, members) {
  if (h?.household_name) return h.household_name;
  const ln = (members || []).find((m) => m.last_name)?.last_name;
  return ln ? `${ln} Household` : 'Unnamed Household';
}

function fmtDate(s) {
  return s ? new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
}

export default function ChampionProfile() {
  const { id } = useParams();
  const [household, setHousehold] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [membersForm, setMembersForm] = useState([]);
  const [deletedIds, setDeletedIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [activities, setActivities] = useState([]);
  const [statusChanges, setStatusChanges] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  function load() {
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
  }

  function loadActivities() {
    base44.entities.ChampionActivity.filter({ household_id: id }, '-activity_date')
      .then((rows) => setActivities(rows || []))
      .catch(() => setActivities([]));
  }

  function loadStatusChanges() {
    base44.entities.RelationshipStatusChange.filter({ household_id: id }, '-change_date')
      .then((rows) => setStatusChanges(rows || []))
      .catch(() => setStatusChanges([]));
  }

  function handleStatusChanged() {
    load();
    loadStatusChanges();
    loadActivities();
  }

  useEffect(() => {
    load();
    loadActivities();
    loadStatusChanges();
    base44.auth.me().then((u) => setCurrentUser(u)).catch(() => {});
  }, [id]);

  function startEdit() {
    setForm({ ...household });
    setMembersForm(members.map((m) => ({ ...m })));
    setDeletedIds([]);
    setEditing(true);
  }

  function cancelEdit() {
    setForm(null);
    setMembersForm([]);
    setDeletedIds([]);
    setEditing(false);
  }

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function setMemberField(idx, field, value) {
    setMembersForm((ms) => ms.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
  }

  function addMember() {
    setMembersForm((ms) => [
      ...ms,
      { first_name: '', last_name: '', email: '', mobile_phone: '', relationship: 'Member', household_id: id },
    ]);
  }

  function removeMember(idx) {
    setMembersForm((ms) => {
      const m = ms[idx];
      if (m?.id) setDeletedIds((d) => [...d, m.id]);
      return ms.filter((_, i) => i !== idx);
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await base44.entities.ChampionHousehold.update(id, form);
      await Promise.all(deletedIds.map((mid) => base44.entities.HouseholdMember.delete(mid)));
      await Promise.all(
        membersForm.map((m) => {
          const payload = {
            household_id: id,
            first_name: m.first_name,
            last_name: m.last_name,
            email: m.email,
            mobile_phone: m.mobile_phone,
            relationship: m.relationship,
          };
          return m.id
            ? base44.entities.HouseholdMember.update(m.id, payload)
            : base44.entities.HouseholdMember.create(payload);
        })
      );
      setEditing(false);
      setForm(null);
      setMembersForm([]);
      setDeletedIds([]);
      load();
    } catch (err) {
      setSaving(false);
    }
  }

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

  const h = editing ? form : household;
  const ms = editing ? membersForm : members;
  const name = householdDisplay(h, ms);
  const followUpStatus = getFollowUpStatus(activities);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/champions"><ArrowLeft className="h-4 w-4" /> Back to Champions</Link>
        </Button>
        {editing ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={cancelEdit} disabled={saving}>
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={startEdit}>
            <Save className="h-4 w-4" /> Edit Champion
          </Button>
        )}
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
            <Home className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {editing ? (
                <Input value={h.household_name || ''} onChange={(e) => setField('household_name', e.target.value)} className="text-2xl font-bold" />
              ) : name}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted-foreground">
                {h.area ? `${h.area} · ` : ''}{h.status || 'New'} · {ms.length} {ms.length === 1 ? 'contact' : 'contacts'}
              </p>
              {followUpStatus && (
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${followUpStatus.tone}`}>
                  {followUpStatus.label}{followUpStatus.date ? ` · ${fmtDate(followUpStatus.date)}` : ''}
                </span>
              )}
            </div>
            {!editing && (
              <div className="mt-2">
                <RelationshipStatusControl
                  household={household}
                  currentUser={currentUser}
                  onStatusChanged={handleStatusChanged}
                />
              </div>
            )}
          </div>
        </div>
        {!editing && <span className="text-xs text-muted-foreground">ID: {h.id}</span>}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Contacts / Members */}
        <Section icon={UsersIcon} title="Contacts">
          <div className="space-y-3">
            {ms.length === 0 && !editing && (
              <p className="text-sm text-muted-foreground">No contacts in this household.</p>
            )}
            {ms.map((m, idx) => (
              <div key={m.id || `new-${idx}`} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  {editing ? (
                    <Select value={m.relationship || 'Primary'} onValueChange={(v) => setMemberField(idx, 'relationship', v)}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RELATIONSHIP_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    m.relationship && (
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${RELATIONSHIP_STYLES[m.relationship] || 'bg-slate-100 text-slate-600'}`}>
                        {m.relationship}
                      </span>
                    )
                  )}
                  {editing && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeMember(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FieldRow label="First Name" value={m.first_name} editing={editing} onChange={(v) => setMemberField(idx, 'first_name', v)} />
                  <FieldRow label="Last Name" value={m.last_name} editing={editing} onChange={(v) => setMemberField(idx, 'last_name', v)} />
                  <FieldRow label="Email" value={m.email} editing={editing} onChange={(v) => setMemberField(idx, 'email', v)} />
                  <FieldRow label="Mobile Phone" value={m.mobile_phone} editing={editing} onChange={(v) => setMemberField(idx, 'mobile_phone', v)} />
                </dl>
                {!editing && (m.mobile_phone || m.email) && (
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
            {editing && (
              <Button variant="outline" size="sm" onClick={addMember}>
                <Plus className="h-4 w-4" /> Add Contact
              </Button>
            )}
          </div>
        </Section>

        {/* Address */}
        <Section icon={MapPin} title="Address">
          <dl className="grid grid-cols-2 gap-4">
            <FieldRow label="Street Address" value={h.address} editing={editing} onChange={(v) => setField('address', v)} />
            <FieldRow label="City" value={h.city} editing={editing} onChange={(v) => setField('city', v)} />
            <FieldRow label="State" value={h.state} editing={editing} onChange={(v) => setField('state', v)} />
            <FieldRow label="Zip Code" value={h.zip_code} editing={editing} onChange={(v) => setField('zip_code', v)} />
            <FieldRow label="Home Phone" value={h.home_phone} editing={editing} onChange={(v) => setField('home_phone', v)} />
          </dl>
          {!editing && h.home_phone && (
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
            <FieldRow label="Registration Date" value={h.registration_date} editing={editing} type="date" onChange={(v) => setField('registration_date', v)} />
            <FieldRow label="Registration Type" value={h.registration_type} editing={editing} type="select" options={REGISTRATION_TYPE_OPTIONS} onChange={(v) => setField('registration_type', v)} />
            <FieldRow label="Group Name" value={h.group_name} editing={editing} onChange={(v) => setField('group_name', v)} />
            <FieldRow label="Area" value={h.area} editing={editing} onChange={(v) => setField('area', v)} />
            <FieldRow label="Status" value={h.status} editing={editing} type="select" options={STATUS_OPTIONS} onChange={(v) => setField('status', v)} />
          </dl>
        </Section>

        {/* Assignment */}
        <Section icon={UsersIcon} title="Assignment Information">
          <dl className="grid grid-cols-2 gap-4">
            <FieldRow label="Assigned Volunteer" value={h.assigned_volunteer} editing={editing} onChange={(v) => setField('assigned_volunteer', v)} />
            <FieldRow label="Assigned Director" value={h.assigned_director} editing={editing} onChange={(v) => setField('assigned_director', v)} />
          </dl>
        </Section>
      </div>

      {/* Relationship Summary */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Upcoming Follow-up</h2>
        <RelationshipSummary activities={activities} />
      </div>

      {/* Relationship Timeline */}
      <RelationshipTimeline
        householdId={id}
        activities={activities}
        statusChanges={statusChanges}
        currentStatus={household?.relationship_status || 'New'}
        canChangeStatus={currentUser?.role === 'admin' || currentUser?.role === 'director' || isAssignedTo(household, currentUser)}
        onRefresh={loadActivities}
        onStatusChanged={handleStatusChanged}
        currentUser={currentUser}
      />

      {/* Notes */}
      <Section icon={StickyNote} title="Notes">
        {editing ? (
          <Textarea value={h.notes || ''} onChange={(e) => setField('notes', e.target.value)} rows={4} placeholder="Add notes about this Marriage Champion…" />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-foreground">{h.notes || 'No notes recorded yet.'}</p>
        )}
      </Section>
    </div>
  );
}
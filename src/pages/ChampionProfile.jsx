import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Home, MapPin, ClipboardList, Users as UsersIcon, StickyNote, Phone, Mail,
  Save, X, Plus, Trash2, Loader2,
  AlertCircle, Clock, CheckCircle2, CircleDashed,
  Church, MessageSquareOff, Ticket,
} from 'lucide-react';
import RelationshipSummary, { getFollowUpStatus } from '@/components/champions/RelationshipSummary';
import { StatusBadge } from '@/components/ui/StatusBadge';
import RelationshipStatusControl from '@/components/champions/RelationshipStatusControl';
import RelationshipTimeline from '@/components/champions/RelationshipTimeline';
import QuickActionsBar from '@/components/champions/QuickActionsBar';
import DoNotContactBanner from '@/components/champions/DoNotContactBanner';
import ChampionAssignmentCard from '@/components/assignments/ChampionAssignmentCard';
import StewardshipTimeline from '@/components/champions/StewardshipTimeline';
import StewardshipHealthBadge from '@/components/champions/StewardshipHealthBadge';
import RelationshipIntelligenceCard from '@/components/champions/RelationshipIntelligenceCard';
import RecommendedGuidesPanel from '@/components/stewardship/RecommendedGuidesPanel';
import CommunicationPanel from '@/components/communication/CommunicationPanel';
import ResourceRecommendationPanel from '@/components/resources/ResourceRecommendationPanel';
import { isAssignedTo } from '@/lib/championUtils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { STATUS_OPTIONS, REGISTRATION_TYPE_OPTIONS } from '@/lib/config';

const FU_ICONS = { danger: AlertCircle, warning: Clock, success: CheckCircle2, neutral: CircleDashed };

const RELATIONSHIP_OPTIONS = ['Primary', 'Spouse', 'Member'];

const RELATIONSHIP_STYLES = {
  Primary: 'bg-blue-100 text-blue-700',
  Spouse: 'bg-pink-100 text-pink-700',
  Member: 'bg-slate-100 text-slate-600',
};

const CHAMPION_STATUS_OPTIONS = ['Active', 'Inactive', 'Prospect', 'Alumni'];
const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'];

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
  const isBoolean = type === 'boolean';
  const isNumber = type === 'number';
  if (!editing) {
    if (isBoolean) {
      return (
        <div className="flex items-center gap-2">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
          <dd className={`text-sm font-medium ${value ? 'text-red-600' : 'text-muted-foreground'}`}>{value ? 'Yes' : 'No'}</dd>
        </div>
      );
    }
    return (
      <div className="space-y-0.5">
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className="text-sm text-foreground">{value != null && value !== '' ? value : '—'}</dd>
      </div>
    );
  }
  return (
    <div className={isBoolean ? 'flex items-center gap-2' : 'space-y-1'}>
      {isBoolean ? (
        <>
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-input accent-primary" />
          <label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</label>
        </>
      ) : (
        <>
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
            <Input type={type} value={value != null ? value : ''} onChange={(e) => onChange(isNumber ? Number(e.target.value) : e.target.value)} />
          )}
        </>
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
  const navigate = useNavigate();
  const [household, setHousehold] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [membersForm, setMembersForm] = useState([]);
  const [deletedIds, setDeletedIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activities, setActivities] = useState([]);
  const [teams, setTeams] = useState([]);
  const [statusChanges, setStatusChanges] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);

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

  function loadMilestones() {
    base44.entities.ChampionTimelineEvent.filter({ household_id: id }, '-event_date')
      .then((rows) => setMilestones(rows || []))
      .catch(() => setMilestones([]));
  }

  function loadAssignments() {
    base44.entities.Assignment.filter({ household_id: id }, '-assigned_date')
      .then((rows) => setAssignments(rows || []))
      .catch(() => setAssignments([]));
  }

  function handleStatusChanged() {
    load();
    loadStatusChanges();
    loadActivities();
    loadMilestones();
  }

  useEffect(() => {
    load();
    loadActivities();
    loadStatusChanges();
    loadMilestones();
    loadAssignments();
    base44.entities.VolunteerTeam.list().then((ts) => setTeams(ts || [])).catch(() => {});
    base44.auth.me().then((u) => setCurrentUser(u)).catch(() => {});
    base44.entities.TeamMember.list().then((tms) => setTeamMembers(tms || [])).catch(() => {});
  }, [id]);

  // Derive team membership from Assignment records (source of truth), not the
  // denormalized assigned_volunteer text field on ChampionHousehold.
  const myTeamId = (teamMembers || []).find((m) => m.user_id === currentUser?.id)?.team_id || null;
  const activeAssignment = (assignments || []).find((a) => a.assignment_status === 'Active');
  const canChangeStatus = currentUser?.role === 'admin' || currentUser?.role === 'director' || isAssignedTo(household, currentUser, activeAssignment, myTeamId);

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
      { first_name: '', last_name: '', email: '', mobile_phone: '', work_phone: '', relationship: 'Member', household_id: id },
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
            work_phone: m.work_phone,
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

  async function handleDelete() {
    setDeleting(true);
    try {
      const ms = await base44.entities.HouseholdMember.filter({ household_id: id });
      await Promise.all((ms || []).map((m) => base44.entities.HouseholdMember.delete(m.id)));
      await base44.entities.ChampionHousehold.delete(id);
      navigate('/champions');
    } catch {
      setDeleting(false);
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

  const teamMap = (teams || []).reduce((m, t) => { m[t.id] = t; return m; }, {});
  const h = editing ? form : household;
  const ms = editing ? membersForm : members;
  const name = householdDisplay(h, ms);
  const followUpStatus = getFollowUpStatus(activities);

  return (
    <div className="space-y-5">
      <DoNotContactBanner household={household} />
      <div className="sticky top-16 lg:top-0 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 bg-background/95 backdrop-blur py-3 border-b">
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
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={startEdit}>
                <Save className="h-4 w-4" /> Edit Champion
              </Button>
              {currentUser?.role === 'admin' && (
                <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              )}
            </div>
          )}
        </div>
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
                <StatusBadge variant={followUpStatus.variant} icon={FU_ICONS[followUpStatus.variant]}>
                  {followUpStatus.label}{followUpStatus.date ? ` · ${fmtDate(followUpStatus.date)}` : ''}
                </StatusBadge>
              )}
              <StewardshipHealthBadge
                activities={activities}
                fallbackDate={household.registration_date || household.created_date}
              />
            </div>
            {!editing && (
              <div className="mt-2">
                <RelationshipStatusControl
                  household={household}
                  canChange={canChangeStatus}
                  onStatusChanged={handleStatusChanged}
                />
              </div>
            )}
          </div>
        </div>
        {!editing && <span className="text-xs text-muted-foreground">ID: {h.id}</span>}
      </div>

      {/* Stewardship Workspace */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Relationship Snapshot</h2>
        <RelationshipSummary activities={activities} />
      </div>

      <QuickActionsBar championId={id} />

      <RelationshipTimeline
        householdId={id}
        activities={activities}
        statusChanges={statusChanges}
        milestones={milestones}
        currentStatus={household?.relationship_status || 'New'}
        canChangeStatus={canChangeStatus}
        onRefresh={loadActivities}
        onStatusChanged={handleStatusChanged}
        currentUser={currentUser}
      />

      {/* Relationship Intelligence */}
      <RelationshipIntelligenceCard
        householdId={id}
        household={household}
        activities={activities}
        assignments={assignments}
      />

      {/* Record Details */}
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
                  <FieldRow label="Work Phone" value={m.work_phone} editing={editing} onChange={(v) => setMemberField(idx, 'work_phone', v)} />
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

        {/* Contact Information */}
        <Section icon={MapPin} title="Contact Information">
          <dl className="grid grid-cols-2 gap-4">
            <FieldRow label="Street Address" value={h.address} editing={editing} onChange={(v) => setField('address', v)} />
            <FieldRow label="Address Line 2" value={h.address_line_2} editing={editing} onChange={(v) => setField('address_line_2', v)} />
            <FieldRow label="City" value={h.city} editing={editing} onChange={(v) => setField('city', v)} />
            <FieldRow label="State" value={h.state} editing={editing} onChange={(v) => setField('state', v)} />
            <FieldRow label="Zip Code" value={h.zip_code} editing={editing} onChange={(v) => setField('zip_code', v)} />
            <FieldRow label="Home Phone" value={h.home_phone} editing={editing} onChange={(v) => setField('home_phone', v)} />
            <FieldRow label="Email" value={h.email} editing={editing} type="email" onChange={(v) => setField('email', v)} />
          </dl>
          {!editing && (h.home_phone || h.email) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {h.home_phone && (
                <Button size="sm" variant="outline" asChild>
                  <a href={`tel:${h.home_phone}`}><Phone className="h-4 w-4" /> Call Home</a>
                </Button>
              )}
              {h.email && (
                <Button size="sm" variant="outline" asChild>
                  <a href={`mailto:${h.email}`}><Mail className="h-4 w-4" /> Email</a>
                </Button>
              )}
            </div>
          )}
        </Section>

        {/* Ministry Information */}
        <Section icon={ClipboardList} title="Ministry Information">
          <dl className="grid grid-cols-2 gap-4">
            <FieldRow label="Champion Status" value={h.champion_status} editing={editing} type="select" options={CHAMPION_STATUS_OPTIONS} onChange={(v) => setField('champion_status', v)} />
            <FieldRow label="Church Priority" value={h.church_priority} editing={editing} type="select" options={PRIORITY_OPTIONS} onChange={(v) => setField('church_priority', v)} />
            <FieldRow label="Marriage Conference Priority" value={h.marriage_conference_priority} editing={editing} type="select" options={PRIORITY_OPTIONS} onChange={(v) => setField('marriage_conference_priority', v)} />
            <FieldRow label="Registration Date" value={h.registration_date} editing={editing} type="date" onChange={(v) => setField('registration_date', v)} />
            <FieldRow label="Registration Type" value={h.registration_type} editing={editing} type="select" options={REGISTRATION_TYPE_OPTIONS} onChange={(v) => setField('registration_type', v)} />
            <FieldRow label="Area" value={h.area} editing={editing} onChange={(v) => setField('area', v)} />
          </dl>
        </Section>

        {/* Assignment */}
        <Section icon={UsersIcon} title="Assignment Information">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Assigned MC Relationship Builder</label>
              <ChampionAssignmentCard champion={household} currentUser={currentUser} onChanged={loadMilestones} />
            </div>
            <FieldRow label="Assigned Director" value={h.assigned_director} editing={editing} onChange={(v) => setField('assigned_director', v)} />
          </div>
        </Section>

        {/* Church Information */}
        <Section icon={Church} title="Church Information">
          <dl className="grid grid-cols-2 gap-4">
            <FieldRow label="Church Name" value={h.church_name} editing={editing} onChange={(v) => setField('church_name', v)} />
            <FieldRow label="Church City" value={h.church_city} editing={editing} onChange={(v) => setField('church_city', v)} />
            <FieldRow label="Church State" value={h.church_state} editing={editing} onChange={(v) => setField('church_state', v)} />
            <FieldRow label="Church ZIP Code" value={h.church_zip_code} editing={editing} onChange={(v) => setField('church_zip_code', v)} />
          </dl>
        </Section>

        {/* Communication Preferences */}
        <Section icon={MessageSquareOff} title="Communication Preferences">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FieldRow label="Do Not Call" value={h.do_not_call} editing={editing} type="boolean" onChange={(v) => setField('do_not_call', v)} />
            <FieldRow label="Do Not Text" value={h.do_not_text} editing={editing} type="boolean" onChange={(v) => setField('do_not_text', v)} />
            <FieldRow label="Email Opt Out" value={h.email_opt_out} editing={editing} type="boolean" onChange={(v) => setField('email_opt_out', v)} />
          </div>
        </Section>

        {/* Group Information */}
        <Section icon={Ticket} title="Group Information">
          <dl className="grid grid-cols-2 gap-4">
            <FieldRow label="Group Name" value={h.group_name} editing={editing} onChange={(v) => setField('group_name', v)} />
            <FieldRow label="Status" value={h.status} editing={editing} type="select" options={STATUS_OPTIONS} onChange={(v) => setField('status', v)} />
            <FieldRow label="Group Start Date" value={h.group_start_date} editing={editing} type="date" onChange={(v) => setField('group_start_date', v)} />
            <FieldRow label="Group Renewal Date" value={h.group_renewal_date} editing={editing} type="date" onChange={(v) => setField('group_renewal_date', v)} />
            <FieldRow label="Cumulative Registrations" value={h.cumulative_registrations} editing={editing} type="number" onChange={(v) => setField('cumulative_registrations', v)} />
            <FieldRow label="Free Couple Registrations Used" value={h.free_couple_registrations_used} editing={editing} type="number" onChange={(v) => setField('free_couple_registrations_used', v)} />
            <FieldRow label="Free Couple Registrations Available" value={h.free_couple_registrations_available} editing={editing} type="number" onChange={(v) => setField('free_couple_registrations_available', v)} />
            <FieldRow label="Registrations Toward Next Free Registration" value={h.registrations_toward_next_free_registration} editing={editing} type="number" onChange={(v) => setField('registrations_toward_next_free_registration', v)} />
            <FieldRow label="Registrations Needed for Next Free Registration" value={h.registrations_needed_for_next_free_registration} editing={editing} type="number" onChange={(v) => setField('registrations_needed_for_next_free_registration', v)} />
          </dl>
        </Section>
      </div>

      {/* Recommended Stewardship Guides */}
      <RecommendedGuidesPanel champion={household} activities={activities} hasActiveAssignment={!!activeAssignment} />

      {/* Communication Center */}
      <CommunicationPanel champion={household} activities={activities} currentUser={currentUser} hasActiveAssignment={!!activeAssignment} />

      {/* Recommended Resources */}
      <ResourceRecommendationPanel champion={household} activities={activities} hasActiveAssignment={!!activeAssignment} />

      {/* Stewardship Timeline */}
      <StewardshipTimeline assignments={assignments} teams={teams} />

      {/* Notes */}
      <Section icon={StickyNote} title="Notes">
        {editing ? (
          <Textarea value={h.notes || ''} onChange={(e) => setField('notes', e.target.value)} rows={4} placeholder="Add notes about this Marriage Champion…" />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-foreground">{h.notes || 'No notes recorded yet.'}</p>
        )}
      </Section>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this champion?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the household and all its contacts. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
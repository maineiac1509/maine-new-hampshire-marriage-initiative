import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Save, X, Loader2, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import AssignmentSummaryCard from '@/components/assignments/AssignmentSummaryCard';
import AssignmentContextCard from '@/components/assignments/AssignmentContextCard';
import RelatedChampionCard from '@/components/assignments/RelatedChampionCard';
import TeamSummaryCard from '@/components/assignments/TeamSummaryCard';
import AssignmentHistory from '@/components/assignments/AssignmentHistory';
import CloseAssignmentDialog from '@/components/assignments/CloseAssignmentDialog';
import { householdDisplay, fmtDate } from '@/lib/teamUtils';
import { actorName, recordAssignmentEvent, recordChampionMilestone } from '@/lib/assignmentEvents';

export default function AssignmentDetail() {
  const { id } = useParams();
  const [assignment, setAssignment] = useState(null);
  const [champion, setChampion] = useState(null);
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [teamChampionCount, setTeamChampionCount] = useState(0);
  const [activities, setActivities] = useState([]);
  const [events, setEvents] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  function load() {
    setLoading(true);
    base44.entities.Assignment.get(id)
      .then((a) => {
        setAssignment(a);
        setForm({ ...a });
        setNotFound(!a);
        if (!a) return;
        const loads = [];
        if (a.household_id) {
          loads.push(base44.entities.ChampionHousehold.get(a.household_id).then(setChampion).catch(() => setChampion(null)));
        }
        if (a.volunteer_team_id) {
          loads.push(base44.entities.VolunteerTeam.get(a.volunteer_team_id).then(setTeam).catch(() => setTeam(null)));
          loads.push(base44.entities.TeamMember.filter({ team_id: a.volunteer_team_id }).then(setMembers).catch(() => setMembers([])));
          loads.push(
            base44.entities.ChampionHousehold.filter({ volunteer_team_id: a.volunteer_team_id })
              .then((cs) => setTeamChampionCount((cs || []).length))
              .catch(() => setTeamChampionCount(0))
          );
        }
        loads.push(base44.entities.AssignmentEvent.filter({ assignment_id: id }, '-event_date').then(setEvents).catch(() => setEvents([])));
        return Promise.all(loads);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!champion) { setActivities([]); return; }
    base44.entities.ChampionActivity.list()
      .then((all) => setActivities((all || []).filter((a) => a.household_id === champion.id)))
      .catch(() => setActivities([]));
  }, [champion]);

  const role = currentUser?.role;
  const canManage = role === 'admin' || role === 'director';
  const isClosed = assignment?.assignment_status === 'Closed';

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const oldStatus = assignment.assignment_status;
      const newStatus = form.assignment_status;
      const statusChanged = oldStatus !== newStatus;
      const tracked = ['assigned_by', 'assigned_date', 'assignment_method', 'assignment_reason', 'assignment_notes'];
      const otherChanged = tracked.some((k) => (assignment[k] ?? '') !== (form[k] ?? ''));
      await base44.entities.Assignment.update(id, form);
      const actor = actorName(currentUser);
      if (statusChanged) {
        await recordAssignmentEvent({ assignmentId: id, type: 'Status Changed', actor, previousValue: oldStatus, newValue: newStatus, summary: `${oldStatus || '—'} → ${newStatus}` });
      }
      if (otherChanged) {
        await recordAssignmentEvent({ assignmentId: id, type: 'Updated', actor, summary: 'Assignment details updated' });
      }
      if (statusChanged || otherChanged) {
        await recordChampionMilestone({ householdId: assignment.household_id, type: 'Assignment Updated', assignmentId: id, summary: 'Assignment details updated' });
      }
      setEditing(false);
      load();
    } catch (e) {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-muted-foreground">Loading Assignment…</div>;
  }
  if (notFound || !assignment) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/assignments"><ArrowLeft className="h-4 w-4" /> Back to Assignments</Link>
        </Button>
        <p className="text-muted-foreground">Assignment not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/assignments"><ArrowLeft className="h-4 w-4" /> Back to Assignments</Link>
        </Button>
        <div className="flex gap-2">
          {canManage && !isClosed && !editing && (
            <Button size="sm" variant="outline" onClick={() => setCloseOpen(true)}>
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Close Assignment
            </Button>
          )}
          {canManage && !isClosed && !editing && (
            <Button size="sm" variant="outline" onClick={() => { setForm({ ...assignment }); setEditing(true); }}>
              <Save className="h-4 w-4" /> Edit Assignment
            </Button>
          )}
          {canManage && editing && (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={saving}>
                <X className="h-4 w-4" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
              </Button>
            </>
          )}
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assignment</h1>
        <p className="text-sm text-muted-foreground">Stewardship record · Assigned {fmtDate(assignment.assigned_date)}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AssignmentSummaryCard
          assignment={assignment}
          form={form}
          editing={editing}
          onField={setField}
          championName={champion ? householdDisplay(champion) : '—'}
          teamName={team ? team.team_name : '—'}
        />
        <AssignmentContextCard assignment={assignment} form={form} editing={editing} onField={setField} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RelatedChampionCard champion={champion} activities={activities} />
        <TeamSummaryCard team={team} members={members} assignedCount={teamChampionCount} />
      </div>

      <AssignmentHistory events={events} assignedDate={assignment.assigned_date} />

      <CloseAssignmentDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        assignment={assignment}
        champion={champion}
        team={team}
        currentUser={currentUser}
        onClosed={load}
      />
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users as UsersIcon, Plus, ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import CreateAssignmentDialog from '@/components/assignments/CreateAssignmentDialog';

// Renders the active-assignment summary (or an "Assign to Team" action) inline,
// without its own section wrapper so it fits inside the Champion profile card.
export default function ChampionAssignmentCard({ champion, currentUser, onChanged }) {
  const [active, setActive] = useState(null);
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const role = currentUser?.role;
  const canManage = role === 'admin' || role === 'director';

  function load() {
    setLoading(true);
    base44.entities.Assignment.filter({ household_id: champion.id, assignment_status: 'Active' })
      .then((asgs) => {
        const a = (asgs || [])[0] || null;
        setActive(a);
        if (a?.volunteer_team_id) {
          base44.entities.VolunteerTeam.get(a.volunteer_team_id).then(setTeam).catch(() => setTeam(null));
        } else {
          setTeam(null);
        }
      })
      .catch(() => { setActive(null); setTeam(null); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [champion?.id]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading assignment…</p>;
  }
  if (active) {
    return (
      <>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{team?.team_name || 'Team'}</p>
            <p className="text-xs text-muted-foreground">Assigned {active.assigned_date}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge variant="success">{active.assignment_status}</StatusBadge>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/assignments/${active.id}`}>Open <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">No active Assignment for this Champion.</p>
        {canManage && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Assign to Team
          </Button>
        )}
      </div>
      <CreateAssignmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        champion={champion}
        currentUser={currentUser}
        onCreated={() => { load(); onChanged?.(); }}
      />
    </>
  );
}
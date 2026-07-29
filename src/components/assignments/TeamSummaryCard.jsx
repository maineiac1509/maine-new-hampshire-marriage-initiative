import React from 'react';
import { Link } from 'react-router-dom';
import { Users as UsersIcon, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import AssignmentSection from './AssignmentSection';

export default function TeamSummaryCard({ team, members, assignedCount }) {
  return (
    <AssignmentSection icon={UsersIcon} title="MC Relationship Builder">
      {!team ? (
        <p className="text-sm text-muted-foreground">Relationship Builder record not found.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">{team.team_name}</p>
            <StatusBadge variant={team.active === false ? 'neutral' : 'success'}>
              {team.active === false ? 'Inactive' : 'Active'}
            </StatusBadge>
          </div>
          <dl className="grid grid-cols-2 gap-4 border-t pt-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Members</dt>
              <dd className="text-sm text-foreground">{members.length}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Capacity</dt>
              <dd className="text-sm text-foreground">{assignedCount} / {Number(team.target_capacity) || 12}</dd>
            </div>
          </dl>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/volunteer-teams/${team.id}`}>Open Relationship Builder Profile <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      )}
    </AssignmentSection>
  );
}
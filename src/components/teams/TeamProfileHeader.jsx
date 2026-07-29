import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Users as UsersIcon, Save, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/StatusBadge';

export default function TeamProfileHeader({
  team, form, editing, canManage, onEdit, onCancel, onSave, saving, onField, memberCount, championCount,
}) {
  const t = editing ? form : team;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/volunteer-teams"><ArrowLeft className="h-4 w-4" /> Back to MC Relationship Builders</Link>
        </Button>
        {canManage && !editing && (
          <Button size="sm" variant="outline" onClick={onEdit}><Save className="h-4 w-4" /> Edit Relationship Builder</Button>
        )}
        {canManage && editing && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}><X className="h-4 w-4" /> Cancel</Button>
            <Button size="sm" onClick={onSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
            </Button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <UsersIcon className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          {editing ? (
            <Input value={t?.team_name || ''} onChange={(e) => onField('team_name', e.target.value)} className="text-2xl font-bold" />
          ) : (
            <h1 className="text-2xl font-bold tracking-tight">{team.team_name}</h1>
          )}
          {editing ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Family Name</span>
              <Input
                value={t?.family_name || ''}
                onChange={(e) => onField('family_name', e.target.value)}
                placeholder="Optional"
                className="h-8 max-w-xs"
              />
            </div>
          ) : (
            team.family_name && <p className="text-sm text-muted-foreground">Family Name: {team.family_name}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge variant={team.active === false ? 'neutral' : 'success'}>
              {team.active === false ? 'Inactive' : 'Active'}
            </StatusBadge>
            <span className="text-sm text-muted-foreground">
              {memberCount} {memberCount === 1 ? 'member' : 'members'} · {championCount} {championCount === 1 ? 'Champion' : 'Champions'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
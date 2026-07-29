import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Users as UsersIcon, Save, X, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function TeamProfileHeader({
  team, form, editing, canManage, onEdit, onCancel, onSave, saving, onField,
  memberCount, championCount, onDelete, activeAssignmentCount = 0,
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const t = editing ? form : team;

  async function handleDelete() {
    setDeleting(true);
    try { await onDelete(); }
    catch (e) { setDeleting(false); setDeleteOpen(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/volunteer-teams"><ArrowLeft className="h-4 w-4" /> Back to MC Relationship Builders</Link>
        </Button>
        <div className="flex items-center gap-2">
          {canManage && !editing && (
            <>
              <Button size="sm" variant="outline" onClick={onEdit}><Save className="h-4 w-4" /> Edit Relationship Builder</Button>
              <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" /> Delete</Button>
            </>
          )}
          {canManage && editing && (
            <>
              <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}><X className="h-4 w-4" /> Cancel</Button>
              <Button size="sm" onClick={onSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
              </Button>
            </>
          )}
        </div>
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
            {editing && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={t?.active !== false}
                  onCheckedChange={(checked) => onField('active', checked)}
                />
                <Label className="text-sm text-muted-foreground cursor-pointer">
                  {t?.active === false ? 'Inactive' : 'Active'}
                </Label>
              </div>
            )}
            <span className="text-sm text-muted-foreground">
              {memberCount} {memberCount === 1 ? 'member' : 'members'} · {championCount} {championCount === 1 ? 'Champion' : 'Champions'}
            </span>
          </div>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this Relationship Builder?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{team.team_name}".
              {activeAssignmentCount > 0 ? (
                <>
                  {' '}It currently has {activeAssignmentCount} active {activeAssignmentCount === 1 ? 'assignment' : 'assignments'}.
                  Those {activeAssignmentCount === 1 ? 'assignment will be ended and the associated Champion will become unassigned' : 'assignments will be ended and the associated Champions will become unassigned'}.
                </>
              ) : null}
              {' '}This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete Relationship Builder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
import React from 'react';
import { Users as UsersIcon, Plus, Trash2, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TeamSection from './TeamSection';

const TEAM_ROLES = ['Lead', 'Member'];

export default function TeamMembersCard({ members, users, canManage, newMember, setNewMember, onAdd, onRemove }) {
  return (
    <TeamSection
      icon={UsersIcon}
      title="Team Members"
      action={<span className="text-xs text-muted-foreground">{members.length} {members.length === 1 ? 'member' : 'members'}</span>}
    >
      <div className="space-y-3">
        {members.length === 0 && !canManage && (
          <p className="text-sm text-muted-foreground">No members on this team yet.</p>
        )}
        {members.map((m) => (
          <div key={m.id} className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <StatusBadge variant={m.team_role === 'Lead' ? 'info' : 'neutral'}>{m.team_role}</StatusBadge>
              {canManage && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onRemove(m)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="mt-2 text-sm font-medium text-foreground">{m.display_name}</p>
            {m.email && <p className="text-xs text-muted-foreground">{m.email}</p>}
            {m.user_id && (
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-600">
                <UserCheck className="h-3 w-3" /> Linked app user
              </p>
            )}
          </div>
        ))}
        {canManage && (
          <div className="rounded-lg border border-dashed p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Add Member</p>
            {!newMember.manual ? (
              <Select
                value={newMember.user_id || '__none__'}
                onValueChange={(v) => {
                  if (v === '__manual__') {
                    setNewMember((nm) => ({ ...nm, manual: true, user_id: '', display_name: '', email: '' }));
                  } else {
                    const u = users.find((x) => x.id === v);
                    setNewMember((nm) => ({ ...nm, user_id: v, display_name: u?.full_name || u?.email || '', email: u?.email || '' }));
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select an app user…" /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
                  <SelectItem value="__manual__">Add manually (no account)…</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input placeholder="Display name" value={newMember.display_name} onChange={(e) => setNewMember((nm) => ({ ...nm, display_name: e.target.value }))} />
                <Input placeholder="Email (optional)" value={newMember.email} onChange={(e) => setNewMember((nm) => ({ ...nm, email: e.target.value }))} />
              </div>
            )}
            <div className="mt-2 flex items-center gap-2">
              <Select value={newMember.team_role} onValueChange={(v) => setNewMember((nm) => ({ ...nm, team_role: v }))}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEAM_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={onAdd}><Plus className="h-4 w-4" /> Add</Button>
              {newMember.manual && (
                <Button size="sm" variant="ghost" onClick={() => setNewMember((nm) => ({ ...nm, manual: false }))}>Select user</Button>
              )}
            </div>
          </div>
        )}
      </div>
    </TeamSection>
  );
}
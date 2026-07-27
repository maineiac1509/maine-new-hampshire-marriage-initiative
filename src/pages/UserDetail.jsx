import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { PageHeader } from '@/components/ui/PageHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import RoleBadge from '@/components/RoleBadge';
import { ArrowLeft, Save } from 'lucide-react';

export default function UserDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [team, setTeam] = useState(null);
  const [role, setRole] = useState('volunteer');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      base44.entities.User.get(id),
      base44.entities.TeamMember.list(),
      base44.entities.VolunteerTeam.list(),
    ]).then((r) => {
      if (r[0].status === 'fulfilled' && r[0].value) {
        const u = r[0].value;
        setUser(u);
        setRole(u.role || 'volunteer');
      }
      const members = r[1].status === 'fulfilled' ? r[1].value || [] : [];
      const teams = r[2].status === 'fulfilled' ? r[2].value || [] : [];
      const m = members.find((x) => x.user_id === id);
      if (m) setTeam(teams.find((t) => t.id === m.team_id) || null);
      setLoading(false);
    });
  }, [id]);

  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.User.update(id, { role });
      setUser((u) => ({ ...u, role }));
      toast({ title: 'Role updated' });
    } catch (e) {
      toast({ title: 'Could not update role', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!user) return <div className="p-8 text-center text-muted-foreground">User not found.</div>;

  return (
    <div className="space-y-6">
      <Link to="/users" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Users
      </Link>
      <PageHeader title={user.full_name || 'User'} subtitle={user.email} />

      <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Role</p>
            <p className="text-xs text-muted-foreground">Determines what this user can administer within Champion Connect.</p>
          </div>
          <RoleBadge role={user.role} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger id="role"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Administrator</SelectItem>
              <SelectItem value="volunteer">Volunteer</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Administrators manage users, roles, assignments, and settings. Volunteers steward their assigned Champions.</p>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving || role === user.role}>
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Role'}
          </Button>
        </div>
      </div>

      <div className="space-y-1 rounded-xl border bg-card p-5 shadow-sm">
        <p className="text-sm font-semibold text-foreground">Volunteer Team</p>
        <p className="text-xs text-muted-foreground">Role and Volunteer Team are managed independently — changing one never changes the other.</p>
        {team ? (
          <Link to={`/volunteer-teams/${team.id}`} className="mt-1 inline-block text-sm font-medium text-primary hover:underline">{team.team_name}</Link>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Not assigned to a Volunteer Team.</p>
        )}
      </div>
    </div>
  );
}
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { PageHeader } from '@/components/ui/PageHeader';
import { Input } from '@/components/ui/input';
import RoleBadge from '@/components/RoleBadge';
import { Search, ChevronRight } from 'lucide-react';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [members, setMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      base44.entities.User.list(),
      base44.entities.TeamMember.list(),
      base44.entities.VolunteerTeam.list(),
    ]).then((r) => {
      const v = (i, f = []) => (r[i].status === 'fulfilled' ? r[i].value || f : f);
      setUsers(v(0));
      setMembers(v(1));
      setTeams(v(2));
      setLoading(false);
    });
  }, []);

  const teamForUser = (userId) => {
    const m = members.find((x) => x.user_id === userId);
    if (!m) return null;
    return teams.find((t) => t.id === m.team_id) || null;
  };

  const filtered = users.filter((u) => {
    const s = `${u.full_name || ''} ${u.email || ''}`.toLowerCase();
    return !q || s.includes(q.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Users" subtitle="Manage user roles and Volunteer Team assignments." />
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users..." className="pl-9" />
      </div>
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Volunteer Team</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((u) => {
              const team = teamForUser(u.id);
              return (
                <tr key={u.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium text-foreground">{u.full_name || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{team?.team_name || 'Unassigned'}</td>
                  <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/users/${u.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                      Manage <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
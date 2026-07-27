import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, ArrowUpDown, Users as UsersIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import RelationshipStatusBadge from '@/components/champions/RelationshipStatusBadge';
import { lastActivityDate, nextFollowUpDate } from '@/lib/championUtils';
import { fmtDate, householdDisplay } from '@/lib/teamUtils';
import TeamSection from './TeamSection';

const COLUMNS = [
  { key: 'name', label: 'Champion' },
  { key: 'status', label: 'Relationship Status' },
  { key: 'assigned', label: 'Assigned Date' },
  { key: 'lastContact', label: 'Last Contact' },
  { key: 'followUp', label: 'Follow-Up Due' },
  { key: 'volunteer', label: 'Assigned Volunteer' },
];

export default function AssignedChampionsTable({ champions, activitiesByHouse, assignments }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });

  const assignedDateMap = useMemo(() => {
    const m = {};
    (assignments || []).forEach((a) => { if (a.household_id) m[a.household_id] = a.assigned_date; });
    return m;
  }, [assignments]);

  const rows = useMemo(() => {
    let r = champions.map((c) => {
      const acts = activitiesByHouse[c.id] || [];
      return {
        id: c.id,
        name: householdDisplay(c),
        status: c.relationship_status,
        assigned: assignedDateMap[c.id] || c.registration_date || '',
        lastContact: lastActivityDate(acts),
        followUp: nextFollowUpDate(acts),
        volunteer: c.assigned_volunteer || '',
      };
    });
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((row) => [row.name, row.volunteer, row.status].filter(Boolean).some((v) => v.toLowerCase().includes(q)));
    }
    r.sort((a, b) => {
      const av = a[sort.key] || '';
      const bv = b[sort.key] || '';
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return r;
  }, [champions, activitiesByHouse, assignedDateMap, search, sort]);

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  }

  return (
    <TeamSection
      icon={UsersIcon}
      title="Assigned Champions"
      action={<span className="text-xs text-muted-foreground">{champions.length} assigned</span>}
    >
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search champions or volunteers…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {champions.length === 0 ? 'No Champions assigned to this team yet.' : 'No champions match your search.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {COLUMNS.map((col) => (
                  <th key={col.key} className="cursor-pointer select-none px-3 py-2 font-medium" onClick={() => toggleSort(col.key)}>
                    <span className="inline-flex items-center gap-1">{col.label}<ArrowUpDown className="h-3 w-3 opacity-50" /></span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0 transition-colors hover:bg-muted/40">
                  <td className="px-3 py-2.5"><Link to={`/champions/${row.id}`} className="font-medium hover:underline">{row.name}</Link></td>
                  <td className="px-3 py-2.5"><RelationshipStatusBadge status={row.status} /></td>
                  <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(row.assigned)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(row.lastContact)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(row.followUp)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{row.volunteer || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TeamSection>
  );
}
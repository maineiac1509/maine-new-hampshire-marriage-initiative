import React from 'react';
import { Gauge } from 'lucide-react';
import { Input } from '@/components/ui/input';
import TeamSection from './TeamSection';

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}

export default function CapacityCard({ team, form, editing, onField, assignedCount }) {
  const t = editing ? form : team;
  const target = Number(t?.target_capacity) || 12;
  const assigned = assignedCount;
  const remaining = Math.max(target - assigned, 0);
  const pct = target > 0 ? Math.round((assigned / target) * 100) : 0;
  const over = assigned > target;
  const near = !over && pct >= 80;
  const state = over ? 'Over Capacity' : near ? 'Near Capacity' : 'Under Capacity';
  const barColor = over ? 'bg-red-500' : near ? 'bg-amber-500' : 'bg-emerald-500';
  const barWidth = Math.min(pct, 100);

  return (
    <TeamSection icon={Gauge} title="Capacity">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Target Capacity" value={editing ? <Input type="number" value={t?.target_capacity ?? ''} onChange={(e) => onField('target_capacity', Number(e.target.value))} /> : target} />
        <Metric label="Assigned" value={assigned} />
        <Metric label="Remaining" value={remaining} />
        <Metric label="Capacity" value={`${pct}%`} />
      </div>
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span className={`font-medium ${over ? 'text-red-600' : near ? 'text-amber-600' : 'text-emerald-600'}`}>{state}</span>
          <span>{assigned} / {target}</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${barWidth}%` }} />
        </div>
      </div>
    </TeamSection>
  );
}
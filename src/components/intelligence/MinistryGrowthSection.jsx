import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { TrendingUp, UserPlus, Home, Sparkles, RefreshCw, UserX } from 'lucide-react';
import Section from './Section';
import MetricCard from './MetricCard';

const ICONS = { newChampions: UserPlus, newHouseholds: Home, recentlyEngaged: Sparkles, returning: RefreshCw, withoutStewardship: UserX };

export default function MinistryGrowthSection({ data }) {
  return (
    <Section index={4} title="Ministry Growth" summary={data.summary} icon={TrendingUp}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {data.metrics.map((m) => (
          <MetricCard
            key={m.key}
            title={m.label}
            value={m.value}
            delta={m.delta}
            positiveIsGood={m.positiveIsGood}
            drillTarget={m.drillTarget}
            icon={ICONS[m.key]}
          />
        ))}
      </div>
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Growth Trend (Last 6 Months)</p>
        <div className="mt-2 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="newChampions" name="New Champions" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="newAssignments" name="New Assignments" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Section>
  );
}
import React from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, Tooltip } from 'recharts';
import { HeartPulse } from 'lucide-react';
import Section from './Section';

const COLORS = { healthy: '#10b981', 'follow-up': '#f59e0b', 're-engagement': '#f97316', immediate: '#ef4444' };

export default function MinistryHealthSection({ data }) {
  const chartData = data.distribution.map((d) => ({ name: d.label.split(' ')[0], count: d.count, key: d.key }));
  return (
    <Section index={1} title="Ministry Health" summary={data.summary} icon={HeartPulse}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Champion Health Distribution</p>
          <div className="mt-2 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {chartData.map((d, i) => <Cell key={i} fill={COLORS[d.key]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="space-y-2">
          {data.distribution.map((d) => {
            const isGood = d.key === 'healthy' ? d.delta > 0 : d.delta < 0;
            return (
              <Link key={d.key} to={d.drillTarget} className="group flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/40">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${d.color}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{d.label}</span>
                    <span className="text-sm font-semibold">{d.count} · {d.pct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                    <div className={`h-full rounded-full ${d.color}`} style={{ width: `${d.pct}%` }} />
                  </div>
                </div>
                {d.delta !== 0 && (
                  <span className={`text-xs font-medium ${isGood ? 'text-emerald-600' : 'text-red-600'}`}>
                    {d.delta > 0 ? '+' : ''}{d.delta}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
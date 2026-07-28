import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { Activity, CheckCircle2, Clock, Eye, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SEVERITY_COLORS } from '@/lib/signalHistory';

const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

function MetricCard({ icon: Icon, label, value, sub, drillLabel, onDrill }) {
  return (
    <button type="button" onClick={onDrill} className="group block h-full rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/40">
      <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />{label}
      </span>
      <span className="mt-2 block text-2xl font-bold text-foreground">{value}</span>
      {sub && <span className="mt-0.5 block text-xs text-muted-foreground">{sub}</span>}
      <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
        {drillLabel}
      </span>
    </button>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <div className="mt-3 h-56">{children}</div>
    </div>
  );
}

const tooltipStyle = { fontSize: '12px', borderRadius: '8px', border: '1px solid hsl(var(--border))' };

export default function SignalAnalytics({ analytics, onDrill }) {
  const a = analytics;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard icon={Activity} label="Signals Generated" value={a.generated} drillLabel="View all" onDrill={() => onDrill({ status: 'all', severity: 'all', signalType: 'all', category: 'all' })} />
        <MetricCard icon={CheckCircle2} label="Signals Resolved" value={a.resolved} sub={a.open ? `${a.open} open` : undefined} drillLabel="View resolved" onDrill={() => onDrill({ status: 'Resolved' })} />
        <MetricCard icon={Clock} label="Avg Resolution Time" value={a.avgResolutionTime ?? '—'} sub={a.avgResolutionTime != null ? 'days' : undefined} drillLabel="View resolved" onDrill={() => onDrill({ status: 'Resolved' })} />
        <MetricCard icon={Eye} label="Avg Time to Acknowledge" value={a.avgTimeToAcknowledge ?? '—'} sub={a.avgTimeToAcknowledge != null ? 'days' : undefined} drillLabel="View acknowledged" onDrill={() => onDrill({ status: 'Acknowledged' })} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Signals Created Over Time">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={a.overTime} onClick={(e) => e && e.activeLabel && onDrill(monthBounds(e.activeLabel))}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="created" name="Created" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Signals Resolved Over Time">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={a.overTime} onClick={(e) => e && e.activeLabel && onDrill({ ...monthBounds(e.activeLabel), status: 'Resolved' })}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="resolved" name="Resolved" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Signals by Severity">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={a.bySeverity} layout="vertical" onClick={(e) => e && e.activeLabel && onDrill({ severity: e.activeLabel })}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="key" tick={{ fontSize: 11 }} width={80} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" name="Signals" radius={[0, 4, 4, 0]}>
                {a.bySeverity.map((entry) => <Cell key={entry.key} fill={SEVERITY_COLORS[entry.key] || '#64748b'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top Signal Types">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={a.byType} layout="vertical" onClick={(e) => e && e.activeLabel && onDrill({ signalType: e.activeLabel })} margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="key" tick={{ fontSize: 10 }} width={140} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" name="Signals" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Open vs Resolved">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={a.openVsResolved} dataKey="count" nameKey="key" cx="50%" cy="50%" outerRadius={80} label={(d) => `${d.key}: ${d.count}`} onClick={(d) => d && d.name && onDrill({ status: d.name })}>
                {a.openVsResolved.map((entry, i) => <Cell key={entry.key} fill={entry.key === 'Open' ? '#3b82f6' : '#10b981'} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Avg Resolution Time (days) by Month">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={a.resolutionOverTime}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="avg" name="Avg days" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function monthBounds(key) {
  const [y, m] = key.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return { dateFrom: start.toISOString().slice(0, 10), dateTo: end.toISOString().slice(0, 10) };
}
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Download, Printer, Loader2, History } from 'lucide-react';
import SignalHistoryFilters from '@/components/signals/SignalHistoryFilters';
import SignalAnalytics from '@/components/signals/SignalAnalytics';
import SignalTimeline from '@/components/signals/SignalTimeline';
import {
  normalizeSignals, filterSignals, computeAnalytics, toCSV, SIGNAL_FILTER_DEFAULTS,
} from '@/lib/signalHistory';

function printReport(signals, analytics) {
  const w = window.open('', '_blank');
  if (!w) return;
  const rows = signals.map((s) => `<tr><td>${s.signalType}</td><td>${s.severity}</td><td>${s.status}</td><td>${(s.createdDate || '').slice(0, 10)}</td><td>${(s.resolvedDate || '').slice(0, 10)}</td><td>${s.resolutionTimeDays ?? ''}</td><td>${s.title}</td></tr>`).join('');
  w.document.write(`<!doctype html><html><head><title>Ministry Signal History</title><style>
    body{font-family:system-ui,sans-serif;padding:24px;color:#0f172a}
    h1{font-size:18px;margin:0 0 4px} h2{font-size:14px;margin:16px 0 6px;color:#475569}
    .m{display:flex;gap:16px;margin:12px 0} .m div{font-size:13px} b{font-size:16px}
    table{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px}
    th,td{border:1px solid #e2e8f0;padding:4px 6px;text-align:left}
    th{background:#f8fafc} .meta{font-size:11px;color:#64748b;margin-bottom:12px}
  </style></head><body>
    <h1>Ministry Signal History Report</h1>
    <div class="meta">Generated ${new Date().toLocaleString()} · ${signals.length} signal(s)</div>
    <div class="m">
      <div><b>${analytics.generated}</b><br/>Generated</div>
      <div><b>${analytics.resolved}</b><br/>Resolved</div>
      <div><b>${analytics.avgResolutionTime ?? '—'}</b><br/>Avg resolution (days)</div>
      <div><b>${analytics.open}</b><br/>Open</div>
    </div>
    <h2>Signals</h2>
    <table><thead><tr><th>Type</th><th>Severity</th><th>Status</th><th>Created</th><th>Resolved</th><th>Days</th><th>Title</th></tr></thead>
    <tbody>${rows}</tbody></table>
  </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}

export default function MinistrySignalHistory() {
  const [signals, setSignals] = useState([]);
  const [teams, setTeams] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(SIGNAL_FILTER_DEFAULTS);
  const timelineRef = useRef(null);

  useEffect(() => {
    Promise.allSettled([
      base44.entities.MinistrySignal.list('-created_date', 1000),
      base44.entities.LeadershipActionItem.list('-created_date', 500),
      base44.entities.VolunteerTeam.list(),
    ]).then((res) => {
      const v = (i, f = []) => (res[i].status === 'fulfilled' ? res[i].value || f : f);
      setSignals(v(0));
      setActions(v(1));
      setTeams(v(2));
      setLoading(false);
    });
  }, []);

  const normalized = useMemo(() => normalizeSignals(signals, teams, actions), [signals, teams, actions]);
  const regions = useMemo(() => [...new Set(teams.map((t) => t.state).filter(Boolean))].sort(), [teams]);
  const filtered = useMemo(() => filterSignals(normalized, filters), [normalized, filters]);
  const analytics = useMemo(() => computeAnalytics(filtered), [filtered]);

  function drill(partial) {
    setFilters((f) => ({ ...f, ...partial }));
    setTimeout(() => timelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function exportCSV() {
    const csv = toCSV(filtered);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ministry-signals-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ministry Signal History"
        subtitle="Historical Ministry Signals, analytics, and leadership learning — institutional knowledge for long-term ministry health."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={loading || !filtered.length}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => printReport(filtered, analytics)} disabled={loading || !filtered.length}>
              <Printer className="h-4 w-4" /> Report
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {normalized.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-card p-12 text-center">
              <History className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium text-foreground">No Ministry Signals recorded yet</p>
              <p className="text-xs text-muted-foreground">Signals will appear here as the Ministry Intelligence Engine generates them.</p>
            </div>
          ) : (
            <>
              <SignalAnalytics analytics={analytics} onDrill={drill} />
              <SignalHistoryFilters filters={filters} onChange={setFilters} teams={teams} regions={regions} resultCount={filtered.length} />
              <div ref={timelineRef}>
                <SignalTimeline signals={filtered} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
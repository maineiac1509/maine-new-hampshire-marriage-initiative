// Ministry Signal history & analytics logic.
// Pure functions over normalized signal records — no persistence, no side effects.
// Consumed by the Ministry Signal History page. Reusable by Epic 7 queries.

const DAY = 86400000;

export const SIGNAL_STATUSES = ['Open', 'Acknowledged', 'Resolved'];
export const SIGNAL_SEVERITIES = ['Information', 'Low', 'Medium', 'High', 'Critical'];
export const SIGNAL_CATEGORIES = ['Capacity', 'Stewardship', 'Growth', 'Recommendations', 'Momentum', 'Transfers'];
export const SIGNAL_TYPES = [
  'Volunteer Capacity Risk', 'Assignment Imbalance', 'Growing Ministry Region',
  'Declining Stewardship Health', 'Recommendation Backlog', 'Positive Ministry Momentum',
  'Stewardship Transfer Trend', 'Unassigned Champion Growth',
];

export const SIGNAL_FILTER_DEFAULTS = {
  status: 'all', severity: 'all', signalType: 'all', category: 'all',
  teamId: 'all', region: 'all', dateFrom: '', dateTo: '',
};

export const SEVERITY_COLORS = {
  Information: '#64748b', Low: '#3b82f6', Medium: '#f59e0b', High: '#f97316', Critical: '#ef4444',
};

function parseJSON(val, fallback) {
  if (!val) return fallback;
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch (e) { return fallback; }
}

function toMs(val) {
  if (!val) return 0;
  const t = new Date(val.length > 10 ? val : val + 'T00:00:00').getTime();
  return Number.isNaN(t) ? 0 : t;
}

function monthKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key) {
  if (!key) return '';
  const [y, m] = key.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString(undefined, { month: 'short', year: '2-digit' });
}

export function monthBounds(key) {
  const [y, m] = key.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59);
  return { dateFrom: start.toISOString().slice(0, 10), dateTo: end.toISOString().slice(0, 10) };
}

// Build enriched, display-ready signal objects from raw records + teams + actions.
export function normalizeSignals(records, teams, actions) {
  const teamMap = {};
  (teams || []).forEach((t) => { teamMap[t.id] = t; });
  const actionsBySignal = {};
  (actions || []).forEach((a) => {
    const k = a.signal_id;
    if (!actionsBySignal[k]) actionsBySignal[k] = [];
    actionsBySignal[k].push(a);
  });
  return (records || [])
    .map((r) => {
      const createdMs = toMs(r.created_date);
      const ackMs = toMs(r.acknowledged_date);
      const resolvedMs = toMs(r.resolved_date);
      const teamIds = parseJSON(r.related_teams, []);
      const relatedTeams = teamIds.map((id) => ({
        id, name: teamMap[id]?.team_name || 'Unnamed Team',
        region: teamMap[id]?.state || teamMap[id]?.city || '',
      }));
      const regions = [...new Set(relatedTeams.map((t) => t.region).filter(Boolean))];
      const actions = actionsBySignal[r.id] || [];
      return {
        id: r.id, identity: r.identity, signalType: r.signal_type, category: r.category,
        severity: r.severity, title: r.title, description: r.description,
        whyGenerated: r.why_generated ? r.why_generated.split('\n').filter(Boolean) : [],
        supportingMetrics: parseJSON(r.supporting_metrics, []),
        relatedTeams, regions, suggestedAction: r.suggested_action,
        status: r.status, createdMs, ackMs, resolvedMs,
        createdDate: r.created_date, dateGenerated: r.date_generated,
        acknowledgedDate: r.acknowledged_date, resolvedDate: r.resolved_date,
        resolutionNotes: r.resolution_notes || '', actions,
        resolutionTimeDays: resolvedMs && createdMs ? Math.round(((resolvedMs - createdMs) / DAY) * 10) / 10 : null,
        timeToAcknowledgeDays: ackMs && createdMs ? Math.round(((ackMs - createdMs) / DAY) * 10) / 10 : null,
      };
    })
    .sort((a, b) => (b.createdMs || 0) - (a.createdMs || 0));
}

export function filterSignals(signals, f) {
  return signals.filter((s) => {
    if (f.status !== 'all' && s.status !== f.status) return false;
    if (f.severity !== 'all' && s.severity !== f.severity) return false;
    if (f.signalType !== 'all' && s.signalType !== f.signalType) return false;
    if (f.category !== 'all' && s.category !== f.category) return false;
    if (f.teamId !== 'all' && !s.relatedTeams.some((t) => t.id === f.teamId)) return false;
    if (f.region !== 'all' && !s.regions.includes(f.region)) return false;
    if (f.dateFrom && s.createdMs && s.createdMs < toMs(f.dateFrom)) return false;
    if (f.dateTo && s.createdMs && s.createdMs > toMs(f.dateTo) + DAY) return false;
    return true;
  });
}

function countBy(signals, field, order) {
  const m = {};
  signals.forEach((s) => { m[s[field]] = (m[s[field]] || 0) + 1; });
  if (order) return order.map((k) => ({ key: k, count: m[k] || 0 }));
  return Object.entries(m).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

function avg(vals) {
  const f = vals.filter((v) => v != null);
  if (!f.length) return null;
  return Math.round((f.reduce((a, b) => a + b, 0) / f.length) * 10) / 10;
}

export function computeAnalytics(signals) {
  const resolved = signals.filter((s) => s.status === 'Resolved');
  const open = signals.filter((s) => s.status === 'Open');
  const acknowledged = signals.filter((s) => s.status === 'Acknowledged');
  const resolutionTimes = resolved.map((s) => s.resolutionTimeDays);
  const ackTimes = signals.filter((s) => s.ackMs).map((s) => s.timeToAcknowledgeDays);

  const createdByMonth = {};
  const resolvedByMonth = {};
  const resByMonth = {};
  signals.forEach((s) => {
    if (s.createdMs) { const k = monthKey(s.createdMs); createdByMonth[k] = (createdByMonth[k] || 0) + 1; }
    if (s.resolvedMs) {
      const k = monthKey(s.resolvedMs);
      resolvedByMonth[k] = (resolvedByMonth[k] || 0) + 1;
      if (s.resolutionTimeDays != null) {
        if (!resByMonth[k]) resByMonth[k] = [];
        resByMonth[k].push(s.resolutionTimeDays);
      }
    }
  });
  const months = [...new Set([...Object.keys(createdByMonth), ...Object.keys(resolvedByMonth)])].sort();
  const overTime = months.map((k) => ({
    month: k, label: monthLabel(k),
    created: createdByMonth[k] || 0, resolved: resolvedByMonth[k] || 0,
  }));
  const resolutionOverTime = months.map((k) => ({
    month: k, label: monthLabel(k), avg: resByMonth[k] ? avg(resByMonth[k]) : 0,
  }));

  return {
    generated: signals.length,
    resolved: resolved.length,
    open: open.length,
    acknowledged: acknowledged.length,
    avgResolutionTime: avg(resolutionTimes),
    avgTimeToAcknowledge: avg(ackTimes),
    bySeverity: countBy(signals, 'severity', SIGNAL_SEVERITIES),
    byCategory: countBy(signals, 'category', SIGNAL_CATEGORIES),
    byType: countBy(signals, 'signalType'),
    overTime,
    resolutionOverTime,
    openVsResolved: [{ key: 'Open', count: open.length }, { key: 'Resolved', count: resolved.length }],
  };
}

// Derive a leadership outcome label from a resolved signal's action items.
export function deriveOutcome(signal) {
  const actions = signal.actions || [];
  if (!actions.length) return { label: 'Resolved without recorded actions', tone: 'neutral' };
  const completed = actions.filter((a) => a.progress === 'Completed').length;
  if (completed === actions.length) return { label: 'Fully addressed', tone: 'success' };
  if (completed > 0) return { label: 'Partially addressed', tone: 'info' };
  return { label: 'Actions pending', tone: 'warning' };
}

// Build CSV from normalized signals.
export function toCSV(signals) {
  const rows = [['ID', 'Type', 'Category', 'Severity', 'Status', 'Title', 'Created', 'Acknowledged', 'Resolved', 'Resolution Time (days)', 'Time to Acknowledge (days)', 'Resolution Notes', 'Actions']];
  signals.forEach((s) => {
    rows.push([
      s.id, s.signalType, s.category, s.severity, s.status, s.title,
      s.createdDate || '', s.acknowledgedDate || '', s.resolvedDate || '',
      s.resolutionTimeDays ?? '', s.timeToAcknowledgeDays ?? '',
      (s.resolutionNotes || '').replace(/\n/g, ' '), String(s.actions.length),
    ]);
  });
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}
import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle2, Clock, Database, Loader2 } from 'lucide-react';
import { getAmbientStateStats } from '@/lib/ambientState';
import { loadAIConfig, isCapabilityEnabled } from '@/lib/ministryCoachConfig';

function fmtRelative(isoStr) {
  if (!isoStr) return 'Never';
  const diff = Date.now() - new Date(isoStr).getTime();
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function AmbientIntelligenceSection({ config }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const s = getAmbientStateStats();
      if (!cancelled) { setStats(s); setLoading(false); }
    }
    load();
    const interval = setInterval(load, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const engineActive = config?.ai_enabled;
  const activeCapabilities = config
    ? Object.entries(config.capabilities || {}).filter(([_, v]) => v !== false).map(([k]) => k)
    : [];

  const items = [
    {
      label: 'Ambient Engine Status',
      value: engineActive ? 'Active' : 'Inactive',
      icon: engineActive ? CheckCircle2 : Activity,
      tone: engineActive ? 'text-emerald-600' : 'text-muted-foreground',
    },
    {
      label: 'Last Context Evaluation',
      value: stats?.lastEvaluation ? fmtRelative(stats.lastEvaluation) : 'Never',
      icon: Clock,
    },
    {
      label: 'Active Suggestion Count',
      value: loading ? '…' : String(stats?.activeCount || 0),
      icon: Activity,
    },
    {
      label: 'Total Champions Evaluated',
      value: loading ? '…' : String(stats?.totalEvaluated || 0),
      icon: Database,
    },
  ];

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <Activity className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Ambient Intelligence</h2>
          <p className="text-sm text-muted-foreground">
            The orchestration layer that coordinates all Ministry Coach capabilities into a single, context-aware companion.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
            <div className="mt-1 flex items-center gap-1.5">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              <p className={`text-sm font-semibold ${item.tone || 'text-foreground'}`}>{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-lg border bg-muted/30 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Coordinated Capabilities</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {activeCapabilities.length > 0 ? (
            activeCapabilities.map((cap) => (
              <span key={cap} className="inline-flex items-center rounded-full bg-background px-2.5 py-0.5 text-xs font-medium text-foreground border">
                {cap.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </span>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">No capabilities active — Ministry Coach is silent.</span>
          )}
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        The Ambient Intelligence Engine evaluates ministry context, applies deterministic rules, enforces the Ministry Coach
        Charter, prioritizes competing suggestions, and surfaces only the single most meaningful guidance. It never generates
        AI content — it orchestrates existing capabilities. Silence is the default when no meaningful moment exists.
      </p>
    </section>
  );
}
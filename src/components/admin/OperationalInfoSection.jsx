import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { StatusBadge } from '@/components/ui/StatusBadge';

function fmtDate(dateStr) {
  if (!dateStr) return 'Never';
  try {
    return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return dateStr; }
}

export default function OperationalInfoSection({ config }) {
  const [lastSuccess, setLastSuccess] = useState(null);
  const [lastFailure, setLastFailure] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [successes, failures] = await Promise.all([
          base44.entities.AIRequestLog.filter({ success: true }, '-created_date', 1).catch(() => []),
          base44.entities.AIRequestLog.filter({ success: false }, '-created_date', 1).catch(() => []),
        ]);
        setLastSuccess(successes?.[0] || null);
        setLastFailure(failures?.[0] || null);
      } catch { /* admin-only page */ }
      setLoading(false);
    }
    load();
  }, []);

  const providerStatus = !lastSuccess && !lastFailure ? 'unknown'
    : lastSuccess && !lastFailure ? 'healthy'
    : lastFailure && !lastSuccess ? 'unhealthy'
    : new Date(lastSuccess.created_date) > new Date(lastFailure.created_date) ? 'healthy' : 'degraded';

  const flagStatus = config.ai_enabled ? 'enabled' : 'disabled';

  const items = [
    {
      label: 'Last Successful Request',
      value: loading ? 'Loading…' : lastSuccess ? fmtDate(lastSuccess.created_date) : 'No successful requests yet',
      detail: lastSuccess?.capability,
    },
    {
      label: 'Last Failed Request',
      value: loading ? 'Loading…' : lastFailure ? fmtDate(lastFailure.created_date) : 'No failed requests',
      detail: lastFailure?.error_category,
    },
    {
      label: 'Provider Status',
      value: providerStatus === 'healthy' ? 'Healthy' : providerStatus === 'unhealthy' ? 'Unhealthy' : providerStatus === 'degraded' ? 'Degraded' : 'Unknown',
      badge: providerStatus,
    },
    {
      label: 'Feature Flag Status',
      value: flagStatus === 'enabled' ? 'Enabled (global)' : 'Disabled (global)',
      badge: flagStatus,
    },
  ];

  const badgeVariant = (b) => b === 'healthy' || b === 'enabled' ? 'success' : b === 'degraded' ? 'warning' : b === 'unhealthy' ? 'danger' : b === 'disabled' ? 'neutral' : 'info';

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <Activity className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Operational Information</h2>
          <p className="text-sm text-muted-foreground">Recent operational status. No ministry content is displayed here.</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{item.value}</p>
              {item.badge && <StatusBadge variant={badgeVariant(item.badge)}>{item.badge}</StatusBadge>}
            </div>
            {item.detail && <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
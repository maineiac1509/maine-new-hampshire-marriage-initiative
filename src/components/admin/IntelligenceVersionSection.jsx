import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { GitBranch, Loader2 } from 'lucide-react';

const ENGINE_VERSION = '1.0';

function formatDate(d) {
  if (!d) return 'Not yet configured';
  const dt = new Date(d.length > 10 ? d : d + 'T00:00:00');
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function IntelligenceVersionSection() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const recs = await base44.entities.MinistryIntelligenceConfig.list();
        if (!cancelled) setConfig(recs?.[0] || null);
      } catch (e) {
        if (!cancelled) setConfig(null);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const items = [
    { label: 'Ministry Intelligence Engine Version', value: ENGINE_VERSION },
    { label: 'Last Configuration Update', value: config?.last_updated ? formatDate(config.last_updated) : 'Not yet configured' },
    { label: 'Last Updated By', value: config?.updated_by || '—' },
  ];

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <GitBranch className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Version Information</h2>
          <p className="text-sm text-muted-foreground">Ministry Intelligence Engine version and configuration history.</p>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <div key={item.label} className="rounded-lg border p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
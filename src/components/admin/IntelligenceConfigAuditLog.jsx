import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { History, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const ACTION_TONE = {
  Updated: 'bg-blue-100 text-blue-700',
  'Reset to Defaults': 'bg-amber-100 text-amber-700',
};

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d.length > 10 ? d : d + 'T00:00:00');
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function IntelligenceConfigAuditLog({ refreshKey }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const list = await base44.entities.IntelligenceConfigAudit.list('-change_date', 25);
        if (!cancelled) setEntries(list || []);
      } catch (e) { if (!cancelled) setEntries([]); }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  return (
    <div className="mt-5 rounded-lg border p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <History className="h-4 w-4 text-muted-foreground" /> Configuration Audit History
      </h3>
      {loading ? (
        <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : entries.length ? (
        <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
          {entries.map((e) => (
            <li key={e.id} className="rounded-md border bg-background p-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-foreground">{e.field_label || e.field_name}</span>
                <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', ACTION_TONE[e.action] || 'bg-muted text-muted-foreground')}>
                  {e.action}
                </span>
              </div>
              <p className="mt-1 text-muted-foreground">
                <span className="line-through">{e.previous_value || '—'}</span>
                <span className="mx-1.5">→</span>
                <span className="font-medium text-foreground">{e.new_value}</span>
              </p>
              <p className="mt-1 text-muted-foreground">{e.changed_by || 'Administrator'} · {formatDate(e.change_date)}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">No configuration changes recorded yet.</p>
      )}
    </div>
  );
}
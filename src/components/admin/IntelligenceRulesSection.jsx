import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { RECOMMENDATION_CONFIG } from '@/lib/recommendationEngine';
import { STEWARDSHIP_HEALTH_CONFIG } from '@/lib/stewardshipHealth';

const RULE_SETTINGS = [
  { label: 'Days before Follow-up', value: `${STEWARDSHIP_HEALTH_CONFIG.thresholds.followUp} days`, description: 'Inactivity before Follow-up Recommended.' },
  { label: 'Days before Re-engagement', value: `${STEWARDSHIP_HEALTH_CONFIG.thresholds.reEngagement} days`, description: 'Inactivity before Re-engagement Opportunity.' },
  { label: 'Days before Immediate Attention', value: `${STEWARDSHIP_HEALTH_CONFIG.thresholds.immediate} days`, description: 'Inactivity before Immediate Attention.' },
  { label: 'Capacity Threshold', value: `${RECOMMENDATION_CONFIG.capacityThresholdPct}%`, description: 'Relationship Builder utilization before Near Capacity.' },
  { label: 'Transfer Monitoring Period', value: `${RECOMMENDATION_CONFIG.transferMonitoringDays} days`, description: 'Window to confirm transferred stewardship.' },
  { label: 'Upcoming Assignment Window', value: `${RECOMMENDATION_CONFIG.endingSoonDays} days`, description: 'Planned end within this window flags Stewardship Ending Soon.' },
];

export default function IntelligenceRulesSection() {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Intelligence Rules</h2>
          <p className="text-sm text-muted-foreground">Deterministic ministry rules — not AI behavior. These thresholds drive the Stewardship Recommendation Engine and relationship status guidance.</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {RULE_SETTINGS.map((r) => (
          <div key={r.label} className="rounded-lg border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{r.label}</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-foreground">{r.value}</p>
            <p className="text-xs text-muted-foreground">{r.description}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">These rules are deterministic ministry logic built into Champion Connect. They work alongside the configurable thresholds above but are defined at the system level.</p>
    </section>
  );
}
import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Settings, Upload, ListChecks, UsersRound, ArrowRight, SlidersHorizontal, UserCheck, Sparkles } from 'lucide-react';
import { RECOMMENDATION_CONFIG } from '@/lib/recommendationEngine';
import { STEWARDSHIP_HEALTH_CONFIG } from '@/lib/stewardshipHealth';
import IntelligenceConfigSection from '@/components/admin/IntelligenceConfigSection';

const SECTIONS = [
  {
    icon: Settings,
    title: 'System Settings',
    description: 'Configure app-wide preferences and event details.',
  },
  {
    icon: Upload,
    title: 'Import Data',
    description: 'Bulk import Marriage Champions from spreadsheets.',
  },
  {
    icon: ListChecks,
    title: 'Assignment Rules',
    description: 'Define matching rules for the future Assignment Engine.',
  },
];

const RULE_SETTINGS = [
  { label: 'Days before Follow-up', value: `${STEWARDSHIP_HEALTH_CONFIG.thresholds.followUp} days`, description: 'Inactivity before Follow-up Recommended.' },
  { label: 'Days before Re-engagement', value: `${STEWARDSHIP_HEALTH_CONFIG.thresholds.reEngagement} days`, description: 'Inactivity before Re-engagement Opportunity.' },
  { label: 'Days before Immediate Attention', value: `${STEWARDSHIP_HEALTH_CONFIG.thresholds.immediate} days`, description: 'Inactivity before Immediate Attention.' },
  { label: 'Capacity Threshold', value: `${RECOMMENDATION_CONFIG.capacityThresholdPct}%`, description: 'Relationship Builder utilization before Near Capacity.' },
  { label: 'Transfer Monitoring Period', value: `${RECOMMENDATION_CONFIG.transferMonitoringDays} days`, description: 'Window to confirm transferred stewardship.' },
  { label: 'Upcoming Assignment Window', value: `${RECOMMENDATION_CONFIG.endingSoonDays} days`, description: 'Planned end within this window flags Stewardship Ending Soon.' },
];

export default function Administration() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Administration</h1>
        <p className="text-sm text-muted-foreground">System configuration and management</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          to="/users"
          className="group flex items-start gap-4 rounded-xl border bg-card p-5 shadow-sm transition-colors hover:bg-muted/40"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Users & Roles</h3>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Manage user accounts and assign Administrator or Volunteer roles.</p>
          </div>
        </Link>

        <Link
          to="/volunteer-teams"
          className="group flex items-start gap-4 rounded-xl border bg-card p-5 shadow-sm transition-colors hover:bg-muted/40"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <UsersRound className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">MC Relationship Builders</h3>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Manage MC Relationship Builders, members, and Champion assignments.</p>
          </div>
        </Link>

        <Link
          to="/assignments"
          className="group flex items-start gap-4 rounded-xl border bg-card p-5 shadow-sm transition-colors hover:bg-muted/40"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <UserCheck className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Assignments</h3>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Assign, reassign, and close Champion stewardship. Review workload and Relationship Builder capacity.</p>
          </div>
        </Link>

        <Link
          to="/administration/ministry-coach"
          className="group flex items-start gap-4 rounded-xl border bg-card p-5 shadow-sm transition-colors hover:bg-muted/40"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Ministry Coach</h3>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Configure AI providers, Ministry Coach capabilities, feature flags, connection status, and operational settings.</p>
          </div>
        </Link>

        {SECTIONS.map((s) => (
          <div key={s.title} className="flex items-start gap-4 rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <s.icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">{s.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
              <span className="mt-3 inline-block text-xs text-muted-foreground">Coming soon</span>
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
            <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Recommendation Rules</h2>
            <p className="text-sm text-muted-foreground">Centralized thresholds that drive the Stewardship Recommendation Engine.</p>
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
        <p className="mt-3 text-xs text-muted-foreground">Additional recommendation rules can be added without modifying existing logic. These values are the foundation for future Ministry Coach intelligence.</p>
      </section>

      <IntelligenceConfigSection />
    </div>
  );
}
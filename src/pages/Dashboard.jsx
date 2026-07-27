import React from 'react';
import { CalendarClock, UserPlus, Clock, CheckCircle2, Users, Activity } from 'lucide-react';
import { APP_CONFIG } from '@/lib/config';

function daysUntil(dateStr) {
  const target = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function WidgetCard({ icon: Icon, title, children, accent }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className={`h-4 w-4 ${accent || ''}`} />
        <span className="text-xs font-medium uppercase tracking-wide">{title}</span>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export default function Dashboard() {
  const days = daysUntil(APP_CONFIG.weekendDate);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {APP_CONFIG.ministry} · {APP_CONFIG.event}
        </p>
      </div>

      {/* Hero countdown */}
      <div className="overflow-hidden rounded-xl border bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground shadow-sm">
        <div className="flex items-center gap-2 text-primary-foreground/80">
          <CalendarClock className="h-5 w-5" />
          <span className="text-sm font-medium uppercase tracking-wide">Countdown to {APP_CONFIG.event}</span>
        </div>
        <div className="mt-2 flex items-end gap-3">
          <span className="text-5xl font-bold tabular-nums">{days}</span>
          <span className="mb-1 text-lg">days away</span>
        </div>
        <p className="mt-1 text-sm text-primary-foreground/70">
          {new Date(APP_CONFIG.weekendDate + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <WidgetCard icon={UserPlus} title="Champions Needing First Contact" accent="text-amber-500">
          <div className="text-3xl font-bold tabular-nums">—</div>
          <p className="mt-1 text-xs text-muted-foreground">New registrations awaiting outreach</p>
        </WidgetCard>

        <WidgetCard icon={Clock} title="Champions Awaiting Follow-Up" accent="text-blue-500">
          <div className="text-3xl font-bold tabular-nums">—</div>
          <p className="mt-1 text-xs text-muted-foreground">Pending next touchpoint</p>
        </WidgetCard>

        <WidgetCard icon={CheckCircle2} title="Recently Completed Contacts" accent="text-emerald-500">
          <div className="text-3xl font-bold tabular-nums">—</div>
          <p className="mt-1 text-xs text-muted-foreground">Contacts logged this week</p>
        </WidgetCard>

        <WidgetCard icon={Users} title="My Assigned Champions" accent="text-violet-500">
          <div className="text-3xl font-bold tabular-nums">—</div>
          <p className="mt-1 text-xs text-muted-foreground">In your care</p>
        </WidgetCard>

        <WidgetCard icon={Activity} title="Recent Activity" accent="text-rose-500">
          <div className="text-sm text-muted-foreground">Activity feed coming soon</div>
        </WidgetCard>

        <WidgetCard icon={CalendarClock} title="Weekend Progress" accent="text-cyan-500">
          <div className="text-sm text-muted-foreground">Progress tracking coming soon</div>
        </WidgetCard>
      </div>
    </div>
  );
}
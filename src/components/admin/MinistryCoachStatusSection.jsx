import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/utils';

export default function MinistryCoachStatusSection({ config, onUpdate }) {
  const [toggling, setToggling] = useState(false);
  const enabled = config.ai_enabled;

  const handleToggle = async (checked) => {
    setToggling(true);
    await onUpdate({ ai_enabled: checked });
    setToggling(false);
  };

  return (
    <section className={cn("rounded-xl border bg-card p-5 shadow-sm", !enabled && "border-muted")}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-full", enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Ministry Coach</h2>
            <p className="text-sm text-muted-foreground">Enable or disable all Ministry Coach functionality across Champion Connect.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge variant={enabled ? 'success' : 'neutral'}>{enabled ? 'Active' : 'Disabled'}</StatusBadge>
          <Switch checked={enabled} onCheckedChange={handleToggle} disabled={toggling} />
        </div>
      </div>
      <div className={cn("mt-4 rounded-lg border p-3", enabled ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950" : "border-muted bg-muted/30")}>
        <p className={cn("text-sm", enabled ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
          {enabled
            ? <>Ministry Coach is <strong>active</strong>. Individual capability settings below determine which features are available.</>
            : <>Ministry Coach is <strong>disabled</strong>. All capabilities remain silent. No AI requests are made. Ambient suggestions do not appear.</>
          }
        </p>
      </div>
    </section>
  );
}
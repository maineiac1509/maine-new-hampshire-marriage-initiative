import React, { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { MINISTRY_COACH_CAPABILITIES, isCapabilityEnabled } from '@/lib/ministryCoachConfig';
import { cn } from '@/lib/utils';

export default function CapabilityManagementSection({ config, onUpdate }) {
  const [toggling, setToggling] = useState(null);
  const globalEnabled = config.ai_enabled;

  const handleToggle = async (key, checked) => {
    setToggling(key);
    const newCaps = { ...config.capabilities, [key]: checked };
    await onUpdate({ capabilities: newCaps });
    setToggling(null);
  };

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Capability Management</h2>
          <p className="text-sm text-muted-foreground">Enable or disable individual Ministry Coach capabilities independently.</p>
        </div>
      </div>
      {!globalEnabled && (
        <div className="mt-4 rounded-lg border border-muted bg-muted/30 p-3">
          <p className="text-sm text-muted-foreground">The global Ministry Coach switch is OFF. Enable it above to manage individual capabilities.</p>
        </div>
      )}
      <div className="mt-4 space-y-3">
        {MINISTRY_COACH_CAPABILITIES.map((cap) => {
          const isEnabled = isCapabilityEnabled(config, cap.key);
          return (
            <div key={cap.key} className={cn("flex items-start justify-between gap-4 rounded-lg border p-4", !globalEnabled && "opacity-60")}>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{cap.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{cap.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge variant={isEnabled ? 'success' : 'neutral'}>{isEnabled ? 'Enabled' : 'Disabled'}</StatusBadge>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => handleToggle(cap.key, checked)}
                  disabled={!globalEnabled || toggling === cap.key}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
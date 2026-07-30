import React, { useState, useEffect } from 'react';
import { Lightbulb, X, MessageSquarePlus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { computeCommunicationOpportunities } from '@/lib/communicationContext';
import CommunicationCoachDialog from './CommunicationCoachDialog';

/**
 * Ambient Communication Suggestions
 *
 * Surfaces communication opportunities when ministry context indicates
 * reaching out would be valuable. Remains silent when no meaningful
 * opportunity exists.
 *
 * Contextual triggers (deterministic, not AI):
 * - First contact needed (assigned, no communication logged)
 * - Stale relationship (30+ days since last contact)
 * - Prayer follow-up (recent reflection has prayer requests)
 * - Follow-up actions (recent reflection has action items)
 * - Ministry anniversary (registration date anniversary month)
 *
 * The AI only enters when the user clicks "Draft a message."
 */
export default function CommunicationSuggestionCard({
  householdId,
  household,
  activities,
  assignments,
}) {
  const [opportunities, setOpportunities] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [dialogType, setDialogType] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!householdId) return;
    Promise.all([
      base44.entities.CommunicationLog.filter({ household_id: householdId }, '-date', 50).catch(() => []),
      base44.entities.Reflection.filter({ household_id: householdId }, '-reflection_date', 10).catch(() => []),
    ]).then(([logs, reflections]) => {
      const opps = computeCommunicationOpportunities({
        household,
        activities,
        reflections,
        communicationLogs: logs,
        assignments,
      });
      setOpportunities(opps);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  const visibleOpportunities = opportunities.filter((o) => !dismissed.has(o.title));

  if (loading || visibleOpportunities.length === 0) return null;

  const handleDraft = (opportunity) => {
    setDialogType(opportunity.communicationType);
    setDialogOpen(true);
  };

  const handleDismiss = (title) => {
    setDismissed((prev) => new Set([...prev, title]));
  };

  return (
    <>
      <div className="space-y-3">
        {visibleOpportunities.map((opp, i) => (
          <div
            key={i}
            className="rounded-lg border border-blue-200/50 bg-blue-50/40 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-md bg-blue-100 p-2">
                  <Lightbulb className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{opp.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{opp.description}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => handleDraft(opp)}
                  >
                    <MessageSquarePlus className="h-4 w-4" /> Draft a message
                  </Button>
                </div>
              </div>
              <button
                onClick={() => handleDismiss(opp.title)}
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <CommunicationCoachDialog
        householdId={householdId}
        initialType={dialogType}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
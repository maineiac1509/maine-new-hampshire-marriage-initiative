// ============================================================
// Ambient Suggestion Card — Unified Ministry Coach Surface
// ============================================================
// The single, unified Ministry Coach surface on the Champion Profile.
// Replaces individual capability cards (Communication Suggestions,
// Resource Intelligence) with one context-aware companion that
// surfaces only the most meaningful ministry guidance.
//
// Philosophy: The user should never feel like several AI systems.
// They simply experience helpful ministry guidance — one suggestion
// at a time, in natural, human language.
//
// Silence is the default. When no meaningful moment exists, or when
// the Ministry Coach Charter would not permit surfacing, this card
// renders nothing.
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart, UserPlus, Clock, FileText, BookOpen, TrendingUp, Sparkles,
  MessageSquare, X, BellOff, RefreshCw, Lightbulb,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { evaluateAmbientContext, hasSuggestionExpired } from '@/lib/ambientIntelligence';
import {
  loadAmbientState, saveAmbientState, dismissSuggestion,
  snoozeSuggestion, completeSuggestion, clearSuggestion,
} from '@/lib/ambientState';
import { loadAIConfig } from '@/lib/ministryCoachConfig';
import CommunicationCoachDialog from '@/components/communication/CommunicationCoachDialog';
import NewReflectionDialog from '@/components/reflections/NewReflectionDialog';
import ResourceIntelligenceCard from '@/components/resources/ResourceIntelligenceCard';

const MOMENT_ICONS = {
  prayer_followup: Heart,
  first_contact: UserPlus,
  relationship_drift: Clock,
  communication_followup: MessageSquare,
  reflection_opportunity: FileText,
  resource_opportunity: BookOpen,
  leadership_growth: TrendingUp,
  celebration_anniversary: Sparkles,
  celebration_milestone: Sparkles,
};

const PRIORITY_STYLES = {
  critical: 'border-red-200/60 bg-red-50/40',
  important: 'border-amber-200/60 bg-amber-50/40',
  helpful: 'border-blue-200/50 bg-blue-50/40',
  informational: 'border-emerald-200/50 bg-emerald-50/30',
};

const PRIORITY_ICON_STYLES = {
  critical: 'bg-red-100 text-red-600',
  important: 'bg-amber-100 text-amber-600',
  helpful: 'bg-blue-100 text-blue-600',
  informational: 'bg-emerald-100 text-emerald-600',
};

export default function AmbientSuggestionCard({ householdId, household, activities, assignments, milestones, currentUser }) {
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [showResourceCard, setShowResourceCard] = useState(false);
  const [dialogState, setDialogState] = useState({ type: null, open: false });
  const stateRef = useRef(null);

  const evaluate = useCallback(async () => {
    if (!householdId || !config) return;

    try {
      const [reflections, communicationLogs, resourceViews, resourceFavorites] = await Promise.all([
        base44.entities.Reflection.filter({ household_id: householdId }, '-reflection_date', 20).catch(() => []),
        base44.entities.CommunicationLog.filter({ household_id: householdId }, '-date', 50).catch(() => []),
        base44.entities.ResourceView.filter({}, '-viewed_date', 20).catch(() => []),
        base44.entities.ResourceFavorite.filter({}, '-created_date', 20).catch(() => []),
      ]);

      const context = { household, activities, reflections, communicationLogs, assignments, milestones, resourceViews, resourceFavorites };
      const state = loadAmbientState(householdId);
      stateRef.current = state;

      // Check if the cached suggestion has naturally expired
      if (state.cachedSuggestion && hasSuggestionExpired(state.cachedSuggestion, context)) {
        state.cachedSuggestion = null;
      }

      const result = evaluateAmbientContext({ context, state, config });

      const newSuggestion = result.suggestion ? { ...result.suggestion, surfacedAt: result.evaluatedAt } : null;
      const newState = {
        ...state,
        lastEvaluation: result.evaluatedAt,
        lastFingerprint: result.fingerprint,
        cachedSuggestion: newSuggestion,
      };
      saveAmbientState(householdId, newState);
      stateRef.current = newState;

      setSuggestion(newSuggestion);
      setShowResourceCard(false);
    } catch {
      setSuggestion(null);
    } finally {
      setLoading(false);
    }
  }, [householdId, household, activities, assignments, milestones, config]);

  useEffect(() => {
    loadAIConfig().then(({ config: c }) => setConfig(c));
  }, []);

  useEffect(() => {
    if (config) evaluate();
  }, [config, evaluate]);

  const handleDismiss = () => {
    if (!suggestion || !stateRef.current) return;
    const newState = dismissSuggestion(stateRef.current, suggestion.id, suggestion.priority);
    saveAmbientState(householdId, newState);
    stateRef.current = newState;
    setSuggestion(null);
  };

  const handleSnooze = () => {
    if (!suggestion || !stateRef.current) return;
    const newState = snoozeSuggestion(stateRef.current, suggestion.id);
    saveAmbientState(householdId, newState);
    stateRef.current = newState;
    setSuggestion(null);
  };

  const handleComplete = () => {
    if (!suggestion || !stateRef.current) return;
    const newState = completeSuggestion(stateRef.current, suggestion.id);
    saveAmbientState(householdId, newState);
    stateRef.current = newState;
    setSuggestion(null);
  };

  const handlePrimaryAction = () => {
    if (!suggestion) return;
    switch (suggestion.actionType) {
      case 'draft_message':
        setDialogState({ type: suggestion.actionParams.communicationType, open: true });
        break;
      case 'organize_notes':
        setDialogState({ type: '__reflection__', open: true });
        break;
      case 'view_resource':
        setShowResourceCard(true);
        break;
      case 'view_guides':
        // Navigate via Link in render — no action needed here
        break;
      default:
        break;
    }
  };

  const handleRefresh = () => {
    if (!stateRef.current) return;
    const newState = clearSuggestion(stateRef.current);
    saveAmbientState(householdId, newState);
    stateRef.current = newState;
    setLoading(true);
    evaluate();
  };

  // Silence gates — render nothing when AI should stay quiet
  if (loading || !suggestion) return null;

  const Icon = MOMENT_ICONS[suggestion.id] || Lightbulb;
  const priorityStyle = PRIORITY_STYLES[suggestion.priority] || PRIORITY_STYLES.helpful;
  const iconStyle = PRIORITY_ICON_STYLES[suggestion.priority] || PRIORITY_ICON_STYLES.helpful;
  const isGuidesLink = suggestion.actionType === 'view_guides';

  return (
    <>
      <div className={`rounded-lg border ${priorityStyle} p-4`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 rounded-md p-2 ${iconStyle}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{suggestion.message}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {isGuidesLink ? (
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/stewardship-guides">{suggestion.actionLabel}</Link>
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={handlePrimaryAction}>
                    {suggestion.actionLabel}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={handleSnooze} title="Remind me later">
                  <BellOff className="h-3.5 w-3.5" /> Snooze
                </Button>
                <Button size="sm" variant="ghost" onClick={handleDismiss} title="Dismiss this suggestion">
                  <X className="h-3.5 w-3.5" /> Dismiss
                </Button>
              </div>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="text-muted-foreground transition-colors hover:text-foreground"
            title="Re-evaluate"
            aria-label="Re-evaluate"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded resource recommendation when the active suggestion is a resource opportunity */}
      {showResourceCard && suggestion.actionType === 'view_resource' && (
        <ResourceIntelligenceCard
          householdId={householdId}
          household={household}
          activities={activities}
          assignments={assignments}
        />
      )}

      {/* Communication Coach dialog for draft_message actions */}
      {suggestion.actionType === 'draft_message' && (
        <CommunicationCoachDialog
          householdId={householdId}
          initialType={dialogState.type}
          open={dialogState.open}
          onOpenChange={(open) => {
            setDialogState((s) => ({ ...s, open }));
            if (!open) handleComplete();
          }}
        />
      )}

      {/* New Reflection dialog for organize_notes actions */}
      {suggestion.actionType === 'organize_notes' && (
        <NewReflectionDialog
          householdId={householdId}
          currentUser={currentUser}
          open={dialogState.open}
          onOpenChange={(open) => {
            setDialogState((s) => ({ ...s, open }));
            if (!open) handleComplete();
          }}
        />
      )}
    </>
  );
}
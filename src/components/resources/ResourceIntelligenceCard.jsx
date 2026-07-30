import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, RefreshCw, Clock, ArrowRight,
  Bookmark, BookmarkCheck, Share2, X, ChevronDown, ChevronUp,
  ShieldCheck, Lightbulb,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  RESOURCE_INTELLIGENCE_TASK,
  RESOURCE_INTELLIGENCE_SCHEMA,
  RESOURCE_INTELLIGENCE_CAPABILITY,
  buildAdditionalInstructions,
  shouldAttemptRecommendation,
  getCachedResult,
  setCachedResult,
  computeFingerprint,
} from '@/lib/resourceIntelligence';

const CONFIDENCE_VARIANT = { High: 'success', Medium: 'info', Low: 'warning' };

function fmtRelative(isoStr) {
  if (!isoStr) return '';
  const diff = Date.now() - new Date(isoStr).getTime();
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(isoStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function findResourceByTitle(resources, title) {
  if (!title) return null;
  const normalized = title.trim().toLowerCase();
  return resources.find((r) => r.title && r.title.trim().toLowerCase() === normalized) || null;
}

export default function ResourceIntelligenceCard({ householdId, household, activities, assignments }) {
  const [result, setResult] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [resources, setResources] = useState([]);
  const [staleData, setStaleData] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(`resi_dismissed_${householdId}`) === 'true';
    } catch {
      return false;
    }
  });
  const [savedResourceIds, setSavedResourceIds] = useState(new Set());

  const fingerprintRef = useRef('');
  const generatingRef = useRef(false);

  const generate = async (resList, excludedTitles) => {
    if (generatingRef.current || !householdId || !resList || resList.length === 0) return;
    generatingRef.current = true;
    try {
      const res = await base44.functions.invoke('aiRequest', {
        householdId,
        task: RESOURCE_INTELLIGENCE_TASK,
        capability: RESOURCE_INTELLIGENCE_CAPABILITY,
        outputSchema: RESOURCE_INTELLIGENCE_SCHEMA,
        additionalInstructions: buildAdditionalInstructions(resList, excludedTitles),
      });
      const data = res.data;
      if (!data.error) {
        setResult(data.result);
        const now = new Date().toISOString();
        setGeneratedAt(now);
        setStaleData(false);
        setCachedResult(householdId, data.result, now, fingerprintRef.current);
      }
    } catch {
      // AI unavailable — stay silent.
    } finally {
      generatingRef.current = false;
    }
  };

  useEffect(() => {
    if (!householdId) return;
    let cancelled = false;

    async function init() {
      const [reflections, communications, resList, resourceViews, resourceFavorites] = await Promise.all([
        base44.entities.Reflection.filter({ household_id: householdId }, '-reflection_date', 10).catch(() => []),
        base44.entities.CommunicationLog.filter({ household_id: householdId }, '-date', 20).catch(() => []),
        base44.entities.Resource.filter({ active: true, archived: false }, 'display_order', 50).catch(() => []),
        base44.entities.ResourceView.filter({}, '-viewed_date', 20).catch(() => []),
        base44.entities.ResourceFavorite.filter({}, '-created_date', 20).catch(() => []),
      ]);

      if (cancelled) return;

      setResources(resList || []);
      const savedIds = new Set((resourceFavorites || []).map((f) => f.resource_id).filter(Boolean));
      setSavedResourceIds(savedIds);

      fingerprintRef.current = computeFingerprint(household, activities, reflections, communications);

      // Deterministic pre-check: enough context to ask AI?
      if (!shouldAttemptRecommendation(reflections, activities, communications)) return;
      if (!resList || resList.length === 0) return;

      const excludedTitles = [
        ...(resourceViews || []).map((v) => v.resource_title),
        ...(resourceFavorites || []).map((f) => f.resource_title),
      ].filter(Boolean);

      // Check cache first.
      const cached = getCachedResult(householdId);
      if (cached) {
        setResult(cached.result);
        setGeneratedAt(cached.generatedAt);
        setStaleData(cached.fingerprint !== fingerprintRef.current);
        if (cached.fingerprint !== fingerprintRef.current) {
          generate(resList, excludedTitles);
        }
      } else {
        await generate(resList, excludedTitles);
      }
    }

    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(`resi_dismissed_${householdId}`, 'true');
    } catch {
      // sessionStorage unavailable.
    }
  };

  const handleSave = async (resource) => {
    if (savedResourceIds.has(resource.id)) return;
    try {
      await base44.entities.ResourceFavorite.create({
        resource_id: resource.id,
        resource_title: resource.title,
      });
      setSavedResourceIds((prev) => new Set([...prev, resource.id]));
    } catch {
      // RLS or duplicate — fail silently.
    }
  };

  const handleRefresh = async () => {
    const [reflections, communications, resList, resourceViews, resourceFavorites] = await Promise.all([
      base44.entities.Reflection.filter({ household_id: householdId }, '-reflection_date', 10).catch(() => []),
      base44.entities.CommunicationLog.filter({ household_id: householdId }, '-date', 20).catch(() => []),
      base44.entities.Resource.filter({ active: true, archived: false }, 'display_order', 50).catch(() => []),
      base44.entities.ResourceView.filter({}, '-viewed_date', 20).catch(() => []),
      base44.entities.ResourceFavorite.filter({}, '-created_date', 20).catch(() => []),
    ]);
    setResources(resList || []);
    const excludedTitles = [
      ...(resourceViews || []).map((v) => v.resource_title),
      ...(resourceFavorites || []).map((f) => f.resource_title),
    ].filter(Boolean);
    fingerprintRef.current = computeFingerprint(household, activities, reflections, communications);
    await generate(resList, excludedTitles);
  };

  // ============================================================
  // Silence Gates — render nothing when AI should stay quiet
  // ============================================================
  if (dismissed) return null;
  if (!result || !result.has_recommendation) return null;

  const primary = result.primary_recommendation;
  if (!primary || !primary.resource_title) return null;

  const primaryResource = findResourceByTitle(resources, primary.resource_title);
  // Guardrail: AI must recommend a real resource — never display hallucinated titles.
  if (!primaryResource) return null;

  const alternative = result.alternative_recommendation;
  const altResource = alternative ? findResourceByTitle(resources, alternative.resource_title) : null;
  const sequence = result.resource_sequence && result.resource_sequence.length > 1 ? result.resource_sequence : null;

  return (
    <ResourceRecommendationDisplay
      primary={primary}
      primaryResource={primaryResource}
      alternative={alternative}
      altResource={altResource}
      sequence={sequence}
      resources={resources}
      result={result}
      generatedAt={generatedAt}
      staleData={staleData}
      householdId={householdId}
      onRefresh={handleRefresh}
      onDismiss={handleDismiss}
      savedResourceIds={savedResourceIds}
      onSave={handleSave}
    />
  );
}

// ============================================================
// Display Component
// ============================================================
function ResourceRecommendationDisplay({
  primary,
  primaryResource,
  alternative,
  altResource,
  sequence,
  resources,
  result,
  generatedAt,
  staleData,
  householdId,
  onRefresh,
  onDismiss,
  savedResourceIds,
  onSave,
}) {
  const [collapsed, setCollapsed] = useState(false);

  const shareUrl = `/communication/compose?championId=${householdId}&body=${encodeURIComponent(
    `I came across this resource and thought it might be encouraging: "${primaryResource.title}". ${primaryResource.description || primaryResource.summary || ''}`
  )}`;

  return (
    <section className="rounded-xl border bg-card shadow-sm">
      {/* Header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between gap-2 p-5 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
              A Resource You May Want to Share
            </h2>
            <p className="text-xs text-muted-foreground">
              {staleData ? `Updated ${fmtRelative(generatedAt)} · ` : ''}
              {result.confidence && `Confidence: ${result.confidence}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onRefresh(); }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </span>
          {collapsed ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronUp className="h-5 w-5 text-muted-foreground" />}
        </div>
      </button>

      {/* Body */}
      {!collapsed && (
        <div className="border-t px-5 pb-5 pt-4">
          <div className="space-y-4">
            {/* Why this resource */}
            <div>
              <p className="text-sm text-foreground">{primary.why_this_resource}</p>
            </div>

            {/* Reasoning evidence */}
            {primary.reasoning_evidence && primary.reasoning_evidence.length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Lightbulb className="h-3.5 w-3.5" /> Why?
                </p>
                <ul className="mt-1.5 space-y-1">
                  {primary.reasoning_evidence.map((ev, i) => (
                    <li key={i} className="text-sm text-muted-foreground">• {ev}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Primary resource card */}
            <div className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{primaryResource.title}</p>
                  {primaryResource.subtitle && (
                    <p className="text-xs text-muted-foreground">{primaryResource.subtitle}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {primary.resource_category && (
                      <StatusBadge variant="info">{primary.resource_category}</StatusBadge>
                    )}
                    {primary.estimated_time && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {primary.estimated_time}
                      </span>
                    )}
                  </div>
                  {primary.appropriate_for && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Appropriate for: {primary.appropriate_for}
                    </p>
                  )}
                </div>
              </div>
              {/* Actions */}
              <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/resources/${primaryResource.id}`}>
                    <BookOpen className="h-3.5 w-3.5" /> View
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to={shareUrl}>
                    <Share2 className="h-3.5 w-3.5" /> Share
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSave(primaryResource)}
                  disabled={savedResourceIds.has(primaryResource.id)}
                >
                  {savedResourceIds.has(primaryResource.id) ? (
                    <><BookmarkCheck className="h-3.5 w-3.5 text-green-600" /> Saved</>
                  ) : (
                    <><Bookmark className="h-3.5 w-3.5" /> Save for Later</>
                  )}
                </Button>
                <Button size="sm" variant="ghost" onClick={onDismiss}>
                  <X className="h-3.5 w-3.5" /> Dismiss
                </Button>
              </div>
            </div>

            {/* Alternative recommendation */}
            {altResource && alternative && (
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Also Worth Considering
                </p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{altResource.title}</p>
                    {alternative.why_this_resource && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{alternative.why_this_resource}</p>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" asChild>
                    <Link to={`/resources/${altResource.id}`}>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            )}

            {/* Resource sequence */}
            {sequence && (
              <div className="rounded-lg border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Suggested Progression
                </p>
                <div className="mt-2 space-y-2">
                  {sequence.map((step, i) => {
                    const seqResource = findResourceByTitle(resources, step.resource_title);
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">{step.step}:</span>
                        {seqResource ? (
                          <Link to={`/resources/${seqResource.id}`} className="text-sm text-primary hover:underline">
                            {step.resource_title}
                          </Link>
                        ) : (
                          <span className="text-sm text-muted-foreground">{step.resource_title}</span>
                        )}
                        {i < sequence.length - 1 && <span className="text-muted-foreground">→</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Confidence + footer */}
            <div className="flex items-center justify-between border-t pt-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <StatusBadge variant={CONFIDENCE_VARIANT[result.confidence] || 'neutral'}>
                  {result.confidence}
                </StatusBadge>
              </div>
              {generatedAt && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> {fmtRelative(generatedAt)}
                </span>
              )}
            </div>
            {result.confidence_explanation && (
              <p className="-mt-2 text-xs text-muted-foreground">{result.confidence_explanation}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Sparkles, ChevronDown, ChevronUp, RefreshCw, AlertCircle,
  Clock, Lightbulb, Footprints, ShieldCheck, Heart, FileText, Loader2,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  RELATIONSHIP_INTELLIGENCE_TASK,
  RELATIONSHIP_INTELLIGENCE_SCHEMA,
  RELATIONSHIP_INTELLIGENCE_CAPABILITY,
  getCachedResult,
  setCachedResult,
  computeFingerprint,
} from '@/lib/relationshipIntelligence';

const HEALTH_VARIANT = {
  'Thriving': 'success',
  'Growing': 'info',
  'Stable': 'neutral',
  'Needs Attention': 'warning',
  'Limited Context': 'neutral',
};

const CONFIDENCE_VARIANT = {
  'High': 'success',
  'Medium': 'info',
  'Low': 'warning',
};

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

export default function RelationshipIntelligenceCard({ householdId, household, activities, assignments }) {
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [error, setError] = useState(null);
  const [errorCategory, setErrorCategory] = useState(null);
  const [staleData, setStaleData] = useState(false);

  // Ref to avoid stale closures and prevent duplicate concurrent calls.
  const fingerprintRef = useRef('');
  fingerprintRef.current = computeFingerprint(household, activities, assignments);
  const generatingRef = useRef(false);

  const generate = async () => {
    if (generatingRef.current || !householdId) return;
    generatingRef.current = true;
    setLoading(true);
    setError(null);
    setErrorCategory(null);
    try {
      const res = await base44.functions.invoke('aiRequest', {
        householdId,
        task: RELATIONSHIP_INTELLIGENCE_TASK,
        capability: RELATIONSHIP_INTELLIGENCE_CAPABILITY,
        outputSchema: RELATIONSHIP_INTELLIGENCE_SCHEMA,
      });
      const data = res.data;
      if (data.error) {
        setError(data.error);
        setErrorCategory(data.category);
      } else {
        setResult(data.result);
        const now = new Date().toISOString();
        setGeneratedAt(now);
        setStaleData(false);
        setCachedResult(householdId, data.result, now, fingerprintRef.current);
      }
    } catch (err) {
      const errData = err?.response?.data;
      setError(errData?.error || 'Relationship Intelligence is currently unavailable.');
      setErrorCategory(errData?.category || 'unknown');
    } finally {
      setLoading(false);
      generatingRef.current = false;
    }
  };

  // On mount or when householdId changes: load cache or auto-generate.
  useEffect(() => {
    if (!householdId) return;
    const cached = getCachedResult(householdId);
    if (cached) {
      setResult(cached.result);
      setGeneratedAt(cached.generatedAt);
      setStaleData(cached.fingerprint !== fingerprintRef.current);
      setError(null);
      setErrorCategory(null);
    } else {
      setResult(null);
      setGeneratedAt(null);
      setError(null);
      setErrorCategory(null);
      setStaleData(false);
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  const isFeatureDisabled = errorCategory === 'feature_disabled';
  const isEmptyContext = errorCategory === 'empty_context';
  const isLimitedContext = result && (
    result.limited_context === true || result.relationship_health === 'Limited Context'
  );

  const headerStatus = loading
    ? 'Generating insights…'
    : isFeatureDisabled
      ? 'AI is not currently enabled'
      : error && !isEmptyContext
        ? 'Currently unavailable'
        : result
          ? `Updated ${fmtRelative(generatedAt)}`
          : 'Loading…';

  return (
    <section className="rounded-xl border bg-card shadow-sm">
      {/* Header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between gap-2 p-5 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
              Relationship Intelligence
            </h2>
            <p className="text-xs text-muted-foreground">{headerStatus}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {result && !loading && !isFeatureDisabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); generate(); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); generate(); }
              }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </span>
          )}
          {collapsed
            ? <ChevronDown className="h-5 w-5 text-muted-foreground" />
            : <ChevronUp className="h-5 w-5 text-muted-foreground" />}
        </div>
      </button>

      {/* Body */}
      {!collapsed && (
        <div className="border-t px-5 pb-5 pt-4">
          {loading ? (
            <LoadingState />
          ) : isFeatureDisabled ? (
            <DisabledState />
          ) : isEmptyContext ? (
            <LimitedContextState result={null} />
          ) : error ? (
            <ErrorState message={error} onRetry={generate} />
          ) : isLimitedContext ? (
            <LimitedContextState result={result} />
          ) : result ? (
            <IntelligenceContent result={result} generatedAt={generatedAt} staleData={staleData} />
          ) : null}
        </div>
      )}
    </section>
  );
}

// ============================================================
// States
// ============================================================

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Analyzing ministry relationship…</p>
    </div>
  );
}

function DisabledState() {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium text-foreground">
          Relationship Intelligence is not currently enabled.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          An administrator can enable AI features in the Administration settings.
        </p>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">
          Relationship Intelligence is currently unavailable.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" /> Try Again
        </Button>
      </div>
    </div>
  );
}

function LimitedContextState({ result }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-4">
        <Heart className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
        <div>
          <p className="text-sm font-medium text-foreground">Getting to know this relationship</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Relationship Intelligence becomes more helpful as ministry interactions,
            reflections, communications, and prayer history are recorded.
          </p>
        </div>
      </div>
      {result?.ministry_snapshot && (
        <p className="text-sm text-foreground">{result.ministry_snapshot}</p>
      )}
      {result?.suggested_next_steps?.length > 0 && (
        <NextSteps steps={result.suggested_next_steps} />
      )}
    </div>
  );
}

// ============================================================
// Content Sections
// ============================================================

function IntelligenceContent({ result, generatedAt, staleData }) {
  return (
    <div className="space-y-5">
      {staleData && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <RefreshCw className="h-3.5 w-3.5 shrink-0" />
          Ministry data has changed since this was generated. Refresh for the latest insights.
        </div>
      )}

      {/* Ministry Snapshot */}
      <div>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Ministry Snapshot
        </h3>
        <p className="text-sm text-foreground">{result.ministry_snapshot}</p>
      </div>

      {/* Relationship Health */}
      <div>
        <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Heart className="h-3.5 w-3.5" /> Relationship Health
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge variant={HEALTH_VARIANT[result.relationship_health] || 'neutral'}>
            {result.relationship_health}
          </StatusBadge>
        </div>
        {result.health_explanation && (
          <p className="mt-1.5 text-sm text-muted-foreground">{result.health_explanation}</p>
        )}
      </div>

      {/* Key Insights */}
      {result.key_insights?.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Lightbulb className="h-3.5 w-3.5" /> Key Insights
          </h3>
          <ul className="space-y-2">
            {result.key_insights.map((item, i) => (
              <li key={i} className="rounded-lg border p-3">
                <p className="text-sm font-medium text-foreground">{item.insight}</p>
                {item.evidence && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-medium">Evidence:</span> {item.evidence}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggested Next Steps */}
      {result.suggested_next_steps?.length > 0 && (
        <NextSteps steps={result.suggested_next_steps} />
      )}

      {/* Supporting Evidence */}
      {result.supporting_evidence?.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <FileText className="h-3.5 w-3.5" /> Supporting Evidence
          </h3>
          <ul className="space-y-1">
            {result.supporting_evidence.map((ev, i) => (
              <li key={i} className="text-sm text-muted-foreground">• {ev}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Confidence + Last Generated */}
      <div className="flex items-center justify-between border-t pt-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Confidence
          </span>
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
  );
}

function NextSteps({ steps }) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Footprints className="h-3.5 w-3.5" /> Suggested Next Steps
      </h3>
      <ul className="space-y-2">
        {steps.map((step, i) => (
          <li key={i} className="rounded-lg border p-3">
            <p className="text-sm font-medium text-foreground">{step.suggestion}</p>
            {step.rationale && (
              <p className="mt-1 text-xs text-muted-foreground">{step.rationale}</p>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-xs italic text-muted-foreground">
        Suggestions are optional — use your own discernment.
      </p>
    </div>
  );
}
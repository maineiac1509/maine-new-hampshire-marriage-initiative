import React, { useState, useEffect } from 'react';
import {
  ChevronDown, ChevronUp, Calendar, Heart, ClipboardList,
  Activity, Users, BookOpen, Clock, FileText,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { StatusBadge } from '@/components/ui/StatusBadge';
import NewReflectionDialog from './NewReflectionDialog';

const CONFIDENCE_VARIANT = { High: 'success', Medium: 'info', Low: 'warning' };
const SENTIMENT_VARIANT = {
  Encouraging: 'success', Hopeful: 'success', Celebratory: 'success',
  Challenging: 'warning', Concerned: 'warning',
  Reflective: 'info', Neutral: 'neutral',
};

function fmtDate(s) {
  return s
    ? new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
}

export default function ReflectionsPanel({ householdId, currentUser }) {
  const [reflections, setReflections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  const load = () => {
    setLoading(true);
    base44.entities.Reflection.filter({ household_id: householdId }, '-reflection_date')
      .then((rows) => setReflections(rows || []))
      .catch(() => setReflections([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (householdId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  const toggleExpand = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <BookOpen className="h-4 w-4" />
          Reflections
        </div>
        <NewReflectionDialog householdId={householdId} currentUser={currentUser} onSaved={load} />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading reflections…</p>
      ) : reflections.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No reflections recorded yet. Capture meeting notes and let the Ministry Coach organize
          them into structured ministry knowledge.
        </p>
      ) : (
        <div className="space-y-3">
          {reflections.map((r) => (
            <ReflectionCard
              key={r.id}
              reflection={r}
              expanded={!!expanded[r.id]}
              onToggle={() => toggleExpand(r.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ReflectionCard({ reflection, expanded, onToggle }) {
  const r = reflection;
  return (
    <div className="rounded-lg border">
      <button
        className="flex w-full items-center justify-between gap-2 p-3 text-left"
        onClick={onToggle}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{fmtDate(r.reflection_date)}</span>
          {r.sentiment && (
            <StatusBadge variant={SENTIMENT_VARIANT[r.sentiment] || 'neutral'}>{r.sentiment}</StatusBadge>
          )}
          {r.confidence && (
            <StatusBadge variant={CONFIDENCE_VARIANT[r.confidence] || 'neutral'}>
              {r.confidence} confidence
            </StatusBadge>
          )}
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      {!expanded && r.summary && (
        <div className="border-t px-3 py-2">
          <p className="line-clamp-2 text-sm text-muted-foreground">{r.summary}</p>
        </div>
      )}

      {expanded && (
        <div className="space-y-3 border-t p-4">
          {r.summary && (
            <DetailBlock icon={FileText} label="Summary">
              <p className="text-sm text-foreground">{r.summary}</p>
            </DetailBlock>
          )}
          {r.timeline_entry && (
            <DetailBlock icon={Clock} label="Timeline Entry">
              <p className="text-sm text-foreground">{r.timeline_entry}</p>
            </DetailBlock>
          )}
          {r.prayer_requests?.length > 0 && (
            <DetailBlock icon={Heart} label="Prayer Requests">
              <ul className="space-y-1">
                {r.prayer_requests.map((p, i) => (
                  <li key={i} className="text-sm text-foreground">• {p.request}</li>
                ))}
              </ul>
            </DetailBlock>
          )}
          {r.action_items?.length > 0 && (
            <DetailBlock icon={ClipboardList} label="Action Items">
              <ul className="space-y-1">
                {r.action_items.map((a, i) => (
                  <li key={i} className="text-sm text-foreground">
                    • {a.item}{a.why ? ` — ${a.why}` : ''}
                  </li>
                ))}
              </ul>
            </DetailBlock>
          )}
          {r.relationship_signals?.length > 0 && (
            <DetailBlock icon={Activity} label="Relationship Signals">
              <ul className="space-y-1">
                {r.relationship_signals.map((s, i) => (
                  <li key={i} className="text-sm text-foreground">• {s.signal}</li>
                ))}
              </ul>
            </DetailBlock>
          )}
          {r.leadership_observations?.length > 0 && (
            <DetailBlock icon={Users} label="Leadership Observations">
              <ul className="space-y-1">
                {r.leadership_observations.map((o, i) => (
                  <li key={i} className="text-sm text-foreground">• {o.observation}</li>
                ))}
              </ul>
            </DetailBlock>
          )}
          {r.resource_recommendations?.length > 0 && (
            <DetailBlock icon={BookOpen} label="Resource Recommendations">
              <ul className="space-y-1">
                {r.resource_recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-foreground">
                    • {rec.resource}{rec.reason ? ` — ${rec.reason}` : ''}
                  </li>
                ))}
              </ul>
            </DetailBlock>
          )}
          {r.sentiment_explanation && (
            <DetailBlock icon={FileText} label="Sentiment Context">
              <p className="text-sm text-muted-foreground">{r.sentiment_explanation}</p>
            </DetailBlock>
          )}
          <DetailBlock icon={FileText} label="Original Notes">
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{r.original_notes}</p>
          </DetailBlock>
          {r.saved_by_name && (
            <p className="text-xs text-muted-foreground">Saved by {r.saved_by_name}</p>
          )}
        </div>
      )}
    </div>
  );
}

function DetailBlock({ icon: Icon, label, children }) {
  return (
    <div>
      <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </h4>
      {children}
    </div>
  );
}
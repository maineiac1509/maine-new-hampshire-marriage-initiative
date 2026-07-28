// React hook that drives the Ministry Intelligence Engine.
// On intelligence change (and page load) it:
//   1. Derives current Ministry Signals from existing intelligence (transparent rules).
//   2. Persists new Open signals.
//   3. Auto-resolves signals whose underlying condition has improved.
//   4. Exposes the active surface + Ministry Story + acknowledge/resolve actions.
import { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import {
  deriveSignals, syncSignals, buildSignalSurface, ministryStory,
} from '@/lib/ministrySignalEngine';

export function useMinistrySignals({ intel, recommendations, teams, households, assignments, enabled }) {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const sig = useMemo(() => {
    return `${intel?.generatedAt || 0}|${(recommendations || []).length}|${(households || []).length}|${(assignments || []).length}|${refreshKey}`;
  }, [intel, recommendations, households, assignments, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    async function go() {
      const derived = deriveSignals({ intel, recommendations, teams, assignments });
      let existing = [];
      try { existing = await base44.entities.MinistrySignal.list('-created_date', 200); } catch (e) {}
      const { toCreate, toResolve } = syncSignals({ derived, existing });
      try { if (toCreate.length) await base44.entities.MinistrySignal.bulkCreate(toCreate); } catch (e) {}
      try { if (toResolve.length) await base44.entities.MinistrySignal.bulkUpdate(toResolve); } catch (e) {}
      let fresh = [];
      try { fresh = await base44.entities.MinistrySignal.list('-created_date', 200); } catch (e) {}
      if (!cancelled) { setSignals(fresh); setLoading(false); }
    }
    if (enabled && intel) go(); else if (!enabled) setLoading(true);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, enabled]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const acknowledge = useCallback(async (id) => {
    try {
      await base44.entities.MinistrySignal.update(id, {
        status: 'Acknowledged',
        acknowledged_date: new Date().toISOString().slice(0, 10),
      });
    } catch (e) {}
    setRefreshKey((k) => k + 1);
  }, []);

  const resolve = useCallback(async (id, notes) => {
    try {
      await base44.entities.MinistrySignal.update(id, {
        status: 'Resolved',
        resolved_date: new Date().toISOString().slice(0, 10),
        resolution_notes: notes || '',
      });
    } catch (e) {}
    setRefreshKey((k) => k + 1);
  }, []);

  const updateNotes = useCallback(async (id, notes) => {
    try {
      await base44.entities.MinistrySignal.update(id, { resolution_notes: notes });
    } catch (e) {}
    setRefreshKey((k) => k + 1);
  }, []);

  const derived = useMemo(
    () => deriveSignals({ intel, recommendations, teams, assignments }),
    [intel, recommendations, teams, assignments]
  );
  const surface = useMemo(
    () => buildSignalSurface(signals, derived, teams, households),
    [signals, derived, teams, households]
  );
  const story = useMemo(() => ministryStory(surface, intel), [surface, intel]);

  const summary = useMemo(() => ({
    total: surface.length,
    critical: surface.filter((s) => s.severity === 'Critical').length,
    high: surface.filter((s) => s.severity === 'High').length,
    open: surface.filter((s) => s.status === 'Open').length,
    acknowledged: surface.filter((s) => s.status === 'Acknowledged').length,
    aged: surface.filter((s) => s.isAged).length,
  }), [surface]);

  return {
    activeSignals: surface,
    allSignals: signals,
    story,
    summary,
    loading,
    acknowledge,
    resolve,
    updateNotes,
    refresh,
  };
}
import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { computeMinistryIntelligence } from '@/lib/ministryIntelligence';
import { PageHeader } from '@/components/ui/PageHeader';
import DateRangeControl from '@/components/intelligence/DateRangeControl';
import MinistryHealthSection from '@/components/intelligence/MinistryHealthSection';
import StewardshipPerformanceSection from '@/components/intelligence/StewardshipPerformanceSection';
import VolunteerIntelligenceSection from '@/components/intelligence/VolunteerIntelligenceSection';
import MinistryGrowthSection from '@/components/intelligence/MinistryGrowthSection';
import EmergingRisksSection from '@/components/intelligence/EmergingRisksSection';
import MinistryOpportunitiesSection from '@/components/intelligence/MinistryOpportunitiesSection';
import MinistryStory from '@/components/intelligence/MinistryStory';
import ActiveMinistrySignalsSection from '@/components/intelligence/ActiveMinistrySignalsSection';
import { useMinistrySignals } from '@/hooks/useMinistrySignals';

// Ministry Intelligence Dashboard — executive command center built entirely
// from existing stewardship data. Every metric is drillable and every summary
// is calculated (never AI). The underlying calculations live in
// src/lib/ministryIntelligence.js and are reusable by Epic 7 (Ministry Coach).
export default function MinistryIntelligence() {
  const [data, setData] = useState({ households: [], assignments: [], teams: [], activities: [], recommendations: [], teamMembers: [] });
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState('90d');

  useEffect(() => {
    Promise.allSettled([
      base44.entities.ChampionHousehold.list(),
      base44.entities.Assignment.list(),
      base44.entities.VolunteerTeam.list(),
      base44.entities.ChampionActivity.list(),
      base44.entities.Recommendation.list(),
      base44.entities.TeamMember.list(),
    ]).then((res) => {
      const v = (i, f = []) => (res[i].status === 'fulfilled' ? res[i].value || f : f);
      setData({ households: v(0), assignments: v(1), teams: v(2), activities: v(3), recommendations: v(4), teamMembers: v(5) });
      setLoading(false);
    });
  }, []);

  const intel = useMemo(() => computeMinistryIntelligence({ ...data, preset }), [data, preset]);
  const signals = useMinistrySignals({
    intel, recommendations: data.recommendations, teams: data.teams,
    households: data.households, assignments: data.assignments, enabled: !loading,
  });

  if (loading) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Loading ministry intelligence…</div>;
  }

  return (
    <div className="space-y-10">
      <PageHeader
        title="Ministry Intelligence"
        subtitle="Executive command center for stewardship health, momentum, risks, and opportunities."
        actions={<DateRangeControl value={preset} onChange={setPreset} />}
      />
      <MinistryStory lines={signals.story} />
      <ActiveMinistrySignalsSection signals={signals.activeSignals} summary={signals.summary} loading={signals.loading} />
      <MinistryHealthSection data={intel.health} />
      <StewardshipPerformanceSection data={intel.performance} />
      <VolunteerIntelligenceSection data={intel.volunteer} />
      <MinistryGrowthSection data={intel.growth} />
      <EmergingRisksSection data={intel.risks} />
      <MinistryOpportunitiesSection data={intel.opportunities} />
    </div>
  );
}
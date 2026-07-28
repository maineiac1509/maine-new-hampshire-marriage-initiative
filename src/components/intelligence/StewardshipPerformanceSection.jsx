import React from 'react';
import { Gauge, Clock, CalendarClock, UserPlus, LogOut, ArrowLeftRight, CheckCircle2 } from 'lucide-react';
import Section from './Section';
import MetricCard from './MetricCard';

const ICONS = { cadence: Clock, length: CalendarClock, newAsg: UserPlus, ended: LogOut, transfers: ArrowLeftRight, resolution: CheckCircle2 };

export default function StewardshipPerformanceSection({ data }) {
  return (
    <Section index={2} title="Stewardship Performance" summary={data.summary} icon={Gauge}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.metrics.map((m) => (
          <MetricCard
            key={m.key}
            title={m.label}
            value={m.value}
            unit={m.unit}
            delta={m.delta}
            positiveIsGood={m.positiveIsGood}
            explanation={m.explanation}
            drillTarget={m.drillTarget}
            icon={ICONS[m.key]}
          />
        ))}
      </div>
    </Section>
  );
}
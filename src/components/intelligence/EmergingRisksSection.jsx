import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import Section from './Section';

// Risks are pre-sorted by severity (highest-risk first) in the intelligence layer.
export default function EmergingRisksSection({ data }) {
  return (
    <Section index={5} title="Emerging Risks" summary={data.summary} icon={AlertTriangle}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {data.items.map((item, i) => (
          <Link key={item.key} to={item.drillTarget} className="group flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{item.label}</span>
                <span className="text-xl font-bold text-foreground">{item.value}</span>
              </div>
              {item.sub && <p className="text-xs text-muted-foreground">{item.sub}</p>}
              <p className="mt-1 text-xs text-muted-foreground">{item.explanation}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        ))}
      </div>
    </Section>
  );
}
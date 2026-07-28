import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import Section from './Section';

export default function MinistryOpportunitiesSection({ data }) {
  return (
    <Section index={6} title="Ministry Opportunities" summary={data.summary} icon={Sparkles}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {data.items.map((item) => (
          <Link key={item.key} to={item.drillTarget} className="group flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Sparkles className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{item.label}</span>
                <span className="text-xl font-bold text-foreground">{item.value}{item.unit && item.unit !== '' ? ` ${item.unit}` : ''}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{item.explanation}</p>
              {item.regions && item.regions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.regions.map((r, i) => (
                    <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{r.region}</span>
                  ))}
                </div>
              )}
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        ))}
      </div>
    </Section>
  );
}
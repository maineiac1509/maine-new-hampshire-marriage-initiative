import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { situationLabel } from '@/lib/stewardshipGuideMatcher';

export default function GuideCard({ guide, reasons }) {
  return (
    <Link
      to={`/stewardship-guides/${guide.id}`}
      className="group flex flex-col rounded-lg border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <BookOpen className="h-4 w-4" />
          </div>
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {guide.category || 'General'}
          </span>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
      </div>
      <h3 className="mt-3 text-base font-semibold text-foreground">{guide.title}</h3>
      {guide.overview && (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{guide.overview}</p>
      )}
      {Array.isArray(guide.situations) && guide.situations.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {guide.situations.slice(0, 4).map((s) => (
            <span
              key={s}
              className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground"
            >
              {situationLabel(s)}
            </span>
          ))}
        </div>
      )}
      {reasons && reasons.length > 0 && (
        <p className="mt-3 border-t pt-2 text-xs italic text-muted-foreground">
          {reasons[0]}
        </p>
      )}
    </Link>
  );
}
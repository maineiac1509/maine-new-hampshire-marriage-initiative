import React from 'react';
import { Link } from 'react-router-dom';
import { Star, Send, Clock, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function TemplateCard({ template, isFavorite, onToggleFavorite, championId }) {
  const compose = championId
    ? `/communication/compose?templateId=${template.id}&championId=${championId}`
    : `/communication/compose?templateId=${template.id}`;

  return (
    <div className="flex flex-col rounded-lg border bg-card p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {template.category || 'General'}
        </span>
        <button
          type="button"
          onClick={onToggleFavorite}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          className={cn('transition', isFavorite ? 'text-amber-500' : 'text-muted-foreground hover:text-amber-500')}
        >
          <Star className={cn('h-4 w-4', isFavorite && 'fill-current')} />
        </button>
      </div>
      <h3 className="mt-2 text-base font-semibold text-foreground">{template.title}</h3>
      {template.description && (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{template.description}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {template.suggested_tone && (
          <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" />{template.suggested_tone}</span>
        )}
        {template.estimated_reading_time && (
          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{template.estimated_reading_time}</span>
        )}
      </div>
      {Array.isArray(template.tags) && template.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {template.tags.slice(0, 4).map((t, i) => (
            <span key={i} className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-accent-foreground">{t}</span>
          ))}
        </div>
      )}
      <div className="mt-auto pt-3">
        <Button asChild size="sm" className="w-full">
          <Link to={compose}><Send className="h-4 w-4" /> Compose</Link>
        </Button>
      </div>
    </div>
  );
}
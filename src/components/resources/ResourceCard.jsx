import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, BookOpen, Video, Headphones, BookMarked, Download,
  ClipboardList, MessagesSquare, Globe, Heart, Building2,
  GraduationCap, LayoutTemplate, File, Star,
} from 'lucide-react';
import { RESOURCE_TYPE_META } from '@/lib/resourceTypes';

const ICON_MAP = {
  FileText, BookOpen, Video, Headphones, BookMarked, Download,
  ClipboardList, MessagesSquare, Globe, Heart, Building2,
  GraduationCap, LayoutTemplate, File,
};

export default function ResourceCard({ resource, isFavorite }) {
  const meta = RESOURCE_TYPE_META[resource.resource_type] || RESOURCE_TYPE_META.Other;
  const Icon = ICON_MAP[meta.icon] || File;

  return (
    <Link
      to={`/resources/${resource.id}`}
      className="group flex h-full flex-col rounded-lg border bg-card p-4 transition hover:border-primary/30 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`flex h-9 w-9 items-center justify-center rounded-md bg-accent ${meta.color}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="flex items-center gap-1">
          {resource.featured && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
          {isFavorite && <Star className="h-3.5 w-3.5 fill-primary text-primary" />}
        </div>
      </div>
      <h3 className="mt-2 font-semibold leading-tight text-foreground group-hover:text-primary">{resource.title}</h3>
      {resource.subtitle && <p className="text-sm text-muted-foreground">{resource.subtitle}</p>}
      {resource.description && (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{resource.description}</p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
        <span className="text-[11px] font-medium text-muted-foreground">{resource.resource_type}</span>
        {resource.category && (
          <>
            <span className="text-[11px] text-muted-foreground">·</span>
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-accent-foreground">{resource.category}</span>
          </>
        )}
        {(resource.estimated_reading_time || resource.estimated_viewing_time) && (
          <span className="text-[11px] text-muted-foreground">
            · {resource.estimated_reading_time || resource.estimated_viewing_time}
          </span>
        )}
      </div>
    </Link>
  );
}
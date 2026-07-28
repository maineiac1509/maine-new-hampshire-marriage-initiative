import React, { useState, useEffect } from 'react';
import { BookMarked } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ResourceCard from './ResourceCard';

/**
 * Displays Resource entity records that are related to a
 * Stewardship Guide (by guide title) or Communication
 * Template (by template title) via the related_guides /
 * related_templates arrays on the Resource entity.
 */
export default function RelatedResourcesPanel({ guideTitle, templateTitle }) {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const title = guideTitle || templateTitle;
    if (!title) { setResources([]); setLoading(false); return; }
    setLoading(true);
    base44.entities.Resource.filter({ active: true, archived: false })
      .then((all) => {
        const matched = (all || []).filter((r) => {
          if (guideTitle && Array.isArray(r.related_guides) && r.related_guides.includes(guideTitle)) return true;
          if (templateTitle && Array.isArray(r.related_templates) && r.related_templates.includes(templateTitle)) return true;
          return false;
        });
        setResources(matched);
      })
      .catch(() => setResources([]))
      .finally(() => setLoading(false));
  }, [guideTitle, templateTitle]);

  if (loading || resources.length === 0) return null;

  return (
    <section className="rounded-lg border bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <BookMarked className="h-4 w-4 text-primary" />
        Related Resources
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {resources.map((r) => (
          <ResourceCard key={r.id} resource={r} />
        ))}
      </div>
    </section>
  );
}
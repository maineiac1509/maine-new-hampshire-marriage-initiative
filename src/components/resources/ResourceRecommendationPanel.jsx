import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Library, ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { recommendResources } from '@/lib/resourceMatcher';
import ResourceCard from './ResourceCard';

export default function ResourceRecommendationPanel({ champion, activities = [] }) {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Resource.filter({ active: true, archived: false })
      .then(setResources)
      .catch(() => setResources([]))
      .finally(() => setLoading(false));
  }, []);

  const recommendations = recommendResources(resources, { champion, activities });

  if (loading || recommendations.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Library className="h-5 w-5 text-primary" />
          Recommended Resources
        </h2>
        <Link to="/resources" className="flex items-center gap-1 text-sm text-primary hover:underline">
          Browse Library <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {recommendations.map(({ resource, reasons }) => (
          <div key={resource.id} className="space-y-0.5">
            <ResourceCard resource={resource} />
            {reasons.length > 0 && (
              <p className="px-1 text-[11px] text-muted-foreground">{reasons[0]}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
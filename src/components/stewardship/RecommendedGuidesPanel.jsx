import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, BookOpen, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { recommendGuidesForChampion, buildChampionContext } from '@/lib/stewardshipGuideMatcher';
import GuideCard from '@/components/stewardship/GuideCard';
import { cn } from '@/lib/utils';

// "Recommended Stewardship Guides" panel for the Champion profile.
// Deterministic situation matching today; designed for Epic 7 AI integration.
export default function RecommendedGuidesPanel({ champion, activities, hasActiveAssignment = false }) {
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.StewardshipGuide.filter({ archived: false })
      .then((gs) => setGuides(gs || []))
      .catch(() => setGuides([]))
      .finally(() => setLoading(false));
  }, []);

  const context = buildChampionContext(champion, activities, hasActiveAssignment);
  const recommendations = recommendGuidesForChampion(champion, guides, context);

  return (
    <div className={cn('rounded-lg border bg-card p-4 shadow-sm')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Recommended Stewardship Guides</h3>
        </div>
        <Link
          to="/stewardship-guides"
          className="text-xs font-medium text-primary hover:underline"
        >
          Browse all
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finding relevant guides…
        </div>
      ) : recommendations.length > 0 ? (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {recommendations.slice(0, 4).map(({ guide, reasons }) => (
            <GuideCard key={guide.id} guide={guide} reasons={reasons} />
          ))}
        </div>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-2 rounded-md border border-dashed py-6 text-center">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No situation-specific guides yet for this Champion.
          </p>
          <Link to="/stewardship-guides" className="text-xs font-medium text-primary hover:underline">
            Browse the Stewardship Guides library
          </Link>
        </div>
      )}

      <p className="mt-3 text-[11px] italic text-muted-foreground">
        Champion Connect offers thoughtful guidance — leaders prayerfully discern the right next step.
      </p>
    </div>
  );
}
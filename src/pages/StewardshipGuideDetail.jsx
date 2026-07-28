import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import GuideViewer from '@/components/stewardship/GuideViewer';
import { situationLabel } from '@/lib/stewardshipGuideMatcher';

export default function StewardshipGuideDetail() {
  const { id } = useParams();
  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    base44.entities.StewardshipGuide.get(id)
      .then((g) => { setGuide(g); setNotFound(!g); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading guide…
    </div>;
  }
  if (notFound || !guide) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/stewardship-guides"><ArrowLeft className="h-4 w-4" /> Back to Guides</Link>
        </Button>
        <p className="text-muted-foreground">Guide not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/stewardship-guides"><ArrowLeft className="h-4 w-4" /> Back to Guides</Link>
      </Button>

      <div className="space-y-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {guide.category || 'General'}
        </span>
        <h1 className="text-2xl font-bold tracking-tight">{guide.title}</h1>
        {Array.isArray(guide.situations) && guide.situations.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {guide.situations.map((s) => (
              <span key={s} className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                {situationLabel(s)}
              </span>
            ))}
          </div>
        )}
      </div>

      <GuideViewer guide={guide} />
    </div>
  );
}
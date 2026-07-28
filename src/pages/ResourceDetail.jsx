import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Star, ExternalLink, Download, Play, Loader2,
  Calendar, User, Building2, Globe, Clock, Tag, BookOpen, MessageSquare,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { RESOURCE_TYPE_META } from '@/lib/resourceTypes';
import ResourceCard from '@/components/resources/ResourceCard';

function MetaRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-1">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{label}:</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function BadgeList({ title, items }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {items.map((t, i) => (
          <span key={i} className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">{t}</span>
        ))}
      </div>
    </div>
  );
}

export default function ResourceDetail() {
  const { id } = useParams();
  const [resource, setResource] = useState(null);
  const [relatedGuides, setRelatedGuides] = useState([]);
  const [relatedTemplates, setRelatedTemplates] = useState([]);
  const [relatedResources, setRelatedResources] = useState([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteId, setFavoriteId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [togglingFav, setTogglingFav] = useState(false);
  const trackedRef = useRef(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      base44.entities.Resource.get(id),
      base44.entities.ResourceFavorite.filter({ resource_id: id }),
    ]).then(([res, favs]) => {
      setResource(res);
      const fav = (favs || [])[0];
      setIsFavorite(Boolean(fav));
      setFavoriteId(fav?.id || null);
    }).catch(() => setResource(null)).finally(() => setLoading(false));
  }, [id]);

  // Track view once
  useEffect(() => {
    if (trackedRef.current || !resource?.id) return;
    trackedRef.current = true;
    base44.entities.ResourceView.create({
      resource_id: resource.id,
      resource_title: resource.title,
      viewed_date: new Date().toISOString(),
    }).catch(() => {});
  }, [resource]);

  // Fetch related guides, templates, and resources
  useEffect(() => {
    if (!resource) return;
    const titles = resource.related_guides || [];
    const templateTitles = resource.related_templates || [];
    const resourceTitles = resource.related_resources || [];
    Promise.all([
      titles.length ? base44.entities.StewardshipGuide.filter({ archived: false }) : Promise.resolve([]),
      templateTitles.length ? base44.entities.CommunicationTemplate.filter({ archived: false }) : Promise.resolve([]),
      base44.entities.Resource.filter({ active: true, archived: false }),
    ]).then(([guides, templates, allRes]) => {
      setRelatedGuides((guides || []).filter((g) => titles.includes(g.title)));
      setRelatedTemplates((templates || []).filter((t) => templateTitles.includes(t.title)));
      setRelatedResources((allRes || []).filter((r) => resourceTitles.includes(r.title)));
    }).catch(() => {});
  }, [resource]);

  async function toggleFavorite() {
    setTogglingFav(true);
    try {
      if (isFavorite && favoriteId) {
        await base44.entities.ResourceFavorite.delete(favoriteId);
        setIsFavorite(false);
        setFavoriteId(null);
      } else {
        const fav = await base44.entities.ResourceFavorite.create({
          resource_id: id,
          resource_title: resource?.title || '',
        });
        setIsFavorite(true);
        setFavoriteId(fav.id);
      }
    } finally {
      setTogglingFav(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading resource…
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Resource not found.</p>
        <Button variant="outline" size="sm" className="mt-3" asChild>
          <Link to="/resources">Back to Library</Link>
        </Button>
      </div>
    );
  }

  const meta = RESOURCE_TYPE_META[resource.resource_type] || RESOURCE_TYPE_META.Other;

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/resources"><ArrowLeft className="h-4 w-4" /> Back to Library</Link>
      </Button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`rounded-full bg-accent px-2 py-0.5 text-xs font-medium ${meta.color}`}>{resource.resource_type}</span>
            {resource.category && <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">{resource.category}</span>}
            {resource.featured && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{resource.title}</h1>
          {resource.subtitle && <p className="text-lg text-muted-foreground">{resource.subtitle}</p>}
        </div>
        <Button variant={isFavorite ? 'default' : 'outline'} size="sm" onClick={toggleFavorite} disabled={togglingFav}>
          <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
          {isFavorite ? 'Favorited' : 'Favorite'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          {/* Summary */}
          {resource.summary && (
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm leading-relaxed text-foreground">{resource.summary}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {resource.content_url && (
              <Button asChild><a href={resource.content_url} target="_blank" rel="noopener noreferrer"><Play className="h-4 w-4" /> Launch Resource</a></Button>
            )}
            {resource.external_url && (
              <Button variant="outline" asChild><a href={resource.external_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Visit External Link</a></Button>
            )}
            {resource.download_url && (
              <Button variant="outline" asChild><a href={resource.download_url} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4" /> Download</a></Button>
            )}
          </div>

          {/* Related Guides */}
          {relatedGuides.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><BookOpen className="h-4 w-4 text-primary" /> Related Stewardship Guides</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {relatedGuides.map((g) => (
                  <Link key={g.id} to={`/stewardship-guides/${g.id}`} className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:border-primary/40">
                    <BookOpen className="h-3.5 w-3.5 text-primary" /> {g.title}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Related Templates */}
          {relatedTemplates.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><MessageSquare className="h-4 w-4 text-primary" /> Related Communication Templates</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {relatedTemplates.map((t) => (
                  <Link key={t.id} to={`/communication/compose?templateId=${t.id}`} className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:border-primary/40">
                    <MessageSquare className="h-3.5 w-3.5 text-primary" /> {t.title}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Related Resources */}
          {relatedResources.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Related Resources</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {relatedResources.map((r) => <ResourceCard key={r.id} resource={r} />)}
              </div>
            </div>
          )}
        </div>

        {/* Metadata sidebar */}
        <aside className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Details</p>
            <div className="mt-2 divide-y">
              <MetaRow icon={User} label="Author" value={resource.author} />
              <MetaRow icon={Building2} label="Organization" value={resource.organization} />
              <MetaRow icon={Building2} label="Publisher" value={resource.publisher} />
              <MetaRow icon={Calendar} label="Published" value={resource.publication_date} />
              <MetaRow icon={Globe} label="Language" value={resource.language} />
              <MetaRow icon={Clock} label="Reading Time" value={resource.estimated_reading_time} />
              <MetaRow icon={Clock} label="Viewing Time" value={resource.estimated_viewing_time} />
              <MetaRow icon={Tag} label="Type" value={resource.internal_external} />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border bg-card p-4">
            <BadgeList title="Topics" items={resource.topics} />
            <BadgeList title="Tags" items={resource.tags} />
            <BadgeList title="Life Stages" items={resource.life_stages} />
            <BadgeList title="Ministry Situations" items={resource.ministry_situations} />
            <BadgeList title="Scripture Topics" items={resource.scripture_topics} />
          </div>
        </aside>
      </div>
    </div>
  );
}
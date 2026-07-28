import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Search, Star, Settings, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import TemplateCard from '@/components/communication/TemplateCard';

export default function CommunicationCenter() {
  const [templates, setTemplates] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [favOnly, setFavOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
    loadTemplates();
    loadFavorites();
  }, []);

  const loadTemplates = () => {
    setLoading(true);
    base44.entities.CommunicationTemplate.filter({ archived: false }, 'display_order')
      .then((ts) => setTemplates(ts || []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  };
  const loadFavorites = () => {
    base44.entities.FavoriteTemplate.list().then(setFavorites).catch(() => setFavorites([]));
  };

  const favIds = new Set(favorites.map((f) => f.template_id));
  const toggleFav = (templateId) => {
    const existing = favorites.find((f) => f.template_id === templateId);
    if (existing) {
      base44.entities.FavoriteTemplate.delete(existing.id).then(() => setFavorites((f) => f.filter((x) => x.id !== existing.id)));
    } else {
      base44.entities.FavoriteTemplate.create({ template_id: templateId }).then((nf) => setFavorites((cur) => [...cur, nf]));
    }
  };

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(templates.map((t) => t.category).filter(Boolean)))],
    [templates]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = templates.filter((t) => {
      if (t.enabled === false) return false;
      if (favOnly && !favIds.has(t.id)) return false;
      if (category !== 'All' && t.category !== category) return false;
      if (!q) return true;
      const hay = [
        t.title, t.description, t.category,
        ...(t.tags || []), ...(t.recommended_situations || []),
        t.suggested_tone, t.body,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
    return list.sort((a, b) => (favIds.has(b.id) ? 1 : 0) - (favIds.has(a.id) ? 1 : 0) || (a.display_order || 999) - (b.display_order || 999));
  }, [templates, query, category, favOnly, favIds]);

  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Communication Center</h1>
          <p className="text-sm text-muted-foreground">
            Thoughtful, personal ministry communication. Templates support you—they never replace you.
          </p>
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" asChild>
            <Link to="/communication/admin"><Settings className="h-4 w-4" /> Manage</Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search templates, tags, situations…" className="pl-9" />
        </div>
        <button
          onClick={() => setFavOnly((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
            favOnly ? 'bg-amber-100 text-amber-700' : 'bg-accent text-accent-foreground hover:bg-accent/80'
          }`}
        >
          <Star className={`h-3.5 w-3.5 ${favOnly ? 'fill-current' : ''}`} /> Favorites
        </button>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                category === c ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground hover:bg-accent/80'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading templates…
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              isFavorite={favIds.has(t.id)}
              onToggleFavorite={() => toggleFav(t.id)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <Send className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No templates found</p>
          <p className="text-xs text-muted-foreground">Try adjusting your search or filters.</p>
        </div>
      )}

      <p className="text-center text-xs italic text-muted-foreground">
        Champion Connect prepares communication. You decide what to use. Nothing sends automatically.
      </p>
    </div>
  );
}
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Star, Clock, X, Settings, Loader2, Library } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RESOURCE_TYPES } from '@/lib/resourceTypes';
import ResourceCard from '@/components/resources/ResourceCard';

export default function ResourceLibrary() {
  const [user, setUser] = useState(null);
  const [resources, setResources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [favorites, setFavorites] = useState(new Set());
  const [recentViewIds, setRecentViewIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    category: '', type: '', lifeStage: '', situation: '', featuredOnly: false, favoritesOnly: false,
  });

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
    Promise.all([
      base44.entities.Resource.list('display_order'),
      base44.entities.ResourceCategory.filter({ archived: false }, 'display_order'),
      base44.entities.ResourceFavorite.filter({}).catch(() => []),
      base44.entities.ResourceView.filter({}, '-viewed_date', 10).catch(() => []),
    ]).then(([res, cats, favs, views]) => {
      setResources(res || []);
      setCategories(cats || []);
      setFavorites(new Set((favs || []).map((f) => f.resource_id)));
      setRecentViewIds((views || []).map((v) => v.resource_id));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const allLifeStages = useMemo(() => {
    const s = new Set();
    resources.forEach((r) => (r.life_stages || []).forEach((ls) => s.add(ls)));
    return [...s].sort();
  }, [resources]);

  const allSituations = useMemo(() => {
    const s = new Set();
    resources.forEach((r) => (r.ministry_situations || []).forEach((ms) => s.add(ms)));
    return [...s].sort();
  }, [resources]);

  const filtered = useMemo(() => {
    return resources
      .filter((r) => r.active !== false && !r.archived)
      .filter((r) => {
        if (search) {
          const q = search.toLowerCase();
          const hay = [r.title, r.subtitle, r.description, r.summary, r.author, r.organization, r.publisher, ...(r.topics || []), ...(r.tags || [])].join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (filters.category && r.category !== filters.category) return false;
        if (filters.type && r.resource_type !== filters.type) return false;
        if (filters.lifeStage && !(r.life_stages || []).includes(filters.lifeStage)) return false;
        if (filters.situation && !(r.ministry_situations || []).includes(filters.situation)) return false;
        if (filters.featuredOnly && !r.featured) return false;
        if (filters.favoritesOnly && !favorites.has(r.id)) return false;
        return true;
      });
  }, [resources, search, filters, favorites]);

  const featured = useMemo(() => resources.filter((r) => r.featured && r.active !== false && !r.archived).slice(0, 4), [resources]);

  const recentResources = useMemo(() => {
    const seen = new Set();
    return recentViewIds
      .map((id) => resources.find((r) => r.id === id))
      .filter((r) => r && !seen.has(r.id) && seen.add(r.id))
      .slice(0, 4);
  }, [recentViewIds, resources]);

  const hasFilters = filters.category || filters.type || filters.lifeStage || filters.situation || filters.featuredOnly || filters.favoritesOnly;
  const isAdmin = user?.role === 'admin';
  const showingFiltered = Boolean(search) || hasFilters;

  function clearFilters() {
    setFilters({ category: '', type: '', lifeStage: '', situation: '', featuredOnly: false, favoritesOnly: false });
    setSearch('');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading library…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Library className="h-6 w-6 text-primary" /> Resource Library
          </h1>
          <p className="text-sm text-muted-foreground">Curated ministry resources to support Champion care.</p>
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" asChild>
            <Link to="/resources/admin"><Settings className="h-4 w-4" /> Admin</Link>
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, author, topic, tag…"
          className="pl-9"
        />
      </div>

      {/* Featured — only when not filtering */}
      {!showingFiltered && featured.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> Featured
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((r) => <ResourceCard key={r.id} resource={r} isFavorite={favorites.has(r.id)} />)}
          </div>
        </section>
      )}

      {/* Continue Learning — only when not filtering */}
      {!showingFiltered && recentResources.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Clock className="h-4 w-4" /> Continue Learning
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recentResources.map((r) => <ResourceCard key={r.id} resource={r} isFavorite={favorites.has(r.id)} />)}
          </div>
        </section>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3">
        <div className="space-y-1">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Category</label>
          <Select value={filters.category} onValueChange={(v) => setFilters((f) => ({ ...f, category: v === '__all' ? '' : v }))}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Type</label>
          <Select value={filters.type} onValueChange={(v) => setFilters((f) => ({ ...f, type: v === '__all' ? '' : v }))}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All</SelectItem>
              {RESOURCE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Life Stage</label>
          <Select value={filters.lifeStage} onValueChange={(v) => setFilters((f) => ({ ...f, lifeStage: v === '__all' ? '' : v }))}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All</SelectItem>
              {allLifeStages.map((ls) => <SelectItem key={ls} value={ls}>{ls}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Situation</label>
          <Select value={filters.situation} onValueChange={(v) => setFilters((f) => ({ ...f, situation: v === '__all' ? '' : v }))}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All</SelectItem>
              {allSituations.map((ms) => <SelectItem key={ms} value={ms}>{ms}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm">
          <input type="checkbox" checked={filters.featuredOnly} onChange={(e) => setFilters((f) => ({ ...f, featuredOnly: e.target.checked }))} className="h-4 w-4 rounded border-input accent-primary" />
          Featured
        </label>
        <label className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm">
          <input type="checkbox" checked={filters.favoritesOnly} onChange={(e) => setFilters((f) => ({ ...f, favoritesOnly: e.target.checked }))} className="h-4 w-4 rounded border-input accent-primary" />
          Favorites
        </label>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}><X className="h-4 w-4" /> Clear</Button>
        )}
      </div>

      {/* Results */}
      <div>
        <p className="mb-2 text-sm text-muted-foreground">
          {filtered.length} resource{filtered.length !== 1 ? 's' : ''}
        </p>
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            No resources match your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => <ResourceCard key={r.id} resource={r} isFavorite={favorites.has(r.id)} />)}
          </div>
        )}
      </div>
    </div>
  );
}
import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Search, Loader2, Settings } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GUIDE_CATEGORIES } from '@/lib/stewardshipGuideMatcher';
import GuideCard from '@/components/stewardship/GuideCard';

export default function StewardshipGuides() {
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.entities.StewardshipGuide.filter({ archived: false }, 'display_order')
      .then((gs) => setGuides(gs || []))
      .catch(() => setGuides([]))
      .finally(() => setLoading(false));
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const filtered = useMemo(() => {
    return guides.filter((g) => {
      if (g.enabled === false) return false;
      if (category !== 'All' && g.category !== category) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        return (
          g.title?.toLowerCase().includes(q) ||
          g.overview?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [guides, query, category]);

  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stewardship Guides</h1>
          <p className="text-sm text-muted-foreground">
            Thoughtful guidance for faithful ministry — suggestions, not scripts.
          </p>
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" asChild>
            <Link to="/stewardship-guides/admin"><Settings className="h-4 w-4" /> Manage Guides</Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search guides…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['All', ...GUIDE_CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                category === c
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-accent text-accent-foreground hover:bg-accent/80'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading guides…
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((g) => (
            <GuideCard key={g.id} guide={g} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <BookOpen className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No guides found</p>
          <p className="text-xs text-muted-foreground">
            {query || category !== 'All'
              ? 'Try adjusting your search or filters.'
              : 'Guides will appear here once they are created.'}
          </p>
        </div>
      )}

      <p className="text-center text-xs italic text-muted-foreground">
        Champion Connect equips ministry leaders. It does not replace prayer, wisdom, or personal relationships.
      </p>
    </div>
  );
}
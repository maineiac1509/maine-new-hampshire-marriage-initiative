import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Send, Mail, Phone, Coffee, HeartHandshake, Star, MessageSquare,
  Clock, Loader2, History, ChevronRight,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { detectChampionSituations, buildChampionContext } from '@/lib/stewardshipGuideMatcher';

const QUICK_ACTIONS = [
  { label: 'Text', icon: MessageSquare, type: 'Text Message' },
  { label: 'Email', icon: Mail, type: 'Email' },
  { label: 'Phone Notes', icon: Phone, type: 'Phone Call' },
  { label: 'Prayer', icon: HeartHandshake, type: 'Prayer' },
  { label: 'Coffee', icon: Coffee, type: 'Coffee Invitation' },
];

function fmtDate(s) {
  return s ? new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
}

export default function CommunicationPanel({ champion, activities, currentUser }) {
  const [templates, setTemplates] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [logs, setLogs] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.CommunicationTemplate.filter({ archived: false }, 'display_order')
      .then((ts) => setTemplates(ts || []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
    base44.entities.FavoriteTemplate.list().then(setFavorites).catch(() => setFavorites([]));
    if (champion?.id) {
      base44.entities.CommunicationLog.filter({ household_id: champion.id }, '-date')
        .then(setLogs).catch(() => setLogs([]));
    }
  }, [champion?.id]);

  const favIds = new Set(favorites.map((f) => f.template_id));
  const toggleFav = (templateId) => {
    const existing = favorites.find((f) => f.template_id === templateId);
    if (existing) base44.entities.FavoriteTemplate.delete(existing.id).then(() => setFavorites((f) => f.filter((x) => x.id !== existing.id)));
    else base44.entities.FavoriteTemplate.create({ template_id: templateId }).then((f) => setFavorites((cur) => [...cur, f]));
  };

  // Suggested templates: match recommended_situations against champion situations
  const ctx = buildChampionContext(champion, activities);
  const situations = detectChampionSituations(champion, ctx).map((s) => s.situation);
  const suggested = templates
    .filter((t) => t.enabled !== false && Array.isArray(t.recommended_situations) && t.recommended_situations.some((s) => situations.includes(s)))
    .slice(0, 4);
  const suggestedFallback = templates.filter((t) => t.enabled !== false).slice(0, 4);
  const suggestedList = suggested.length ? suggested : suggestedFallback;

  const favoriteTemplates = templates.filter((t) => favIds.has(t.id)).slice(0, 4);
  const recentTemplateIds = [...new Set(logs.map((l) => l.template_id).filter(Boolean))].slice(0, 4);
  const recentTemplates = recentTemplateIds.map((id) => templates.find((t) => t.id === id)).filter(Boolean);

  const compose = (templateId) => `/communication/compose?templateId=${templateId}&championId=${champion?.id || ''}`;
  const composeType = (type) => `/communication/compose?championId=${champion?.id || ''}&type=${encodeURIComponent(type)}`;

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Communication Center</h3>
        </div>
        <Link to="/communication" className="text-xs font-medium text-primary hover:underline">Browse all</Link>
      </div>

      {/* Quick Launch */}
      <div className="mt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quick Launch</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Button key={a.label} asChild variant="outline" size="sm">
                <Link to={composeType(a.type)}><Icon className="h-4 w-4" /> {a.label}</Link>
              </Button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {/* Suggested Templates */}
          <TemplateMiniList title="Suggested Templates" templates={suggestedList} favIds={favIds} onToggleFav={toggleFav} compose={compose} />

          {/* Favorite Templates */}
          {favoriteTemplates.length > 0 && (
            <TemplateMiniList title="Favorite Templates" templates={favoriteTemplates} favIds={favIds} onToggleFav={toggleFav} compose={compose} />
          )}

          {/* Recently Used */}
          {recentTemplates.length > 0 && (
            <TemplateMiniList title="Recently Used" templates={recentTemplates} favIds={favIds} onToggleFav={toggleFav} compose={compose} />
          )}

          {/* Communication History */}
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <History className="h-3.5 w-3.5" /> Communication History
            </p>
            {logs.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {logs.slice(0, 6).map((l) => (
                  <li key={l.id} className="rounded-md border bg-background p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{l.communication_type}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{fmtDate(l.date)}</span>
                    </div>
                    {l.template_title && <p className="text-xs text-muted-foreground">Template: {l.template_title}</p>}
                    {l.subject && <p className="text-xs text-foreground">{l.subject}</p>}
                    {l.notes && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{l.notes}</p>}
                    {l.follow_up_date && (
                      <p className="mt-1 text-xs font-medium text-amber-600">Follow-up: {fmtDate(l.follow_up_date)}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">No communications logged yet.</p>
            )}
          </div>
        </div>
      )}

      <p className="mt-3 text-[11px] italic text-muted-foreground">
        Templates reduce anxiety—they never replace authenticity. Make each message your own.
      </p>
    </div>
  );
}

function TemplateMiniList({ title, templates, favIds, onToggleFav, compose }) {
  if (!templates.length) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {templates.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-2 rounded-md border bg-background p-2.5">
            <Link to={compose(t.id)} className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground hover:text-primary">{t.title}</p>
              {t.suggested_tone && <p className="text-xs text-muted-foreground">{t.suggested_tone}</p>}
            </Link>
            <div className="flex items-center gap-1">
              <button onClick={() => onToggleFav(t.id)} className={cn('p-1', favIds.has(t.id) ? 'text-amber-500' : 'text-muted-foreground hover:text-amber-500')}>
                <Star className={cn('h-3.5 w-3.5', favIds.has(t.id) && 'fill-current')} />
              </button>
              <Link to={compose(t.id)} className="p-1 text-muted-foreground hover:text-primary">
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
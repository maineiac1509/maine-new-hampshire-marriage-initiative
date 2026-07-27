import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Plus, Search, ChevronDown, ChevronRight, Pencil, Trash2, Loader2, MessageSquare,
  Phone, PhoneMissed, Mail, Users, Calendar, Heart, ClipboardList, Circle,
  GitCommitHorizontal,
} from 'lucide-react';
import {
  ACTIVITY_TYPE_OPTIONS, CONTACT_OUTCOME_OPTIONS,
  ACTIVITY_TYPE_VARIANTS, OUTCOME_VARIANTS,
} from '@/lib/config';
import LogInteractionDialog from './LogInteractionDialog';
import RelationshipStatusBadge from './RelationshipStatusBadge';

// Leading icon per Activity Type — supports recognition in the timeline feed.
const ACTIVITY_ICONS = {
  'Phone Call': Phone,
  'Voicemail': PhoneMissed,
  'Text Message': MessageSquare,
  'Email': Mail,
  'In Person': Users,
  'Meeting': Calendar,
  'Prayer': Heart,
  'Administrative Update': ClipboardList,
  'Other': Circle,
};

function fmt(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function RelationshipTimeline({
  householdId,
  activities,
  statusChanges,
  currentStatus,
  canChangeStatus,
  onRefresh,
  onStatusChanged,
  currentUser,
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [expanded, setExpanded] = useState({});
  const [deletingId, setDeletingId] = useState(null);

  const role = currentUser?.role;
  const canDelete = role === 'admin' || role === 'director';
  const canEdit = (a) => role === 'admin' || role === 'director' || a.created_by_id === currentUser?.id;

  // Merge activities and status changes into one reverse-chronological timeline.
  const merged = useMemo(() => {
    const acts = (activities || []).map((a) => ({
      ...a,
      _kind: 'activity',
      _date: a.activity_date || a.created_date,
    }));
    const changes = (statusChanges || []).map((c) => ({
      ...c,
      _kind: 'status',
      _date: c.change_date || c.created_date,
    }));
    return [...acts, ...changes].sort(
      (a, b) => new Date(b._date || 0) - new Date(a._date || 0)
    );
  }, [activities, statusChanges]);

  const filtered = useMemo(() => {
    let r = [...merged];
    if (keyword.trim()) {
      const q = keyword.toLowerCase();
      r = r.filter((item) => {
        if (item._kind === 'status') {
          return [item.previous_status, item.new_status]
            .filter(Boolean)
            .some((v) => v.toLowerCase().includes(q));
        }
        return [item.summary, item.detailed_notes, item.activity_type, item.outcome]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(q));
      });
    }
    if (typeFilter !== 'all') r = r.filter((item) => item._kind === 'activity' && item.activity_type === typeFilter);
    if (outcomeFilter !== 'all') r = r.filter((item) => item._kind === 'activity' && item.outcome === outcomeFilter);
    if (fromDate) r = r.filter((item) => item._date && item._date >= fromDate);
    if (toDate) r = r.filter((item) => item._date && item._date <= toDate);
    return r;
  }, [merged, keyword, typeFilter, outcomeFilter, fromDate, toDate]);

  async function handleDelete(a) {
    if (!window.confirm('Delete this activity? This cannot be undone.')) return;
    setDeletingId(a.id);
    try {
      await base44.entities.ChampionActivity.delete(a.id);
      onRefresh?.();
    } finally {
      setDeletingId(null);
    }
  }

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(a) {
    setEditing(a);
    setDialogOpen(true);
  }

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <MessageSquare className="h-4 w-4" /> Relationship Timeline
        </div>
        <Button size="sm" onClick={openNew} className="h-9">
          <Plus className="h-4 w-4" /> Log Activity
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Keyword…" value={keyword} onChange={(e) => setKeyword(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {ACTIVITY_TYPE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
          <SelectTrigger><SelectValue placeholder="Outcome" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All outcomes</SelectItem>
            {CONTACT_OUTCOME_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} aria-label="From date" />
        <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label="To date" />
      </div>

      {/* Timeline feed */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No activities yet"
          description="Log an activity to start building this Champion's story."
          actionLabel="Log Activity"
          onAction={openNew}
        />
      ) : (
        <ol className="space-y-3">
          {filtered.map((item) => {
            if (item._kind === 'status') {
              return (
                <li
                  key={`status-${item.id}`}
                  className="flex gap-3 rounded-lg border border-dashed bg-muted/30 p-4"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                    <GitCommitHorizontal className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{fmt(item.change_date) || '—'}</span>
                      <StatusBadge variant="neutral">Status Change</StatusBadge>
                      <RelationshipStatusBadge status={item.previous_status} />
                      <span className="text-muted-foreground">→</span>
                      <RelationshipStatusBadge status={item.new_status} />
                      <span className="ml-auto text-xs text-muted-foreground">
                        Updated by {item.created_by || 'Unknown'}
                      </span>
                    </div>
                  </div>
                </li>
              );
            }
            const a = item;
            const open = !!expanded[a.id];
            const hasFollowUp = a.follow_up_required && a.follow_up_date;
            const Icon = ACTIVITY_ICONS[a.activity_type] || Circle;
            return (
              <li key={a.id} className="flex gap-3 rounded-lg border bg-background p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{fmt(a.activity_date) || '—'}</span>
                    <StatusBadge variant={ACTIVITY_TYPE_VARIANTS[a.activity_type] || 'neutral'}>
                      {a.activity_type}
                    </StatusBadge>
                    {a.outcome && (
                      <StatusBadge variant={OUTCOME_VARIANTS[a.outcome] || 'neutral'}>
                        {a.outcome}
                      </StatusBadge>
                    )}
                    {hasFollowUp && (
                      <StatusBadge variant="warning">
                        Follow-up: {fmt(a.follow_up_date)}
                      </StatusBadge>
                    )}
                    <div className="ml-auto flex items-center gap-1">
                      {canEdit(a) && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)} aria-label="Edit activity">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(a)}
                          disabled={deletingId === a.id}
                          aria-label="Delete activity"
                        >
                          {deletingId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground">{a.summary}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Logged by {a.created_by || 'Unknown'}</p>
                  {a.detailed_notes && (
                    <button
                      onClick={() => setExpanded((e) => ({ ...e, [a.id]: !open }))}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      Detailed notes
                    </button>
                  )}
                  {open && a.detailed_notes && (
                    <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm text-foreground">
                      {a.detailed_notes}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <LogInteractionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        householdId={householdId}
        activity={editing}
        onSaved={onRefresh}
        onStatusChanged={onStatusChanged}
        currentStatus={currentStatus}
        canChangeStatus={canChangeStatus}
      />
    </section>
  );
}
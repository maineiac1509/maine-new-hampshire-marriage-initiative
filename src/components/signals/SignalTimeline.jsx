import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Clock, ClipboardCheck, CheckCircle2, UserCog } from 'lucide-react';
import SignalHistoryDetailDialog from '@/components/signals/SignalHistoryDetailDialog';
import { SEVERITY_COLORS, SIGNAL_STATUSES } from '@/lib/signalHistory';

const STATUS_TONE = {
  Open: 'bg-blue-100 text-blue-700',
  Acknowledged: 'bg-amber-100 text-amber-700',
  Resolved: 'bg-emerald-100 text-emerald-700',
};

const PAGE_SIZE = 25;

function fmtDate(d) {
  if (!d) return '—';
  const s = typeof d === 'string' ? d : d.toISOString();
  return s.slice(0, 10);
}

function SignalRow({ signal, onOpen }) {
  return (
    <button type="button" onClick={() => onOpen(signal)} className="flex w-full items-start gap-3 rounded-lg border bg-card p-3 text-left shadow-sm transition-colors hover:bg-muted/40">
      <span className="mt-0.5 inline-flex h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SEVERITY_COLORS[signal.severity] || '#64748b' }} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', STATUS_TONE[signal.status] || STATUS_TONE.Open)}>
            {signal.status}
          </span>
          <span className="text-xs text-muted-foreground">{signal.signalType}</span>
          {signal.actions.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <UserCog className="h-3 w-3" />{signal.actions.length} action(s)
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-sm font-medium text-foreground">{signal.title}</p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />Created {fmtDate(signal.createdDate)}</span>
          {signal.acknowledgedDate && <span className="inline-flex items-center gap-1"><ClipboardCheck className="h-3 w-3" />Ack {fmtDate(signal.acknowledgedDate)}</span>}
          {signal.resolvedDate && <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Resolved {fmtDate(signal.resolvedDate)}{signal.resolutionTimeDays != null ? ` · ${signal.resolutionTimeDays}d` : ''}</span>}
        </div>
        {signal.status === 'Resolved' && signal.resolutionNotes && (
          <p className="mt-1 line-clamp-1 text-xs italic text-muted-foreground">“{signal.resolutionNotes}”</p>
        )}
      </div>
    </button>
  );
}

export default function SignalTimeline({ signals }) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const pageCount = Math.max(1, Math.ceil(signals.length / PAGE_SIZE));
  const pageItems = signals.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [signals.length]);

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Timeline</h3>
        <span className="text-xs text-muted-foreground">Page {page} of {pageCount}</span>
      </div>

      {pageItems.length ? (
        <div className="mt-3 space-y-2">
          {pageItems.map((s) => <SignalRow key={s.id} signal={s} onOpen={setSelected} />)}
        </div>
      ) : (
        <p className="mt-6 py-8 text-center text-sm text-muted-foreground">No signals match the current filters.</p>
      )}

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span className="text-xs text-muted-foreground">{page} / {pageCount}</span>
          <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <SignalHistoryDetailDialog signal={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}
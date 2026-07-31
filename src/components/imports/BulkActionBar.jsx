import React, { useState } from 'react';
import { Layers, CheckCircle2, Shield, ArrowLeftRight, SkipForward, Ban, FileX, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BULK_ACTION_TYPE_LABEL } from '@/lib/importLabels';

// Bulk action toolbar. Each action calls the backend bulk endpoint,
// which creates/updates resolution records in a single audited operation.
// "Approve All" is intentionally split into distinct actions — there is
// no single button that resolves everything at once.

const BULK_ACTIONS = [
  { type: 'ACCEPT_ALL_SAFE_UPDATES', icon: CheckCircle2, tone: 'emerald', needsSelection: false },
  { type: 'ACCEPT_ALL_BLANK_FILLS', icon: CheckCircle2, tone: 'emerald', needsSelection: false },
  { type: 'ACCEPT_ALL_NEW_RESTRICTIONS', icon: Shield, tone: 'amber', needsSelection: false },
  { type: 'KEEP_CURRENT_FOR_SHARED_CONFLICTS', icon: ArrowLeftRight, tone: 'blue', needsSelection: false },
  { type: 'USE_INCOMING_FOR_SELECTED_CONFLICTS', icon: ArrowLeftRight, tone: 'warning', needsSelection: true },
  { type: 'SKIP_SELECTED_FIELDS', icon: SkipForward, tone: 'neutral', needsSelection: true },
  { type: 'ACCEPT_ALL_NEW_RECORD_FIELDS', icon: CheckCircle2, tone: 'emerald', needsSelection: false },
];

const TONE_CLASSES = {
  emerald: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
  blue: 'border-blue-200 text-blue-700 hover:bg-blue-50',
  amber: 'border-amber-200 text-amber-700 hover:bg-amber-50',
  warning: 'border-amber-300 text-amber-700 hover:bg-amber-50',
  neutral: 'border-border text-muted-foreground hover:bg-muted',
};

export default function BulkActionBar({ batchId, selectedCount, onBulkAction, disabled }) {
  const [pending, setPending] = useState(null);
  const [confirm, setConfirm] = useState(null);

  async function handleAction(type) {
    const action = BULK_ACTIONS.find((a) => a.type === type);
    if (action?.needsSelection && selectedCount === 0) {
      setConfirm({ type, message: 'Select at least one comparison first, then choose this action for the selected items.' });
      return;
    }
    setPending(type);
    try {
      await onBulkAction(type);
    } finally {
      setPending(null);
      setConfirm(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Bulk Actions:</span>
        {BULK_ACTIONS.map((a) => {
          const Icon = a.icon;
          const isPending = pending === a.type;
          const isDisabled = disabled || isPending || (a.needsSelection && selectedCount === 0);
          return (
            <Button
              key={a.type}
              variant="outline"
              size="sm"
              onClick={() => handleAction(a.type)}
              disabled={isDisabled}
              className={`text-xs ${TONE_CLASSES[a.tone]}`}
            >
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
              {BULK_ACTION_TYPE_LABEL[a.type]}
              {a.needsSelection && selectedCount > 0 ? ` (${selectedCount})` : ''}
            </Button>
          );
        })}
      </div>
      {confirm && (
        <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
          {confirm.message}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">
        Bulk actions create or update resolution records — they do not modify production data. Each bulk decision is audited and can be individually changed afterward.
      </p>
    </div>
  );
}
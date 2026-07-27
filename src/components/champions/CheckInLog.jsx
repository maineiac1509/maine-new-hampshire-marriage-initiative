import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Loader2, Plus } from 'lucide-react';

function formatWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return `Today, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CheckInLog({ householdId }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  function load() {
    setLoading(true);
    base44.entities.HouseholdNote.filter({ household_id: householdId }, '-created_date')
      .then((rows) => setNotes(rows || []))
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    base44.auth.me().then((u) => setCurrentUserId(u?.id || null)).catch(() => {});
  }, [householdId]);

  async function handleAdd() {
    const content = draft.trim();
    if (!content) return;
    setSaving(true);
    try {
      await base44.entities.HouseholdNote.create({ household_id: householdId, content });
      setDraft('');
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Add note */}
      <div className="space-y-2">
        <Textarea
          placeholder="Log conversation details, follow-ups, or important updates from this check-in…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          disabled={saving}
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={handleAdd} disabled={saving || !draft.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add Note
          </Button>
        </div>
      </div>

      {/* Log entries */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading notes…</p>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center text-muted-foreground">
          <MessageSquare className="h-6 w-6" />
          <p className="text-sm">No check-in notes yet.</p>
        </div>
      ) : (
        <ol className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-foreground">
                  {n.created_by_id === currentUserId ? 'You' : 'Team member'}
                </span>
                <span className="text-xs text-muted-foreground">{formatWhen(n.created_date)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{n.content}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
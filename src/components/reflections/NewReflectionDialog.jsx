import React, { useState } from 'react';
import { Sparkles, Loader2, AlertCircle, PenLine } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  REFLECTION_INTELLIGENCE_TASK,
  REFLECTION_INTELLIGENCE_SCHEMA,
  REFLECTION_INTELLIGENCE_CAPABILITY,
} from '@/lib/reflectionIntelligence';
import ReflectionReviewScreen from './ReflectionReviewScreen';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const MIN_NOTES_LENGTH = 10;

export default function NewReflectionDialog({ householdId, currentUser, onSaved, open: controlledOpen, onOpenChange }) {
  const [open, setOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const closeDialog = () => { if (isControlled) onOpenChange?.(false); else setOpen(false); };
  const [step, setStep] = useState('input'); // 'input' | 'analyzing' | 'review'
  const [reflectionDate, setReflectionDate] = useState(todayStr());
  const [notes, setNotes] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [error, setError] = useState(null);
  const [errorCategory, setErrorCategory] = useState(null);
  const [saving, setSaving] = useState(false);

  const canAnalyze = notes.trim().length >= MIN_NOTES_LENGTH;

  const handleAnalyze = async () => {
    setStep('analyzing');
    setError(null);
    setErrorCategory(null);
    try {
      const res = await base44.functions.invoke('aiRequest', {
        householdId,
        task: REFLECTION_INTELLIGENCE_TASK,
        capability: REFLECTION_INTELLIGENCE_CAPABILITY,
        outputSchema: REFLECTION_INTELLIGENCE_SCHEMA,
        additionalInstructions: `Reflection notes from the ministry volunteer:\n\n"""\n${notes}\n"""`,
      });
      const data = res.data;
      if (data.error) {
        setError(data.error);
        setErrorCategory(data.category);
        setStep('input');
      } else {
        setAiResult(data.result);
        setStep('review');
      }
    } catch (err) {
      const errData = err?.response?.data;
      setError(errData?.error || 'AI analysis is currently unavailable.');
      setErrorCategory(errData?.category || 'unknown');
      setStep('input');
    }
  };

  const buildPayload = (approved) => ({
    household_id: householdId,
    reflection_date: reflectionDate,
    original_notes: notes,
    summary: approved.reflection_summary || null,
    prayer_requests: approved.prayer_requests || [],
    action_items: approved.action_items || [],
    relationship_signals: approved.relationship_signals || [],
    leadership_observations: approved.leadership_observations || [],
    resource_recommendations: approved.resource_recommendations || [],
    timeline_entry: approved.timeline_entry || null,
    sentiment: approved.sentiment || null,
    sentiment_explanation: approved.sentiment_explanation || null,
    confidence: approved.confidence || null,
    confidence_explanation: approved.confidence_explanation || null,
    analysis_generated_at: new Date().toISOString(),
    saved_by_user_id: currentUser?.id || null,
    saved_by_name: currentUser?.full_name || null,
  });

  const handleSave = async (approved) => {
    setSaving(true);
    try {
      await base44.entities.Reflection.create(buildPayload(approved));
      setSaving(false);
      closeDialog();
      reset();
      onSaved?.();
    } catch {
      setSaving(false);
    }
  };

  const handleSaveNotesOnly = async () => {
    setSaving(true);
    try {
      await base44.entities.Reflection.create({
        household_id: householdId,
        reflection_date: reflectionDate,
        original_notes: notes,
        saved_by_user_id: currentUser?.id || null,
        saved_by_name: currentUser?.full_name || null,
      });
      setSaving(false);
      closeDialog();
      reset();
      onSaved?.();
    } catch {
      setSaving(false);
    }
  };

  const reset = () => {
    setStep('input');
    setNotes('');
    setAiResult(null);
    setError(null);
    setErrorCategory(null);
    setReflectionDate(todayStr());
    setSaving(false);
  };

  const handleOpenChange = (v) => {
    if (isControlled) onOpenChange?.(v); else setOpen(v);
    if (!v) setTimeout(reset, 150);
  };

  const isFeatureDisabled = errorCategory === 'feature_disabled';

  return (
    <Dialog open={isControlled ? controlledOpen : open} onOpenChange={handleOpenChange}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button size="sm">
            <PenLine className="h-4 w-4" /> New Reflection
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {step === 'input' && (
          <>
            <DialogHeader>
              <DialogTitle>New Reflection</DialogTitle>
              <DialogDescription>
                Type or paste rough meeting notes. We'll organize them into structured sections
                for your review. Nothing is saved automatically — you approve every section
                before anything is committed.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Reflection Date</Label>
                <Input
                  type="date"
                  value={reflectionDate}
                  onChange={(e) => setReflectionDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Meeting Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={10}
                  placeholder="Type or paste your rough notes here. Bullet points, stream-of-consciousness, partial thoughts — no formatting required."
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  {notes.trim().length} characters ·{' '}
                  {notes.trim().length < MIN_NOTES_LENGTH
                    ? `at least ${MIN_NOTES_LENGTH} characters needed to analyze`
                    : 'ready to analyze'}
                </p>
              </div>
              {error && (
                <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {isFeatureDisabled
                        ? 'AI is not currently enabled.'
                        : 'AI analysis is currently unavailable.'}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      You can still save your notes without AI analysis, or try again.
                    </p>
                    {!isFeatureDisabled && (
                      <Button variant="outline" size="sm" className="mt-3" onClick={handleAnalyze}>
                        Try Again
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveNotesOnly}
                disabled={saving || notes.trim().length === 0}
              >
                Save Notes Only
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleAnalyze} disabled={!canAnalyze || saving}>
                  <Sparkles className="h-4 w-4" /> Organize Notes
                </Button>
              </div>
            </DialogFooter>
          </>
        )}

        {step === 'analyzing' && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <DialogHeader>
              <DialogTitle>Analyzing Reflection</DialogTitle>
              <DialogDescription>
                Organizing your notes into structured sections. This usually takes a few seconds.
              </DialogDescription>
            </DialogHeader>
          </div>
        )}

        {step === 'review' && aiResult && (
          <>
            <DialogHeader>
              <DialogTitle>Review Reflection</DialogTitle>
              <DialogDescription>
                Review each section below. Accept, edit, or reject independently — only approved
                items will be saved. Your original notes are always preserved.
              </DialogDescription>
            </DialogHeader>
            <ReflectionReviewScreen
              aiResult={aiResult}
              originalNotes={notes}
              onSave={handleSave}
              onCancel={() => setStep('input')}
              saving={saving}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
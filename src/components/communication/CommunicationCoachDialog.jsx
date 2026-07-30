import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, Loader2, AlertCircle, Copy, Check, RefreshCw,
  ChevronLeft, BookOpen, ArrowRight, Info,
  MessageSquare, Heart, HeartHandshake, PartyPopper, Coffee,
  CalendarCheck, Users, PenLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  COMMUNICATION_TYPES,
  COMMUNICATION_COACH_SCHEMA,
  COMMUNICATION_COACH_CAPABILITY,
  buildCommunicationCoachTask,
} from '@/lib/communicationCoach';
import { base44 } from '@/api/base44Client';

const TYPE_ICONS = {
  check_in: MessageSquare,
  encouragement: Heart,
  prayer_followup: HeartHandshake,
  congratulations: PartyPopper,
  meeting_invitation: Coffee,
  meeting_followup: CalendarCheck,
  resource_recommendation: BookOpen,
  reengagement: RefreshCw,
  leadership_invitation: Users,
  custom: PenLine,
};

const CONFIDENCE_VARIANT = { High: 'success', Medium: 'info', Low: 'warning' };

export default function CommunicationCoachDialog({ householdId }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState('type'); // 'type' | 'generating' | 'review'
  const [selectedType, setSelectedType] = useState(null);
  const [draft, setDraft] = useState('');
  const [subject, setSubject] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [error, setError] = useState(null);
  const [errorCategory, setErrorCategory] = useState(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const generate = async (typeKey) => {
    setGenerating(true);
    setStep('generating');
    setError(null);
    setErrorCategory(null);
    try {
      const res = await base44.functions.invoke('aiRequest', {
        householdId,
        task: buildCommunicationCoachTask(typeKey),
        capability: COMMUNICATION_COACH_CAPABILITY,
        outputSchema: COMMUNICATION_COACH_SCHEMA,
      });
      const data = res.data;
      if (data.error) {
        setError(data.error);
        setErrorCategory(data.category);
        setStep('type');
      } else {
        setAiResult(data.result);
        setDraft(data.result.draft_message || '');
        setSubject(data.result.subject || '');
        setStep('review');
      }
    } catch (err) {
      const errData = err?.response?.data;
      setError(errData?.error || 'The Communication Coach is currently unavailable.');
      setErrorCategory(errData?.category || 'unknown');
      setStep('type');
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectType = (typeKey) => {
    setSelectedType(typeKey);
    generate(typeKey);
  };

  const handleRegenerate = () => {
    if (selectedType) generate(selectedType);
  };

  const handleChangeType = () => {
    setStep('type');
    setAiResult(null);
    setDraft('');
    setSubject('');
    setError(null);
    setErrorCategory(null);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  const reset = () => {
    setStep('type');
    setSelectedType(null);
    setDraft('');
    setSubject('');
    setAiResult(null);
    setError(null);
    setErrorCategory(null);
    setCopied(false);
    setGenerating(false);
  };

  const handleOpenChange = (v) => {
    setOpen(v);
    if (!v) setTimeout(reset, 150);
  };

  const isFeatureDisabled = errorCategory === 'feature_disabled';
  const composerUrl = `/communication/compose?championId=${householdId}${draft ? `&body=${encodeURIComponent(draft)}` : ''}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Sparkles className="h-4 w-4" /> Communication Coach
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {step === 'type' && (
          <>
            <DialogHeader>
              <DialogTitle>Communication Coach</DialogTitle>
              <DialogDescription>
                Choose a message type. The Coach will draft a personal, context-aware message using
                this champion's ministry history. You review and edit everything — nothing is sent automatically.
              </DialogDescription>
            </DialogHeader>
            {error && (
              <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {isFeatureDisabled
                      ? 'AI is not currently enabled.'
                      : 'The Communication Coach is currently unavailable.'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    You can still use the Communication Center templates to compose messages manually.
                  </p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 py-2 sm:grid-cols-2">
              {COMMUNICATION_TYPES.map((t) => {
                const Icon = TYPE_ICONS[t.key] || PenLine;
                return (
                  <button
                    key={t.key}
                    onClick={() => handleSelectType(t.key)}
                    disabled={generating}
                    className="flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:border-primary hover:bg-accent disabled:opacity-50"
                  >
                    <div className="mt-0.5 rounded-md bg-muted p-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{t.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <DialogHeader>
              <DialogTitle>Drafting Your Message</DialogTitle>
              <DialogDescription>
                The Communication Coach is reviewing the ministry context and writing a personal draft.
                This usually takes a few seconds.
              </DialogDescription>
            </DialogHeader>
          </div>
        )}

        {step === 'review' && aiResult && (
          <>
            <DialogHeader>
              <DialogTitle>Review Draft</DialogTitle>
              <DialogDescription>
                Edit anything below. When you're ready, copy the message or open it in the Communication
                Composer to send. Nothing is sent automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Type + Confidence */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {COMMUNICATION_TYPES.find((t) => t.key === selectedType)?.label}
                  </span>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleChangeType}>
                    <ChevronLeft className="h-3.5 w-3.5" /> Change Type
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">AI Confidence:</span>
                  <StatusBadge variant={CONFIDENCE_VARIANT[aiResult.confidence] || 'neutral'}>
                    {aiResult.confidence}
                  </StatusBadge>
                </div>
              </div>

              {/* Subject (optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Subject (optional)</label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Add a subject if sending via email"
                />
              </div>

              {/* Editable draft */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Draft Message</label>
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={10}
                  className="resize-y"
                />
              </div>

              {/* Why this draft */}
              {aiResult.why_this_draft && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Info className="h-3.5 w-3.5" /> Why this draft?
                  </p>
                  <p className="mt-1.5 text-sm text-foreground">{aiResult.why_this_draft}</p>
                  {aiResult.confidence_explanation && (
                    <p className="mt-2 text-xs text-muted-foreground">{aiResult.confidence_explanation}</p>
                  )}
                </div>
              )}

              {/* Resource recommendation */}
              {aiResult.resource_recommendation?.resource_name && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                    <BookOpen className="h-3.5 w-3.5" /> Resource Suggestion
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-foreground">
                    {aiResult.resource_recommendation.resource_name}
                  </p>
                  {aiResult.resource_recommendation.reason && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {aiResult.resource_recommendation.reason}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={generating}>
                  <RefreshCw className="h-4 w-4" /> Regenerate
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                  <Button size="sm" asChild>
                    <Link to={composerUrl} onClick={() => setOpen(false)}>
                      <ArrowRight className="h-4 w-4" /> Open in Composer
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
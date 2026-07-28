import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Copy, Printer, Save, Loader2, Send, ClipboardCheck,
  LogIn, User,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  resolveTemplate, findMergeFields, resolveFieldValue, highlightMergeFields, COMMUNICATION_TYPES,
} from '@/lib/mergeFields';

export default function CommunicationComposer() {
  const [params, setParams] = useSearchParams();
  const templateId = params.get('templateId');
  const championId = params.get('championId');
  const typeHint = params.get('type');

  const [user, setUser] = useState(null);
  const [template, setTemplate] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [household, setHousehold] = useState(null);
  const [members, setMembers] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [selectedChampionId, setSelectedChampionId] = useState(championId || '');
  const [workingBody, setWorkingBody] = useState('');
  const [loading, setLoading] = useState(!!templateId);
  const [copied, setCopied] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [logForm, setLogForm] = useState({
    communication_type: typeHint && COMMUNICATION_TYPES.includes(typeHint) ? typeHint : 'Text Message',
    subject: '', notes: '', follow_up_date: '', outcome: '', related_guide: '',
  });
  const [logging, setLogging] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [personalNote, setPersonalNote] = useState('');

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
    base44.entities.CommunicationTemplate.filter({ archived: false }, 'display_order')
      .then(setTemplates).catch(() => setTemplates([]));
    base44.entities.ChampionHousehold.list('-updated_date', 200)
      .then(setHouseholds).catch(() => setHouseholds([]));
  }, []);

  useEffect(() => {
    if (!templateId) { setTemplate(null); setLoading(false); return; }
    setLoading(true);
    base44.entities.CommunicationTemplate.get(templateId)
      .then(setTemplate).catch(() => setTemplate(null)).finally(() => setLoading(false));
  }, [templateId]);

  useEffect(() => {
    if (!selectedChampionId) { setHousehold(null); setMembers([]); return; }
    Promise.all([
      base44.entities.ChampionHousehold.get(selectedChampionId),
      base44.entities.HouseholdMember.filter({ household_id: selectedChampionId }),
    ]).then(([h, ms]) => { setHousehold(h); setMembers(ms || []); })
      .catch(() => { setHousehold(null); setMembers([]); });
  }, [selectedChampionId]);

  useEffect(() => {
    if (!templateId) return;
    base44.entities.TemplateNote.filter({ template_id: templateId })
      .then((ns) => { setPersonalNote(ns?.[0]?.content || ''); })
      .catch(() => setPersonalNote(''));
  }, [templateId]);

  const ctx = { champion: household, members, user };

  useEffect(() => {
    if (template?.body) {
      setWorkingBody(resolveTemplate(template.body, ctx));
    } else {
      setWorkingBody('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id, household?.id, user?.id]);

  const remainingFields = useMemo(() => {
    const found = findMergeFields(workingBody);
    return found.filter((k) => !resolveFieldValue(k, ctx));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workingBody, household, user, members]);

  function setCustom(key, val) {
    setWorkingBody((body) => body.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), val || `{{${key}}}`));
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(workingBody);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function handleSaveAs() {
    setSaving(true);
    try {
      await base44.entities.CommunicationTemplate.create({
        title: saveTitle,
        category: template?.category || 'Encouragement Messages',
        body: workingBody,
        suggested_tone: template?.suggested_tone,
        enabled: true,
        archived: false,
        display_order: 100,
      });
      setSaveOpen(false);
      setSaveTitle('');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveNote() {
    if (!templateId) return;
    const existing = await base44.entities.TemplateNote.filter({ template_id: templateId });
    if (existing?.length) {
      await base44.entities.TemplateNote.update(existing[0].id, { content: personalNote });
    } else {
      await base44.entities.TemplateNote.create({ template_id: templateId, content: personalNote });
    }
    setNoteOpen(false);
  }

  async function handleLog() {
    setLogging(true);
    try {
      await base44.entities.CommunicationLog.create({
        household_id: selectedChampionId || undefined,
        communication_type: logForm.communication_type,
        template_id: template?.id,
        template_title: template?.title,
        volunteer_name: user?.full_name || '',
        date: new Date().toISOString().slice(0, 10),
        subject: logForm.subject,
        notes: logForm.notes || workingBody,
        follow_up_date: logForm.follow_up_date || undefined,
        outcome: logForm.outcome,
        related_guide: logForm.related_guide,
      });
      setLogOpen(false);
      setLogForm({ communication_type: logForm.communication_type, subject: '', notes: '', follow_up_date: '', outcome: '', related_guide: '' });
    } finally {
      setLogging(false);
    }
  }

  const previewParts = useMemo(() => highlightMergeFields(workingBody), [workingBody]);
  const isAdmin = user?.role === 'admin';

  function pickTemplate(id) {
    const next = new URLSearchParams(params);
    if (id) next.set('templateId', id); else next.delete('templateId');
    setParams(next);
  }

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/communication"><ArrowLeft className="h-4 w-4" /> Back to Communication Center</Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Communication Composer</h1>
        <p className="text-sm text-muted-foreground">
          Preview, personalize, and prepare your message. Nothing sends automatically—you decide.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Template</Label>
          <Select value={templateId || ''} onValueChange={pickTemplate}>
            <SelectTrigger><SelectValue placeholder="Choose a template…" /></SelectTrigger>
            <SelectContent>
              {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Champion (optional)</Label>
          <Select value={selectedChampionId} onValueChange={setSelectedChampionId}>
            <SelectTrigger><SelectValue placeholder="Select a Champion to personalize…" /></SelectTrigger>
            <SelectContent>
              {households.map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  {h.household_name || h.area || 'Unnamed'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading template…
        </div>
      ) : !template ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          Select a template above to begin composing.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground">{template.category}</span>
                {template.suggested_tone && <span>Tone: {template.suggested_tone}</span>}
                {template.estimated_reading_time && <span>· {template.estimated_reading_time}</span>}
              </div>
              {template.description && <p className="mt-2 text-sm text-muted-foreground">{template.description}</p>}
            </div>

            {remainingFields.length > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/50 dark:bg-blue-950/30">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                  Fill in these fields
                </p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {remainingFields.map((key) => (
                    <div key={key} className="space-y-1">
                      <label className="text-xs text-blue-900 dark:text-blue-100">{`{{${key}}}`}</label>
                      <Input placeholder={`Enter ${key}`} onChange={(e) => setCustom(key, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Your Message</Label>
              <Textarea
                value={workingBody}
                onChange={(e) => setWorkingBody(e.target.value)}
                rows={14}
                className="font-body"
              />
              <p className="text-xs text-muted-foreground">Edit freely—this is your message, in your voice.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Preview (merge fields highlighted)</Label>
              <div className="whitespace-pre-wrap rounded-md border bg-background p-3 text-sm leading-relaxed">
                {previewParts.map((p, i) =>
                  p.isField ? (
                    <mark key={i} className="rounded bg-yellow-200 px-0.5 text-foreground dark:bg-yellow-800/60">{p.text}</mark>
                  ) : (
                    <span key={i}>{p.text}</span>
                  )
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleCopy} variant="outline" size="sm">
                {copied ? <ClipboardCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </Button>
              <Button onClick={() => window.print()} variant="outline" size="sm">
                <Printer className="h-4 w-4" /> Print
              </Button>
              {isAdmin && (
                <Button onClick={() => setSaveOpen((v) => !v)} variant="outline" size="sm">
                  <Save className="h-4 w-4" /> Save as New Template
                </Button>
              )}
              <Button onClick={() => setLogOpen((v) => !v)} variant="outline" size="sm">
                <LogIn className="h-4 w-4" /> Log Communication
              </Button>
              <Button onClick={() => setNoteOpen((v) => !v)} variant="outline" size="sm">
                <User className="h-4 w-4" /> Personal Note
              </Button>
            </div>

            {saveOpen && (
              <div className="rounded-lg border bg-card p-3">
                <Label>Save as new template</Label>
                <div className="mt-2 flex gap-2">
                  <Input value={saveTitle} onChange={(e) => setSaveTitle(e.target.value)} placeholder="New template title" />
                  <Button onClick={handleSaveAs} disabled={saving || !saveTitle.trim()}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
                  </Button>
                </div>
              </div>
            )}

            {noteOpen && (
              <div className="rounded-lg border bg-card p-3">
                <Label>Personal Note (private to you)</Label>
                <Textarea value={personalNote} onChange={(e) => setPersonalNote(e.target.value)} rows={3} placeholder="e.g. I usually shorten the first paragraph." className="mt-2" />
                <p className="mt-1 text-xs text-muted-foreground">Only you can see this note.</p>
                <Button onClick={handleSaveNote} size="sm" className="mt-2">Save Note</Button>
              </div>
            )}

            {logOpen && (
              <div className="rounded-lg border bg-card p-3 space-y-3">
                <Label>Log this communication</Label>
                <p className="text-xs text-muted-foreground">Optional—record what you sent and any follow-up needed.</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select value={logForm.communication_type} onValueChange={(v) => setLogForm((f) => ({ ...f, communication_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COMMUNICATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Subject</Label>
                    <Input value={logForm.subject} onChange={(e) => setLogForm((f) => ({ ...f, subject: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Follow-up Date</Label>
                    <Input type="date" value={logForm.follow_up_date} onChange={(e) => setLogForm((f) => ({ ...f, follow_up_date: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Outcome</Label>
                    <Input value={logForm.outcome} onChange={(e) => setLogForm((f) => ({ ...f, outcome: e.target.value }))} placeholder="e.g. No response yet" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Notes</Label>
                  <Textarea value={logForm.notes} onChange={(e) => setLogForm((f) => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Defaults to your message—edit as needed." />
                </div>
                <Button onClick={handleLog} disabled={logging}>
                  {logging ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} Save Log
                </Button>
              </div>
            )}
          </div>

          <aside className="space-y-3">
            {template.recommended_followup && (
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended Follow-up</p>
                <p className="mt-1 text-sm text-foreground">{template.recommended_followup}</p>
              </div>
            )}
            {Array.isArray(template.related_guides) && template.related_guides.length > 0 && (
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Related Guides</p>
                <ul className="mt-2 space-y-1">
                  {template.related_guides.map((g, i) => (
                    <li key={i} className="text-sm text-primary">{g}</li>
                  ))}
                </ul>
              </div>
            )}
            {Array.isArray(template.tags) && template.tags.length > 0 && (
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {template.tags.map((t, i) => (
                    <span key={i} className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-accent-foreground">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
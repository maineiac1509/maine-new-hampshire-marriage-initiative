import React, { useState } from 'react';
import {
  FileText, Heart, ClipboardList, Activity, Users, BookOpen, Clock, Smile,
  Check, X, Pencil, Plus, Trash2, ShieldCheck, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/StatusBadge';

const SENTIMENT_OPTIONS = ['Encouraging', 'Hopeful', 'Challenging', 'Celebratory', 'Reflective', 'Concerned', 'Neutral'];

const CONFIDENCE_VARIANT = { High: 'success', Medium: 'info', Low: 'warning' };
const SENTIMENT_VARIANT = {
  Encouraging: 'success', Hopeful: 'success', Celebratory: 'success',
  Challenging: 'warning', Concerned: 'warning',
  Reflective: 'info', Neutral: 'neutral',
};

const SECTION_CONFIG = [
  { key: 'reflection_summary', title: 'Reflection Summary', icon: FileText, type: 'text' },
  { key: 'prayer_requests', title: 'Prayer Requests', icon: Heart, type: 'list',
    mainField: 'request', mainLabel: 'Request', secondaryFields: [] },
  { key: 'action_items', title: 'Action Items', icon: ClipboardList, type: 'list',
    mainField: 'item', mainLabel: 'Action', secondaryFields: [{ key: 'why', label: 'Why' }] },
  { key: 'relationship_signals', title: 'Relationship Signals', icon: Activity, type: 'list',
    mainField: 'signal', mainLabel: 'Signal', secondaryFields: [] },
  { key: 'leadership_observations', title: 'Leadership Observations', icon: Users, type: 'list',
    mainField: 'observation', mainLabel: 'Observation', secondaryFields: [] },
  { key: 'resource_recommendations', title: 'Resource Recommendations', icon: BookOpen, type: 'list',
    mainField: 'resource', mainLabel: 'Resource', secondaryFields: [{ key: 'reason', label: 'Why' }] },
  { key: 'timeline_entry', title: 'Timeline Entry', icon: Clock, type: 'text' },
  { key: 'sentiment', title: 'Sentiment', icon: Smile, type: 'select', options: SENTIMENT_OPTIONS },
];

export default function ReflectionReviewScreen({ aiResult, originalNotes, onSave, onCancel, saving }) {
  const [sections, setSections] = useState(() => initializeSections(aiResult));
  const [showNotes, setShowNotes] = useState(false);

  function initializeSections(result) {
    const s = {};
    SECTION_CONFIG.forEach((cfg) => {
      s[cfg.key] = {
        accepted: true,
        editing: false,
        value: result[cfg.key] ?? (cfg.type === 'list' ? [] : ''),
      };
    });
    return s;
  }

  const toggleAccepted = (key) => {
    setSections((prev) => ({ ...prev, [key]: { ...prev[key], accepted: !prev[key].accepted } }));
  };

  const toggleEditing = (key) => {
    setSections((prev) => ({ ...prev, [key]: { ...prev[key], editing: !prev[key].editing } }));
  };

  const updateValue = (key, value) => {
    setSections((prev) => ({ ...prev, [key]: { ...prev[key], value } }));
  };

  const updateListItem = (key, idx, field, value) => {
    setSections((prev) => {
      const list = [...prev[key].value];
      list[idx] = { ...list[idx], [field]: value };
      return { ...prev, [key]: { ...prev[key], value: list } };
    });
  };

  const removeListItem = (key, idx) => {
    setSections((prev) => {
      const list = prev[key].value.filter((_, i) => i !== idx);
      return { ...prev, [key]: { ...prev[key], value: list } };
    });
  };

  const addListItem = (key, cfg) => {
    const newItem = { [cfg.mainField]: '' };
    cfg.secondaryFields.forEach((sf) => { newItem[sf.key] = ''; });
    setSections((prev) => ({
      ...prev,
      [key]: { ...prev[key], value: [...prev[key].value, newItem] },
    }));
  };

  const handleSave = () => {
    const approved = {};
    SECTION_CONFIG.forEach((cfg) => {
      const sec = sections[cfg.key];
      if (sec.accepted) {
        approved[cfg.key] = sec.value;
      }
    });
    // Confidence is read-only metadata — always preserved.
    approved.confidence = aiResult.confidence;
    approved.confidence_explanation = aiResult.confidence_explanation;
    // Sentiment explanation only if the sentiment section is accepted.
    approved.sentiment_explanation = sections.sentiment?.accepted
      ? aiResult.sentiment_explanation
      : null;
    onSave(approved);
  };

  const acceptedCount = Object.values(sections).filter((s) => s.accepted).length;

  return (
    <div className="space-y-4 py-2">
      {/* Original notes (collapsible, read-only) */}
      <div className="rounded-lg border bg-muted/30">
        <button
          className="flex w-full items-center justify-between gap-2 p-3 text-left"
          onClick={() => setShowNotes((v) => !v)}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4 text-muted-foreground" /> Original Notes
          </span>
          <span className="text-xs text-muted-foreground">{showNotes ? 'Hide' : 'Show'}</span>
        </button>
        {showNotes && (
          <div className="border-t p-3">
            <p className="whitespace-pre-wrap text-sm text-foreground">{originalNotes}</p>
          </div>
        )}
      </div>

      {/* Confidence metadata (read-only) */}
      <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">AI Confidence</span>
          <StatusBadge variant={CONFIDENCE_VARIANT[aiResult.confidence] || 'neutral'}>
            {aiResult.confidence}
          </StatusBadge>
        </div>
        {aiResult.confidence_explanation && (
          <span className="hidden text-xs text-muted-foreground sm:block">
            {aiResult.confidence_explanation}
          </span>
        )}
      </div>

      {/* Sections */}
      {SECTION_CONFIG.map((cfg) => (
        <SectionCard
          key={cfg.key}
          cfg={cfg}
          section={sections[cfg.key]}
          aiResult={aiResult}
          onToggleAccepted={() => toggleAccepted(cfg.key)}
          onToggleEditing={() => toggleEditing(cfg.key)}
          onUpdateValue={(v) => updateValue(cfg.key, v)}
          onUpdateListItem={(idx, field, v) => updateListItem(cfg.key, idx, field, v)}
          onRemoveListItem={(idx) => removeListItem(cfg.key, idx)}
          onAddListItem={() => addListItem(cfg.key, cfg)}
        />
      ))}

      {/* Footer */}
      <div className="flex items-center justify-between border-t pt-4">
        <p className="text-sm text-muted-foreground">
          {acceptedCount} of {SECTION_CONFIG.length} sections will be saved
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} disabled={saving}>Back</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save Reflection
          </Button>
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  cfg, section, aiResult, onToggleAccepted, onToggleEditing,
  onUpdateValue, onUpdateListItem, onRemoveListItem, onAddListItem,
}) {
  const Icon = cfg.icon;
  const isList = cfg.type === 'list';
  const isEmpty = isList ? (section.value || []).length === 0 : !section.value;

  return (
    <div
      className={`rounded-lg border transition-colors ${
        section.accepted ? 'border-border' : 'border-dashed border-muted-foreground/30 bg-muted/20'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{cfg.title}</h3>
          {section.accepted && !isEmpty && isList && (
            <span className="text-xs text-muted-foreground">
              {section.value.length} item{section.value.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {section.accepted && !isEmpty && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={onToggleEditing}
            >
              {section.editing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
              {section.editing ? 'Done' : 'Edit'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 px-2 text-xs ${section.accepted ? 'text-muted-foreground' : 'text-foreground'}`}
            onClick={onToggleAccepted}
          >
            {section.accepted ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            {section.accepted ? 'Reject' : 'Include'}
          </Button>
        </div>
      </div>

      {/* Content */}
      {section.accepted ? (
        <div className="border-t px-3 pb-3 pt-3">
          {isEmpty ? (
            <p className="text-sm italic text-muted-foreground">No items identified in the notes.</p>
          ) : cfg.type === 'text' ? (
            section.editing ? (
              <Textarea
                value={section.value}
                onChange={(e) => onUpdateValue(e.target.value)}
                rows={4}
              />
            ) : (
              <p className="text-sm text-foreground">{section.value}</p>
            )
          ) : cfg.type === 'select' ? (
            section.editing ? (
              <Select value={section.value} onValueChange={onUpdateValue}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {cfg.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <div>
                <StatusBadge variant={SENTIMENT_VARIANT[section.value] || 'neutral'}>
                  {section.value}
                </StatusBadge>
                {aiResult.sentiment_explanation && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {aiResult.sentiment_explanation}
                  </p>
                )}
              </div>
            )
          ) : (
            <ListEditor
              items={section.value}
              cfg={cfg}
              editing={section.editing}
              onUpdateListItem={onUpdateListItem}
              onRemoveListItem={onRemoveListItem}
              onAddListItem={onAddListItem}
            />
          )}
        </div>
      ) : (
        <div className="px-3 pb-3">
          <p className="text-sm text-muted-foreground">This section will not be saved.</p>
        </div>
      )}
    </div>
  );
}

function ListEditor({ items, cfg, editing, onUpdateListItem, onRemoveListItem, onAddListItem }) {
  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={idx} className="rounded-md border p-3">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground">{cfg.mainLabel}</label>
                {editing ? (
                  <Textarea
                    value={item[cfg.mainField] || ''}
                    onChange={(e) => onUpdateListItem(idx, cfg.mainField, e.target.value)}
                    rows={2}
                    className="mt-1"
                  />
                ) : (
                  <p className="mt-1 text-sm text-foreground">{item[cfg.mainField]}</p>
                )}
              </div>
              {editing && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-destructive"
                  onClick={() => onRemoveListItem(idx)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            {cfg.secondaryFields.map((sf) => (
              <div key={sf.key}>
                <label className="text-xs font-medium text-muted-foreground">{sf.label}</label>
                {editing ? (
                  <Textarea
                    value={item[sf.key] || ''}
                    onChange={(e) => onUpdateListItem(idx, sf.key, e.target.value)}
                    rows={2}
                    className="mt-1"
                  />
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">{item[sf.key]}</p>
                )}
              </div>
            ))}
            {item.evidence && (
              <div className="rounded bg-muted/40 p-2">
                <label className="text-xs font-medium text-muted-foreground">Evidence</label>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.evidence}</p>
              </div>
            )}
          </div>
        </div>
      ))}
      {editing && (
        <Button variant="outline" size="sm" onClick={onAddListItem}>
          <Plus className="h-4 w-4" /> Add Item
        </Button>
      )}
    </div>
  );
}
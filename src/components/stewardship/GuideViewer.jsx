import React, { useState } from 'react';
import {
  ChevronDown,
  Compass,
  HeartHandshake,
  BookMarked,
  Lightbulb,
  ClipboardList,
  Quote,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function SectionToggle({ icon: Icon, title, isOpen, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition hover:bg-accent"
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </span>
      <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition', isOpen && 'rotate-180')} />
    </button>
  );
}

export default function GuideViewer({ guide }) {
  const sections = [
    { key: 'overview', label: 'Overview', icon: Compass, show: Boolean(guide.overview) },
    { key: 'approaches', label: 'Suggested Approaches', icon: Compass, show: Array.isArray(guide.suggested_approaches) && guide.suggested_approaches.length > 0 },
    { key: 'conversation', label: 'Conversation Ideas', icon: HeartHandshake, show: Array.isArray(guide.conversation_ideas) && guide.conversation_ideas.length > 0 },
    { key: 'scripture', label: 'Scripture & Encouragement', icon: BookMarked, show: Boolean(guide.scripture_encouragement) },
    { key: 'resources', label: 'Helpful Resources', icon: Lightbulb, show: Array.isArray(guide.helpful_resources) && guide.helpful_resources.length > 0 },
    { key: 'remember', label: 'Things to Remember', icon: ClipboardList, show: Array.isArray(guide.things_to_remember) && guide.things_to_remember.length > 0 },
  ].filter((s) => s.show);

  const [open, setOpen] = useState(() =>
    Object.fromEntries(sections.map((s) => [s.key, true]))
  );
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      {/* Table of contents */}
      {sections.length > 0 && (
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <nav className="rounded-lg border bg-card p-2">
            <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Contents
            </p>
            <ul className="space-y-0.5">
              {sections.map((s) => (
                <li key={s.key}>
                  <a
                    href={`#section-${s.key}`}
                    className="block rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      )}

      {/* Content */}
      <div className="space-y-3">
        {guide.overview && (
          <section id="section-overview" className="scroll-mt-4 rounded-lg border bg-card p-3">
            <SectionToggle icon={Compass} title="Overview" isOpen={open.overview} onToggle={() => toggle('overview')} />
            {open.overview && <p className="px-3 pb-3 pt-1 text-sm leading-relaxed text-foreground">{guide.overview}</p>}
          </section>
        )}

        {Array.isArray(guide.suggested_approaches) && guide.suggested_approaches.length > 0 && (
          <section id="section-approaches" className="scroll-mt-4 rounded-lg border bg-card p-3">
            <SectionToggle icon={Compass} title="Suggested Approaches" isOpen={open.approaches} onToggle={() => toggle('approaches')} />
            {open.approaches && (
              <div className="space-y-2 px-1 pb-2 pt-2">
                {guide.suggested_approaches.map((a, i) => (
                  <div key={i} className="rounded-md border bg-background p-3">
                    <p className="text-sm font-semibold text-foreground">{a.title}</p>
                    {a.description && <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>}
                    {a.why_effective && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Why this may be effective: </span>
                        {a.why_effective}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {Array.isArray(guide.conversation_ideas) && guide.conversation_ideas.length > 0 && (
          <section id="section-conversation" className="scroll-mt-4 rounded-lg border bg-card p-3">
            <SectionToggle icon={HeartHandshake} title="Conversation Ideas" isOpen={open.conversation} onToggle={() => toggle('conversation')} />
            {open.conversation && (
              <ul className="space-y-2 px-3 pb-3 pt-2">
                {guide.conversation_ideas.map((idea, i) => (
                  <li key={i} className="flex gap-2 text-sm text-foreground">
                    <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{idea}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {guide.scripture_encouragement && (
          <section id="section-scripture" className="scroll-mt-4 rounded-lg border bg-card p-3">
            <SectionToggle icon={BookMarked} title="Scripture & Encouragement" isOpen={open.scripture} onToggle={() => toggle('scripture')} />
            {open.scripture && <p className="px-3 pb-3 pt-1 text-sm leading-relaxed text-foreground">{guide.scripture_encouragement}</p>}
          </section>
        )}

        {Array.isArray(guide.helpful_resources) && guide.helpful_resources.length > 0 && (
          <section id="section-resources" className="scroll-mt-4 rounded-lg border bg-card p-3">
            <SectionToggle icon={Lightbulb} title="Helpful Resources" isOpen={open.resources} onToggle={() => toggle('resources')} />
            {open.resources && (
              <div className="grid grid-cols-1 gap-2 px-1 pb-2 pt-2 sm:grid-cols-2">
                {guide.helpful_resources.map((r, i) => (
                  <div key={i} className="rounded-md border border-dashed bg-background p-3">
                    <p className="text-sm font-medium text-foreground">{r.title}</p>
                    {r.description && <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {Array.isArray(guide.things_to_remember) && guide.things_to_remember.length > 0 && (
          <section
            id="section-remember"
            className="scroll-mt-4 rounded-lg border-2 border-amber-300 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/30"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
                <ClipboardList className="h-4 w-4" />
                Things to Remember
              </span>
              <button type="button" onClick={() => toggle('remember')} className="text-amber-700 dark:text-amber-300">
                <ChevronDown className={cn('h-4 w-4 transition', open.remember && 'rotate-180')} />
              </button>
            </div>
            {open.remember && (
              <ul className="mt-2 space-y-1.5">
                {guide.things_to_remember.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-amber-900 dark:text-amber-100">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
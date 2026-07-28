import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown, Compass, HeartHandshake, BookMarked, Lightbulb, ClipboardList,
  Quote, Sparkles, HandHeart, ArrowRight, BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import SuggestedCommunications from '@/components/stewardship/SuggestedCommunications';

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

function Callout({ label, content }) {
  return (
    <div className="my-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/50 dark:bg-blue-950/30">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
        <Sparkles className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="mt-1 text-sm text-blue-900 dark:text-blue-100">{content}</p>
    </div>
  );
}

export default function GuideViewer({ guide, allGuides = [] }) {
  const sections = [
    { key: 'overview', label: 'Overview', icon: Compass, show: Boolean(guide.overview) },
    { key: 'approaches', label: 'Suggested Approaches', icon: Compass, show: Array.isArray(guide.suggested_approaches) && guide.suggested_approaches.length > 0 },
    { key: 'conversation', label: 'Conversation Starters', icon: HeartHandshake, show: Array.isArray(guide.conversation_ideas) && guide.conversation_ideas.length > 0 },
    { key: 'prayer', label: 'Prayer Prompts', icon: HandHeart, show: Array.isArray(guide.prayer_prompts) && guide.prayer_prompts.length > 0 },
    { key: 'scripture', label: 'Scripture & Encouragement', icon: BookMarked, show: Array.isArray(guide.scriptures) && guide.scriptures.length > 0 },
    { key: 'resources', label: 'Helpful Resources', icon: Lightbulb, show: Array.isArray(guide.helpful_resources) && guide.helpful_resources.length > 0 },
    { key: 'remember', label: 'Things to Remember', icon: ClipboardList, show: Array.isArray(guide.things_to_remember) && guide.things_to_remember.length > 0 },
    { key: 'reflection', label: 'Reflection Questions', icon: Compass, show: Array.isArray(guide.reflection_questions) && guide.reflection_questions.length > 0 },
  ].filter((s) => s.show);

  const [open, setOpen] = useState(() =>
    Object.fromEntries(sections.map((s) => [s.key, true]))
  );
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const related = (Array.isArray(allGuides) ? allGuides : []).filter(
    (g) => g.id !== guide.id && Array.isArray(guide.related_guides) && guide.related_guides.includes(g.title)
  );
  const relatedUnresolved = (guide.related_guides || []).filter(
    (title) => !related.some((g) => g.title === title)
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
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

      <div className="space-y-3">
        {guide.overview && (
          <section id="section-overview" className="scroll-mt-4 rounded-lg border bg-card p-3">
            <SectionToggle icon={Compass} title="Overview" isOpen={open.overview} onToggle={() => toggle('overview')} />
            {open.overview && <p className="px-3 pb-3 pt-1 text-sm leading-relaxed text-foreground">{guide.overview}</p>}
          </section>
        )}

        {/* Ministry Wisdom callouts — shown early as highlighted insights */}
        {Array.isArray(guide.wisdom_callouts) && guide.wisdom_callouts.length > 0 && (
          <div className="space-y-2">
            {guide.wisdom_callouts.map((c, i) => (
              <Callout key={i} label={c.label || 'Ministry Insight'} content={c.content} />
            ))}
          </div>
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
                    {a.when_it_works && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">When it works well: </span>
                        {a.when_it_works}
                      </p>
                    )}
                    {a.when_to_consider_alternative && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">When another approach might be better: </span>
                        {a.when_to_consider_alternative}
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
            <SectionToggle icon={HeartHandshake} title="Conversation Starters" isOpen={open.conversation} onToggle={() => toggle('conversation')} />
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

        {Array.isArray(guide.prayer_prompts) && guide.prayer_prompts.length > 0 && (
          <section id="section-prayer" className="scroll-mt-4 rounded-lg border bg-card p-3">
            <SectionToggle icon={HandHeart} title="Prayer Prompts" isOpen={open.prayer} onToggle={() => toggle('prayer')} />
            {open.prayer && (
              <ul className="space-y-2 px-3 pb-3 pt-2">
                {guide.prayer_prompts.map((p, i) => (
                  <li key={i} className="flex gap-2 text-sm text-foreground">
                    <HandHeart className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {Array.isArray(guide.scriptures) && guide.scriptures.length > 0 && (
          <section id="section-scripture" className="scroll-mt-4 rounded-lg border bg-card p-3">
            <SectionToggle icon={BookMarked} title="Scripture & Encouragement" isOpen={open.scripture} onToggle={() => toggle('scripture')} />
            {open.scripture && (
              <div className="space-y-2 px-1 pb-2 pt-2">
                {guide.scriptures.map((s, i) => (
                  <div key={i} className="rounded-md border-l-2 border-primary bg-background p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-primary">{s.topic || 'Encouragement'}</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{s.reference}</p>
                    {s.encouragement && <p className="mt-1 text-sm text-muted-foreground">{s.encouragement}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {Array.isArray(guide.helpful_resources) && guide.helpful_resources.length > 0 && (
          <section id="section-resources" className="scroll-mt-4 rounded-lg border bg-card p-3">
            <SectionToggle icon={Lightbulb} title="Helpful Resources" isOpen={open.resources} onToggle={() => toggle('resources')} />
            {open.resources && (
              <div className="grid grid-cols-1 gap-2 px-1 pb-2 pt-2 sm:grid-cols-2">
                {guide.helpful_resources.map((r, i) => (
                  <div key={i} className="rounded-md border border-dashed bg-background p-3">
                    <span className="inline-flex rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                      {r.category || 'Resource'}
                    </span>
                    <p className="mt-1.5 text-sm font-medium text-foreground">{r.title}</p>
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

        {Array.isArray(guide.reflection_questions) && guide.reflection_questions.length > 0 && (
          <section id="section-reflection" className="scroll-mt-4 rounded-lg border bg-card p-3">
            <SectionToggle icon={Compass} title="Reflection Questions" isOpen={open.reflection} onToggle={() => toggle('reflection')} />
            {open.reflection && (
              <div className="px-3 pb-3 pt-1">
                <p className="mb-2 text-xs italic text-muted-foreground">
                  Personal ministry notes for your own reflection — not performance evaluations.
                </p>
                <ul className="space-y-2">
                  {guide.reflection_questions.map((q, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground">
                      <span className="text-muted-foreground">{i + 1}.</span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Suggested Communications */}
        <SuggestedCommunications items={guide.suggested_communications} />

        {/* Related Guides — cross references */}
        {(related.length > 0 || relatedUnresolved.length > 0) && (
          <section className="rounded-lg border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ArrowRight className="h-4 w-4 text-primary" />
              You may also find these Guides helpful
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {related.map((g) => (
                <Link
                  key={g.id}
                  to={`/stewardship-guides/${g.id}`}
                  className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition hover:border-primary/40 hover:shadow-sm"
                >
                  <BookOpen className="h-3.5 w-3.5 text-primary" />
                  {g.title}
                </Link>
              ))}
              {relatedUnresolved.map((title, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-md border border-dashed bg-background px-3 py-1.5 text-sm text-muted-foreground"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  {title}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
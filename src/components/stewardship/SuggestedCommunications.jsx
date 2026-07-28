import React from 'react';
import { Link } from 'react-router-dom';
import { Send } from 'lucide-react';

// "Suggested Communications" section rendered inside a Stewardship Guide.
// Each item links to the Communication Composer with the template preselected.
export default function SuggestedCommunications({ items }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <section className="rounded-lg border bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Send className="h-4 w-4 text-primary" />
        Suggested Communications
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Templates to adapt—make them your own before sending. Nothing sends automatically.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((c, i) => {
          const label = c?.label || c?.template_title || 'Compose';
          return c?.template_id ? (
            <Link
              key={i}
              to={`/communication/compose?templateId=${c.template_id}`}
              className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition hover:border-primary/40 hover:shadow-sm"
            >
              <Send className="h-3.5 w-3.5 text-primary" />
              {label}
            </Link>
          ) : (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-md border border-dashed bg-background px-3 py-1.5 text-sm text-muted-foreground"
            >
              <Send className="h-3.5 w-3.5" />
              {label}
            </span>
          );
        })}
      </div>
    </section>
  );
}
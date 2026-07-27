import React from 'react';

export default function AssignmentSection({ icon: Icon, title, children, action }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {Icon && <Icon className="h-4 w-4" />}
          {title}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
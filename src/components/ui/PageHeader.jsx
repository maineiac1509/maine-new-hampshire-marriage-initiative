import * as React from "react";
import { cn } from "@/lib/utils";

// Standardized page header: title, subtitle, and right-aligned actions.
// Every page follows the same predictable structure — Page Header → Summary →
// Primary Content → Supporting Information → Actions.
export function PageHeader({ title, subtitle, actions, className }) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="space-y-0.5">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export default PageHeader;
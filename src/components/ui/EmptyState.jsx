import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Standardized empty state: friendly message, brief explanation, and an
// optional helpful next action. Used wherever a list or section is empty.
export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, className }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border border-dashed bg-card px-6 py-12 text-center",
        className
      )}
    >
      {Icon && <Icon className="h-8 w-8 text-muted-foreground/60" />}
      {title && <p className="text-sm font-medium text-foreground">{title}</p>}
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {actionLabel && onAction && (
        <Button size="sm" variant="outline" className="mt-2" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
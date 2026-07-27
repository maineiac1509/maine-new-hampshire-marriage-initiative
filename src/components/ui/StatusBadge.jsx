import * as React from "react";
import { cn } from "@/lib/utils";

// One reusable badge system for status, relationship, follow-up, and assignment
// badges. Future badges inherit the same sizing, radius, and icon placement
// automatically — just pick a semantic variant.
//
// Color system (intentional, minimal):
//   success  → green   (positive milestones, up to date)
//   warning  → amber   (needs attention)
//   info     → blue    (informational, in progress)
//   danger   → red     (urgent, overdue)
//   neutral  → slate   (inactive, informational)
const VARIANTS = {
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  info: "bg-blue-100 text-blue-700",
  danger: "bg-red-100 text-red-700",
  neutral: "bg-slate-100 text-slate-600",
};

export function StatusBadge({ variant = "neutral", icon: Icon, className, children, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        VARIANTS[variant] || VARIANTS.neutral,
        className
      )}
      {...props}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}

export default StatusBadge;
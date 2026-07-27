import React from 'react';
import { Link } from 'react-router-dom';
import { History } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

const LIMIT = 15;

function timeAgo(ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 0) return 'just now';
  if (diff < 60000) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ActivityRow({ item }) {
  const Icon = item.icon;
  const content = (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{item.title}</p>
        {item.subtitle && <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {timeAgo(item.timestamp)}
          {item.actor ? ` · ${item.actor}` : ''}
        </p>
      </div>
    </div>
  );
  if (item.href) {
    return <Link to={item.href} className="block rounded-lg p-2 transition-colors hover:bg-muted/50">{content}</Link>;
  }
  return <div className="p-2">{content}</div>;
}

export default function ActivityFeed({ items }) {
  const visible = items.slice(0, LIMIT);
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent Ministry Activity</h2>
        {items.length > 0 && (
          <Link to="/contact-history" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            View All
          </Link>
        )}
      </div>
      <div className="mt-3">
        {visible.length === 0 ? (
          <EmptyState
            icon={History}
            title="No ministry activity has been recorded yet"
            description="As your team logs contacts and manages assignments, activity will appear here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((item) => (
              <li key={item.id}><ActivityRow item={item} /></li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
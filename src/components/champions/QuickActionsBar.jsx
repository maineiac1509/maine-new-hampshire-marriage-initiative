import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Mail, Phone, HeartHandshake, Coffee, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CommunicationCoachDialog from '@/components/communication/CommunicationCoachDialog';

const QUICK_ACTIONS = [
  { label: 'Text', icon: MessageSquare, type: 'Text Message' },
  { label: 'Email', icon: Mail, type: 'Email' },
  { label: 'Phone Notes', icon: Phone, type: 'Phone Call' },
  { label: 'Prayer', icon: HeartHandshake, type: 'Prayer' },
  { label: 'Coffee', icon: Coffee, type: 'Coffee Invitation' },
];

export default function QuickActionsBar({ championId }) {
  const composeType = (type) =>
    `/communication/compose?championId=${championId || ''}&type=${encodeURIComponent(type)}`;

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Zap className="h-4 w-4" />
          Quick Actions
        </div>
        <CommunicationCoachDialog householdId={championId} />
      </div>
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Button key={a.label} asChild variant="outline" size="sm">
              <Link to={composeType(a.type)}>
                <Icon className="h-4 w-4" /> {a.label}
              </Link>
            </Button>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] italic text-muted-foreground">
        Log a new interaction — each action opens the Communication Composer with a template ready to personalize.
      </p>
    </div>
  );
}
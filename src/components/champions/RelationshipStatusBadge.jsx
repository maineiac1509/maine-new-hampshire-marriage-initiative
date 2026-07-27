import React from 'react';
import {
  Sparkles, UserCheck, PhoneCall, PhoneMissed, Handshake, Repeat,
  CalendarCheck, PartyPopper, Heart, CircleOff,
} from 'lucide-react';
import { RELATIONSHIP_STATUS_STYLES } from '@/lib/config';

// Consistent icon per Relationship Status.
const STATUS_ICONS = {
  'New': Sparkles,
  'Assigned': UserCheck,
  'First Contact Needed': PhoneCall,
  'Attempted Contact': PhoneMissed,
  'Connected': Handshake,
  'Following Up': Repeat,
  'Registered for Weekend': CalendarCheck,
  'Attended Weekend': PartyPopper,
  'Ongoing Champion': Heart,
  'Inactive': CircleOff,
};

// Standardized Relationship Status badge — same color, icon, size, and shape everywhere.
export default function RelationshipStatusBadge({ status }) {
  if (!status) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const Icon = STATUS_ICONS[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        RELATIONSHIP_STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'
      }`}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {status}
    </span>
  );
}
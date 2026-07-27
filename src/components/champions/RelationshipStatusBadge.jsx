import React from 'react';
import {
  Sparkles, UserCheck, PhoneCall, PhoneMissed, Handshake, Repeat,
  CalendarCheck, PartyPopper, Heart, CircleOff,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { RELATIONSHIP_STATUS_VARIANTS } from '@/lib/config';

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

// Standardized Relationship Status badge — delegates to the shared StatusBadge
// so color, size, radius, and icon placement stay consistent everywhere.
export default function RelationshipStatusBadge({ status }) {
  if (!status) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <StatusBadge variant={RELATIONSHIP_STATUS_VARIANTS[status] || 'neutral'} icon={STATUS_ICONS[status]}>
      {status}
    </StatusBadge>
  );
}
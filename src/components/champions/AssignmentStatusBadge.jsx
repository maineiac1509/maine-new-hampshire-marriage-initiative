import React from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { UserCheck, UserPlus, Archive } from 'lucide-react';

const META = {
  assigned: { label: 'Assigned', variant: 'success', icon: UserCheck },
  unassigned: { label: 'Needs Assignment', variant: 'warning', icon: UserPlus },
  ended: { label: 'Stewardship Ended', variant: 'neutral', icon: Archive },
};

export default function AssignmentStatusBadge({ status }) {
  const m = META[status] || META.unassigned;
  return <StatusBadge variant={m.variant} icon={m.icon}>{m.label}</StatusBadge>;
}
import { ShieldCheck, HandHelping } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';

const MAP = {
  admin: { variant: 'info', icon: ShieldCheck, label: 'Administrator' },
  volunteer: { variant: 'success', icon: HandHelping, label: 'Volunteer' },
};

export default function RoleBadge({ role }) {
  const cfg = MAP[role] || MAP.volunteer;
  return (
    <StatusBadge variant={cfg.variant} icon={cfg.icon}>{cfg.label}</StatusBadge>
  );
}
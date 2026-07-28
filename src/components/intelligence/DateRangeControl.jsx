import React from 'react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { CalendarRange } from 'lucide-react';

const OPTIONS = [
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: 'ytd', label: 'This Year' },
  { value: 'all', label: 'All Time' },
];

// Dashboard-wide date range selector. All widgets recompute together.
export default function DateRangeControl({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <CalendarRange className="h-4 w-4 text-muted-foreground" />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
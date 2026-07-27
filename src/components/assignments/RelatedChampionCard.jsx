import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RelationshipStatusBadge from '@/components/champions/RelationshipStatusBadge';
import { lastActivityDate, nextFollowUpDate, householdIndicator } from '@/lib/championUtils';
import { fmtDate, householdDisplay } from '@/lib/teamUtils';
import AssignmentSection from './AssignmentSection';

export default function RelatedChampionCard({ champion, activities }) {
  const acts = activities || [];
  const ind = householdIndicator(acts);
  return (
    <AssignmentSection icon={Home} title="Related Champion">
      {!champion ? (
        <p className="text-sm text-muted-foreground">Champion record not found.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium">{householdDisplay(champion)}</p>
              {champion.area && <p className="text-xs text-muted-foreground">{champion.area}</p>}
            </div>
            <RelationshipStatusBadge status={champion.relationship_status} />
          </div>
          <dl className="grid grid-cols-2 gap-4 border-t pt-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Last Contact</dt>
              <dd className="text-sm text-foreground">{fmtDate(lastActivityDate(acts))}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Follow-Up Due</dt>
              <dd className="text-sm text-foreground">{fmtDate(nextFollowUpDate(acts))}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">Follow-up status: {ind.label}</p>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/champions/${champion.id}`}>Open Champion Profile <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      )}
    </AssignmentSection>
  );
}
import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const EMPTY = {
  team_name: '',
  family_name: '',
  address: '',
  city: '',
  state: '',
  zip_code: '',
  travel_radius_miles: 25,
  target_capacity: 12,
  ministry_notes: '',
  coverage_regions: '',
  coverage_notes: '',
};

// Create dialog for a new Volunteer Team.
export default function TeamFormDialog({ open, onOpenChange, onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setError('');
    }
  }, [open]);

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSave() {
    if (!form.team_name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const created = await base44.entities.VolunteerTeam.create({
        ...form,
        travel_radius_miles: Number(form.travel_radius_miles) || 25,
        active: true,
      });
      onOpenChange(false);
      onCreated?.(created);
    } catch (e) {
      setError('Could not create the Relationship Builder. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create MC Relationship Builder</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input value={form.team_name} onChange={(e) => setField('team_name', e.target.value)} placeholder="e.g. Smith Relationship Builder" />
          </div>
          <div className="space-y-1">
            <Label>Family Name</Label>
            <Input value={form.family_name} onChange={(e) => setField('family_name', e.target.value)} placeholder="Optional" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Street Address</Label>
              <Input value={form.address} onChange={(e) => setField('address', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => setField('city', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>State</Label>
              <Input value={form.state} onChange={(e) => setField('state', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>ZIP Code</Label>
              <Input value={form.zip_code} onChange={(e) => setField('zip_code', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Travel Radius (miles)</Label>
              <Input type="number" value={form.travel_radius_miles} onChange={(e) => setField('travel_radius_miles', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Target Champion Capacity</Label>
              <Input type="number" value={form.target_capacity} onChange={(e) => setField('target_capacity', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Ministry Notes</Label>
            <Textarea value={form.ministry_notes} onChange={(e) => setField('ministry_notes', e.target.value)} rows={3} />
          </div>
          <div className="space-y-1">
            <Label>Counties / Regions Served</Label>
            <Input value={form.coverage_regions} onChange={(e) => setField('coverage_regions', e.target.value)} placeholder="e.g. Androscoggin, Cumberland" />
          </div>
          <div className="space-y-1">
            <Label>Coverage Notes</Label>
            <Textarea value={form.coverage_notes} onChange={(e) => setField('coverage_notes', e.target.value)} rows={2} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Create Relationship Builder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
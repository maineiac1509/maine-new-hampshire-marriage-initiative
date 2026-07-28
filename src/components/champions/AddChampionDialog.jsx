import React, { useState } from 'react';
import { UserPlus, Loader2, Plus, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  STATUS_OPTIONS, REGISTRATION_TYPE_OPTIONS, RELATIONSHIP_STATUS_OPTIONS,
} from '@/lib/config';

const RELATIONSHIP_OPTIONS = ['Primary', 'Spouse', 'Member'];

const EMPTY_MEMBER = { first_name: '', last_name: '', email: '', mobile_phone: '', relationship: 'Primary' };

const EMPTY_HOUSEHOLD = {
  household_name: '', address: '', city: '', state: '', zip_code: '', home_phone: '', email: '',
  area: '', registration_date: '', registration_type: 'Couple', status: 'New',
  relationship_status: 'New', group_name: '', assigned_volunteer: '',
  assigned_director: '', notes: '',
};

function todayISO() { return new Date().toISOString().slice(0, 10); }

export default function AddChampionDialog({ open, onOpenChange, onCreated }) {
  const [household, setHousehold] = useState(EMPTY_HOUSEHOLD);
  const [members, setMembers] = useState([{ ...EMPTY_MEMBER }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setHousehold({ ...EMPTY_HOUSEHOLD, registration_date: todayISO() });
    setMembers([{ ...EMPTY_MEMBER }]);
    setError('');
  }

  function handleClose(open) {
    if (!open) reset();
    onOpenChange(open);
  }

  function updateHousehold(field, value) {
    setHousehold((h) => ({ ...h, [field]: value }));
  }

  function updateMember(idx, field, value) {
    setMembers((ms) => ms.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
  }

  function addMember() {
    setMembers((ms) => [...ms, { ...EMPTY_MEMBER, relationship: 'Member' }]);
  }

  function removeMember(idx) {
    setMembers((ms) => ms.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!members.some((m) => m.first_name.trim() || m.last_name.trim())) {
      setError('At least one contact name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const hh = { ...household };
      if (!hh.registration_date) hh.registration_date = todayISO();
      // Derive household name if missing.
      if (!hh.household_name.trim()) {
        const m = members.find((x) => x.last_name.trim());
        hh.household_name = m ? `${m.last_name.trim()} Household` : 'Household';
      }
      const created = await base44.entities.ChampionHousehold.create(hh);
      const memberRecords = members
        .filter((m) => m.first_name.trim() || m.last_name.trim())
        .map((m) => ({
          household_id: created.id,
          first_name: m.first_name.trim(),
          last_name: m.last_name.trim(),
          email: m.email.trim(),
          mobile_phone: m.mobile_phone.trim(),
          relationship: m.relationship || 'Member',
        }));
      if (memberRecords.length) await base44.entities.HouseholdMember.bulkCreate(memberRecords);
      onCreated?.(created);
      handleClose(false);
    } catch (err) {
      setError(err?.message || 'Could not create the champion.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Add Marriage Champion
          </DialogTitle>
          <DialogDescription>
            Create a single Champion household with its contact members.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Household details */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Household</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="hh-name">Household Name</Label>
                <Input id="hh-name" value={household.household_name} onChange={(e) => updateHousehold('household_name', e.target.value)} placeholder="Auto-derived from last name if blank" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="hh-address">Street Address</Label>
                <Input id="hh-address" value={household.address} onChange={(e) => updateHousehold('address', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hh-city">City</Label>
                <Input id="hh-city" value={household.city} onChange={(e) => updateHousehold('city', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hh-state">State</Label>
                <Input id="hh-state" value={household.state} onChange={(e) => updateHousehold('state', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hh-zip">Zip Code</Label>
                <Input id="hh-zip" value={household.zip_code} onChange={(e) => updateHousehold('zip_code', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hh-area">Area</Label>
                <Input id="hh-area" value={household.area} onChange={(e) => updateHousehold('area', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hh-home-phone">Home Phone</Label>
                <Input id="hh-home-phone" value={household.home_phone} onChange={(e) => updateHousehold('home_phone', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hh-email">Email</Label>
                <Input id="hh-email" type="email" value={household.email} onChange={(e) => updateHousehold('email', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hh-reg-date">Registration Date</Label>
                <Input id="hh-reg-date" type="date" value={household.registration_date} onChange={(e) => updateHousehold('registration_date', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Registration Type</Label>
                <Select value={household.registration_type} onValueChange={(v) => updateHousehold('registration_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REGISTRATION_TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={household.status} onValueChange={(v) => updateHousehold('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Relationship Status</Label>
                <Select value={household.relationship_status} onValueChange={(v) => updateHousehold('relationship_status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="hh-group">Group Name</Label>
                <Input id="hh-group" value={household.group_name} onChange={(e) => updateHousehold('group_name', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hh-volunteer">Assigned Volunteer</Label>
                <Input id="hh-volunteer" value={household.assigned_volunteer} onChange={(e) => updateHousehold('assigned_volunteer', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hh-director">Assigned Director</Label>
                <Input id="hh-director" value={household.assigned_director} onChange={(e) => updateHousehold('assigned_director', e.target.value)} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="hh-notes">Notes</Label>
                <Input id="hh-notes" value={household.notes} onChange={(e) => updateHousehold('notes', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Contact members */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact Members</p>
              <Button type="button" variant="outline" size="sm" onClick={addMember}>
                <Plus className="h-4 w-4" /> Add Member
              </Button>
            </div>
            <div className="space-y-3">
              {members.map((m, idx) => (
                <div key={idx} className="rounded-lg border bg-muted/30 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Member {idx + 1}</span>
                    {members.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeMember(idx)} aria-label="Remove member">
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>First Name</Label>
                      <Input value={m.first_name} onChange={(e) => updateMember(idx, 'first_name', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Last Name</Label>
                      <Input value={m.last_name} onChange={(e) => updateMember(idx, 'last_name', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Email</Label>
                      <Input type="email" value={m.email} onChange={(e) => updateMember(idx, 'email', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Mobile Phone</Label>
                      <Input value={m.mobile_phone} onChange={(e) => updateMember(idx, 'mobile_phone', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Relationship</Label>
                      <Select value={m.relationship} onValueChange={(v) => updateMember(idx, 'relationship', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RELATIONSHIP_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {saving ? 'Creating…' : 'Add Champion'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
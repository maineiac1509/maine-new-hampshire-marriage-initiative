import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { Brain, Loader2, RotateCcw, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CONFIG_GROUPS, DEFAULT_CONFIG_VALUES, FIELD_DEFS, validateConfig,
} from '@/lib/intelligenceConfigSchema';
import IntelligenceConfigAuditLog from '@/components/admin/IntelligenceConfigAuditLog';

function valueOrDefault(record, fieldKey) {
  const v = record?.[fieldKey];
  return v === undefined || v === null || v === '' ? DEFAULT_CONFIG_VALUES[fieldKey] : v;
}

export default function IntelligenceConfigSection() {
  const { toast } = useToast();
  const [configId, setConfigId] = useState(null);
  const [values, setValues] = useState({ ...DEFAULT_CONFIG_VALUES });
  const [original, setOriginal] = useState({ ...DEFAULT_CONFIG_VALUES });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [auditKey, setAuditKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let recs = [];
      try { recs = await base44.entities.MinistryIntelligenceConfig.list(); } catch (e) {}
      let record = (recs && recs[0]) || null;
      // If no configuration exists, automatically initialize with defaults.
      if (!record) {
        try {
          record = await base44.entities.MinistryIntelligenceConfig.create({ ...DEFAULT_CONFIG_VALUES });
        } catch (e) { record = null; }
      }
      const vals = {};
      Object.keys(DEFAULT_CONFIG_VALUES).forEach((k) => { vals[k] = valueOrDefault(record, k); });
      setConfigId(record?.id || null);
      setValues(vals);
      setOriginal(vals);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleChange(fieldKey, raw) {
    const next = { ...values, [fieldKey]: raw };
    setValues(next);
    setErrors(validateConfig(next));
  }

  const dirty = useMemo(() => Object.keys(values).some((k) => Number(values[k]) !== Number(original[k])), [values, original]);

  async function writeAudit(changes, action) {
    const me = await base44.auth.me().catch(() => null);
    const changedBy = me?.full_name || me?.email || 'Administrator';
    const date = new Date().toISOString();
    const records = changes.map((c) => ({
      field_name: c.key,
      field_label: FIELD_DEFS[c.key]?.label || c.key,
      previous_value: String(c.prev),
      new_value: String(c.next),
      changed_by: changedBy,
      change_date: date,
      action,
    }));
    if (records.length) {
      try { await base44.entities.IntelligenceConfigAudit.bulkCreate(records); } catch (e) {}
    }
    setAuditKey((k) => k + 1);
  }

  async function handleSave() {
    const errs = validateConfig(values);
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast({ title: 'Validation error', description: 'Please correct the highlighted fields before saving.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const changes = Object.keys(values)
        .filter((k) => Number(values[k]) !== Number(original[k]))
        .map((k) => ({ key: k, prev: original[k], next: Number(values[k]) }));
      const payload = { ...values, updated_by: (await base44.auth.me().catch(() => ({})))?.full_name || 'Administrator', last_updated: new Date().toISOString().slice(0, 10) };
      if (configId) {
        await base44.entities.MinistryIntelligenceConfig.update(configId, payload);
      } else {
        const created = await base44.entities.MinistryIntelligenceConfig.create(payload);
        setConfigId(created.id);
      }
      await writeAudit(changes, 'Updated');
      setOriginal({ ...values });
      toast({ title: 'Configuration saved', description: changes.length ? `${changes.length} threshold(s) updated.` : 'No changes to save.' });
    } catch (e) {
      toast({ title: 'Save failed', description: 'Could not persist configuration.', variant: 'destructive' });
    } finally { setSaving(false); }
  }

  async function handleResetConfirm() {
    setResetOpen(false);
    setSaving(true);
    try {
      const defaults = { ...DEFAULT_CONFIG_VALUES };
      const changes = Object.keys(defaults)
        .filter((k) => Number(values[k]) !== Number(defaults[k]))
        .map((k) => ({ key: k, prev: values[k], next: defaults[k] }));
      const payload = { ...defaults, updated_by: (await base44.auth.me().catch(() => ({})))?.full_name || 'Administrator', last_updated: new Date().toISOString().slice(0, 10) };
      if (configId) {
        await base44.entities.MinistryIntelligenceConfig.update(configId, payload);
      } else {
        const created = await base44.entities.MinistryIntelligenceConfig.create(payload);
        setConfigId(created.id);
      }
      await writeAudit(changes, 'Reset to Defaults');
      setValues(defaults);
      setOriginal(defaults);
      setErrors({});
      toast({ title: 'Reset to defaults', description: 'All thresholds restored to recommended values.' });
    } catch (e) {
      toast({ title: 'Reset failed', description: 'Could not reset configuration.', variant: 'destructive' });
    } finally { setSaving(false); }
  }

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
            <Brain className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Ministry Intelligence Engine</h2>
            <p className="text-sm text-muted-foreground">Ministry policy thresholds that drive leadership Ministry Signals. Changes take effect on the next signal generation.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setResetOpen(true)} disabled={saving || loading}>
            <RotateCcw className="h-4 w-4" /> Reset to Defaults
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || loading || !dirty || Object.keys(errors).length > 0}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Changes
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="mt-4 space-y-5">
          {CONFIG_GROUPS.map((group) => (
            <div key={group.key} className="rounded-lg border p-4">
              <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.fields.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label htmlFor={f.key} className="text-xs font-medium">
                      {f.label}{f.unit ? ` (${f.unit})` : ''}
                    </Label>
                    <Input
                      id={f.key}
                      type="number"
                      inputMode="numeric"
                      min={f.min}
                      max={f.max}
                      value={values[f.key]}
                      onChange={(e) => handleChange(f.key, e.target.value)}
                      className={cn(errors[f.key] && 'border-destructive')}
                    />
                    {errors[f.key] ? (
                      <p className="text-xs font-medium text-destructive">{errors[f.key]}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">{f.help}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <IntelligenceConfigAuditLog refreshKey={auditKey} />

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to recommended defaults?</AlertDialogTitle>
            <AlertDialogDescription>
              This restores all Ministry Intelligence thresholds to their recommended default values. The change is recorded in the audit history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetConfirm}>Reset to Defaults</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
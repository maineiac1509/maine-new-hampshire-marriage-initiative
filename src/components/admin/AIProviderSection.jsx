import React, { useState } from 'react';
import { Server, Save, Loader2, CheckCircle2, AlertCircle, MinusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AVAILABLE_PROVIDERS, AVAILABLE_MODELS } from '@/lib/ministryCoachConfig';

function HealthIndicator({ testResult }) {
  if (!testResult) {
    return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><MinusCircle className="h-3.5 w-3.5" /> Not tested</span>;
  }
  if (testResult.success) {
    return <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Healthy</span>;
  }
  return <span className="inline-flex items-center gap-1.5 text-xs text-red-600"><AlertCircle className="h-3.5 w-3.5" /> Unhealthy</span>;
}

export default function AIProviderSection({ config, onUpdate, testResult }) {
  const [provider, setProvider] = useState(config.provider || 'base44');
  const [model, setModel] = useState(config.model || 'automatic');
  const [endpoint, setEndpoint] = useState(config.endpoint || '');
  const [saving, setSaving] = useState(false);

  const dirty = provider !== (config.provider || 'base44')
    || model !== (config.model || 'automatic')
    || endpoint !== (config.endpoint || '');
  const isBase44 = provider === 'base44';

  const handleSave = async () => {
    setSaving(true);
    await onUpdate({ provider, model, endpoint });
    setSaving(false);
  };

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
            <Server className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">AI Provider</h2>
            <p className="text-sm text-muted-foreground">Configure the underlying AI service.</p>
          </div>
        </div>
        <HealthIndicator testResult={testResult} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Provider</Label>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {AVAILABLE_PROVIDERS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{AVAILABLE_PROVIDERS.find((p) => p.value === provider)?.description}</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Model</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {AVAILABLE_MODELS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">API Key</Label>
          {isBase44 ? (
            <div className="flex h-9 items-center rounded-md border border-input bg-muted/30 px-3 text-xs text-muted-foreground">
              No API key required — uses built-in Base44 integration.
            </div>
          ) : (
            <Input type="password" placeholder="Enter API key" value="" readOnly />
          )}
          <p className="text-xs text-muted-foreground">{isBase44 ? 'Credentials are managed by the platform.' : 'API keys are securely stored and never displayed after saving.'}</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Endpoint (optional)</Label>
          <Input
            placeholder={isBase44 ? 'Not required for Base44' : 'https://api.example.com/v1'}
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            disabled={isBase44}
          />
          <p className="text-xs text-muted-foreground">Custom endpoint for providers that require it.</p>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Provider Settings
        </Button>
      </div>
    </section>
  );
}
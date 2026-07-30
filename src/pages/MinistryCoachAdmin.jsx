import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { PageHeader } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/use-toast';
import { loadAIConfig, saveAIConfig } from '@/lib/ministryCoachConfig';
import MinistryCoachStatusSection from '@/components/admin/MinistryCoachStatusSection';
import CapabilityManagementSection from '@/components/admin/CapabilityManagementSection';
import AIProviderSection from '@/components/admin/AIProviderSection';
import TestConnectionSection from '@/components/admin/TestConnectionSection';
import VersionInfoSection from '@/components/admin/VersionInfoSection';
import OperationalInfoSection from '@/components/admin/OperationalInfoSection';
import PrivacySafetySection from '@/components/admin/PrivacySafetySection';

export default function MinistryCoachAdmin() {
  const { toast } = useToast();
  const [config, setConfig] = useState(null);
  const [configId, setConfigId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { id, config: loaded } = await loadAIConfig();
    setConfigId(id);
    setConfig(loaded);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpdate = useCallback(async (updates) => {
    const prevConfig = config;
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    try {
      const newId = await saveAIConfig(configId, updates);
      if (newId && !configId) setConfigId(newId);
      toast({ title: 'Settings saved' });
    } catch (error) {
      setConfig(prevConfig);
      toast({ title: 'Save failed', description: 'Could not save configuration.', variant: 'destructive' });
    }
  }, [config, configId, toast]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    try {
      const res = await base44.functions.invoke('testMinistryCoach', {});
      setTestResult(res.data || res);
    } catch (err) {
      const errData = err?.response?.data;
      setTestResult({ success: false, message: errData?.message || 'Connection test failed unexpectedly.' });
    } finally {
      setTesting(false);
    }
  }, []);

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/administration" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Administration
      </Link>
      <PageHeader
        title="Ministry Coach"
        subtitle="AI provider configuration, capability management, and operational health."
      />
      <MinistryCoachStatusSection config={config} onUpdate={handleUpdate} />
      <CapabilityManagementSection config={config} onUpdate={handleUpdate} />
      <AIProviderSection config={config} onUpdate={handleUpdate} testResult={testResult} />
      <TestConnectionSection config={config} onTest={handleTest} testResult={testResult} testing={testing} />
      <VersionInfoSection config={config} />
      <OperationalInfoSection config={config} />
      <PrivacySafetySection config={config} />
    </div>
  );
}
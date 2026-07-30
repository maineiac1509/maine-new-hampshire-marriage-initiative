import React from 'react';
import { Zap, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function TestConnectionSection({ config, onTest, testResult, testing }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <Zap className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Test Connection</h2>
          <p className="text-sm text-muted-foreground">Verify that the provider is reachable, credentials are valid, and the model is accessible.</p>
        </div>
      </div>
      <div className="mt-4">
        <Button onClick={onTest} disabled={testing || !config.ai_enabled}>
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {testing ? 'Testing…' : 'Test Ministry Coach'}
        </Button>
        {!config.ai_enabled && (
          <p className="mt-2 text-xs text-muted-foreground">Enable Ministry Coach above to run a connection test.</p>
        )}
      </div>
      {testResult && (
        <div className={cn("mt-4 rounded-lg border p-4", testResult.success ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950" : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950")}>
          <div className="flex items-start gap-2">
            {testResult.success ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
            )}
            <div className="flex-1">
              <p className={cn("text-sm font-semibold", testResult.success ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
                {testResult.success ? 'Success' : 'Connection Issue Detected'}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">{testResult.message}</p>
              {testResult.provider && (
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>Provider: {testResult.provider}</span>
                  <span>Model: {testResult.model}</span>
                  {testResult.durationMs != null && <span>Response time: {testResult.durationMs}ms</span>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
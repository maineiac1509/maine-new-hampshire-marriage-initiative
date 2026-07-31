import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Clipboard,
  ArrowRight,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ============================================================
// Import Champions Dialog — Staging-Only Flow
// ============================================================
// This dialog uploads or accepts pasted FamilyLife data and sends
// it to the processFamilyLifeImport backend function, which stages
// the data for review WITHOUT modifying any production records.
//
// On success, the user is directed to the Reconciliation Dashboard
// to review the staged batch before any changes are applied.
//
// The old flow (direct writes to ChampionHousehold / HouseholdMember)
// has been replaced — all imports must pass through the staging and
// governance pipeline.

const COLUMNS_HINT = [
  'household_name', 'first_name', 'last_name', 'email', 'mobile_phone',
  'home_phone', 'address', 'city', 'state', 'zip_code', 'church_name',
  'church_priority', 'champion_status', 'cumulative_registrations',
  'do_not_call', 'familylife_external_id',
];

function SummaryStat({ label, value, tone = 'muted' }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    red: 'bg-red-50 text-red-700',
    muted: 'bg-muted text-muted-foreground',
  };
  return (
    <div className={`rounded-lg p-2 text-center ${tones[tone] || tones.muted}`}>
      <div className="text-lg font-semibold leading-tight">{value}</div>
      <div className="text-[10px] leading-tight">{label}</div>
    </div>
  );
}

export default function ImportChampionsDialog({ open, onOpenChange, onImported }) {
  const [step, setStep] = useState('idle'); // idle | staging | done | error
  const [mode, setMode] = useState('upload');
  const [pasteText, setPasteText] = useState('');
  const [sourcePeriod, setSourcePeriod] = useState(String(new Date().getFullYear()));
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef(null);
  const navigate = useNavigate();

  function reset() {
    setStep('idle');
    setMode('upload');
    setPasteText('');
    setFileName('');
    setResult(null);
    setErrorMsg('');
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleClose(open) {
    if (!open) reset();
    onOpenChange(open);
  }

  // Stage the import via the backend function. No production writes.
  async function stageImport(payload) {
    setStep('staging');
    setErrorMsg('');
    try {
      const res = await base44.functions.invoke('processFamilyLifeImport', payload);
      const data = res.data || res;
      if (data.error) throw new Error(data.error);
      setResult(data);
      setStep('done');
      onImported?.();
    } catch (err) {
      setErrorMsg(err?.response?.data?.error || err?.message || 'Staging failed.');
      setStep('error');
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setStep('staging');
    setErrorMsg('');
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await stageImport({
        mode: 'file',
        file_url,
        file_name: file.name,
        file_size: file.size,
        file_type: file.name.split('.').pop()?.toLowerCase() || 'unknown',
        source_period: sourcePeriod || undefined,
      });
    } catch (err) {
      setErrorMsg(err?.message || 'Could not upload the file.');
      setStep('error');
    }
  }

  function handlePasteImport() {
    if (!pasteText.trim()) return;
    setFileName('pasted data');
    stageImport({
      mode: 'paste',
      file_name: `pasted-${Date.now()}.tsv`,
      file_type: 'pasted',
      raw_text: pasteText,
      source_period: sourcePeriod || undefined,
    });
  }

  function handleReview() {
    if (result?.batch_id) navigate(`/imports/familylife/${result.batch_id}`);
    handleClose(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import FamilyLife Data
          </DialogTitle>
          <DialogDescription>
            Stage a FamilyLife export for review. Nothing is applied to your champions
            until you approve it in the Reconciliation Dashboard.
          </DialogDescription>
        </DialogHeader>

        {/* Idle — input */}
        {step === 'idle' && (
          <div className="space-y-4">
            {/* Source period */}
            <div>
              <Label htmlFor="source-period">Source Period / Year</Label>
              <Input
                id="source-period"
                value={sourcePeriod}
                onChange={(e) => setSourcePeriod(e.target.value)}
                placeholder="e.g. 2025 or 2025-Q3"
                className="mt-1"
              />
            </div>

            {/* Mode tabs */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('upload')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${mode === 'upload' ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
              >
                <Upload className="h-4 w-4" /> Upload File
              </button>
              <button
                type="button"
                onClick={() => setMode('paste')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${mode === 'paste' ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
              >
                <Clipboard className="h-4 w-4" /> Paste Data
              </button>
            </div>

            {mode === 'upload' && (
              <>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/30 p-10 text-center transition-colors hover:bg-muted/50"
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Click to choose a file</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Supports .csv, .xlsx, and .xls files
                    </p>
                  </div>
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFile}
                />
              </>
            )}

            {mode === 'paste' && (
              <>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={'FamilyLife ID\tHousehold\tFirst Name\tLast Name\tEmail\tMobile\tCity\tState\tZip\tChurch Name\tChurch Priority\tChampion Status\tCumulative Registrations\tDo Not Call\nFL-001\tSmith Family\tJohn\tSmith\tjohn@example.com\t555-0100\tBoston\tMA\t02115\tGrace Church\tHigh\tActive\t3\tNo'}
                  rows={8}
                  className="w-full rounded-lg border bg-background p-3 font-mono text-xs"
                />
                <Button onClick={handlePasteImport} disabled={!pasteText.trim()} className="w-full">
                  Stage Pasted Data
                </Button>
              </>
            )}

            <details className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium">Expected columns</summary>
              <p className="mt-2">{COLUMNS_HINT.join(', ')}</p>
              <p className="mt-2">
                Rows with the same <strong>Household</strong> value (or the same
                FamilyLife ID) are grouped into one household with multiple contacts.
              </p>
            </details>
          </div>
        )}

        {/* Staging */}
        {step === 'staging' && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium">Staging import…</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Parsing, normalizing, matching against existing champions, and comparing
              field-by-field. This may take a moment for large files.
            </p>
          </div>
        )}

        {/* Done — staged successfully */}
        {step === 'done' && result && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="text-sm font-medium">Import staged for review</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                <strong>{fileName}</strong> has been staged with {result.summary?.fields_imported ? Object.keys(result.summary.fields_imported).length : 0}{' '}
                field types. No production records were modified.
              </p>
            </div>

            {result.is_possible_duplicate && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                <p className="font-medium">Possible duplicate detected</p>
                <p className="mt-1">
                  A prior batch with the same content signature already exists.
                  You can still review this batch, but check the original first.
                </p>
              </div>
            )}

            <div className="flex items-center justify-center">
              <Button onClick={handleReview}>
                Review Staged Import <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <p className="text-sm font-medium">Staging failed</p>
            <p className="max-w-sm text-xs text-muted-foreground">{errorMsg}</p>
          </div>
        )}

        <DialogFooter>
          {step === 'idle' && (
            <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
          )}
          {(step === 'done' || step === 'error') && (
            <div className="flex w-full justify-between gap-2">
              <Button variant="outline" onClick={() => reset()}>
                {step === 'done' ? 'Import Another' : 'Try Again'}
              </Button>
              <Button variant="ghost" onClick={() => handleClose(false)}>Close</Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
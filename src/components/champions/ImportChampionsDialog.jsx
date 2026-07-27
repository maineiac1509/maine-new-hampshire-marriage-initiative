import React, { useState, useRef } from 'react';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Clipboard,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

// Schema describing a single Marriage Champion record — the extractor returns a list of these.
const CHAMPION_SCHEMA = {
  type: 'object',
  properties: {
    first_name: { type: 'string' },
    last_name: { type: 'string' },
    address: { type: 'string' },
    city: { type: 'string' },
    state: { type: 'string' },
    zip_code: { type: 'string' },
    home_phone: { type: 'string' },
    mobile_phone: { type: 'string' },
    email: { type: 'string' },
    registration_date: { type: 'string' },
    registration_type: { type: 'string' },
    group_name: { type: 'string' },
    area: { type: 'string' },
    status: { type: 'string' },
    assigned_volunteer: { type: 'string' },
    assigned_director: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['first_name', 'last_name'],
};

const COLUMNS = [
  'first_name', 'last_name', 'email', 'mobile_phone', 'home_phone',
  'address', 'city', 'state', 'zip_code', 'area', 'status',
  'registration_date', 'registration_type', 'group_name',
  'assigned_volunteer', 'assigned_director', 'notes',
];

function normalizeOutput(output) {
  if (!output) return [];
  if (Array.isArray(output)) return output;
  if (typeof output === 'object') {
    const nested = Object.values(output).find((v) => Array.isArray(v));
    return nested || [output];
  }
  return [];
}

// Maps common spreadsheet column headers to entity field keys.
const HEADER_MAP = {
  first_name: ['first name', 'firstname', 'first', 'fname', 'given name'],
  last_name: ['last name', 'lastname', 'last', 'lname', 'surname', 'family name'],
  email: ['email', 'e-mail', 'email address', 'e-mail address'],
  mobile_phone: ['mobile phone', 'mobile', 'cell', 'cell phone', 'cellphone', 'mobile number'],
  home_phone: ['home phone', 'home', 'home number', 'phone', 'phone number', 'telephone'],
  address: ['address', 'street', 'street address', 'address 1', 'address1'],
  city: ['city', 'town'],
  state: ['state', 'st', 'province'],
  zip_code: ['zip', 'zip code', 'zip/postal', 'postal', 'postal code', 'postcode'],
  area: ['area', 'region', 'territory'],
  status: ['status'],
  registration_date: ['registration date', 'reg date', 'registration', 'date registered', 'registered'],
  registration_type: ['registration type', 'reg type', 'type'],
  group_name: ['group', 'group name', 'groupname', 'small group'],
  assigned_volunteer: ['assigned volunteer', 'volunteer', 'volunteer name'],
  assigned_director: ['assigned director', 'director', 'director name'],
  notes: ['notes', 'note', 'comments', 'comment'],
};

const POSITIONAL_FALLBACK = [
  'first_name', 'last_name', 'email', 'mobile_phone', 'home_phone',
  'address', 'city', 'state', 'zip_code', 'area', 'status',
  'registration_date', 'registration_type', 'group_name',
  'assigned_volunteer', 'assigned_director', 'notes',
];

function mapHeader(header) {
  const h = (header || '').trim().toLowerCase();
  for (const [field, variants] of Object.entries(HEADER_MAP)) {
    if (variants.includes(h)) return field;
  }
  return null;
}

// Parses tab-separated pasted data (as copied from Excel / Google Sheets).
function parsePastedData(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (!lines.length) return [];
  const rows = lines.map((l) => l.split('\t'));
  const mappedHeaders = rows[0].map(mapHeader);
  const hasHeaderRow = mappedHeaders.some((h) => h !== null);
  // If no recognizable headers, treat the first row as data and map positionally.
  const headers = hasHeaderRow
    ? mappedHeaders
    : rows[0].map((_, idx) => POSITIONAL_FALLBACK[idx] || null);
  const startIdx = hasHeaderRow ? 1 : 0;
  const records = [];
  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    const rec = {};
    headers.forEach((field, idx) => {
      if (field && row[idx] != null && row[idx].trim() !== '') {
        rec[field] = row[idx].trim();
      }
    });
    if (rec.first_name || rec.last_name) records.push(rec);
  }
  return records;
}

export default function ImportChampionsDialog({ open, onOpenChange, onImported }) {
  const [step, setStep] = useState('idle'); // idle | uploading | preview | importing | done | error
  const [records, setRecords] = useState([]);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [mode, setMode] = useState('upload'); // upload | paste
  const [pasteText, setPasteText] = useState('');
  const inputRef = useRef(null);

  function reset() {
    setStep('idle');
    setRecords([]);
    setFileName('');
    setResult(null);
    setErrorMsg('');
    setPasteText('');
    setMode('upload');
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleParse() {
    setErrorMsg('');
    try {
      const parsed = parsePastedData(pasteText);
      if (!parsed.length) {
        throw new Error(
          'No records found. Include a header row (e.g. First Name, Last Name, Email) and paste one champion per line.'
        );
      }
      setRecords(parsed);
      setFileName('pasted data');
      setStep('preview');
    } catch (err) {
      setErrorMsg(err?.message || 'Could not parse the pasted data.');
      setStep('error');
    }
  }

  function handleClose(open) {
    if (!open) reset();
    onOpenChange(open);
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setStep('uploading');
    setErrorMsg('');
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setStep('extracting');
      const res = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: CHAMPION_SCHEMA,
      });
      if (res?.status === 'error') {
        throw new Error(res.details || 'Could not read the file.');
      }
      const parsed = normalizeOutput(res?.output).filter(
        (r) => r && (r.first_name || r.last_name)
      );
      if (!parsed.length) {
        throw new Error('No champion records were found in the file.');
      }
      setRecords(parsed);
      setStep('preview');
    } catch (err) {
      setErrorMsg(err?.message || 'Something went wrong reading the file.');
      setStep('error');
    }
  }

  async function handleImport() {
    setStep('importing');
    try {
      const created = await base44.entities.MarriageChampion.bulkCreate(records);
      setResult({ count: Array.isArray(created) ? created.length : records.length });
      setStep('done');
      onImported?.();
    } catch (err) {
      setErrorMsg(err?.message || 'Could not import the records.');
      setStep('error');
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Marriage Champions
          </DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file. Columns are automatically mapped to champion fields.
          </DialogDescription>
        </DialogHeader>

        {/* Idle / upload / extract */}
        {(step === 'idle' || step === 'uploading' || step === 'extracting') && (
          <div className="space-y-4">
            {step === 'idle' && (
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
            )}

            {mode === 'upload' && (
              <>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={step !== 'idle'}
                  className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/30 p-10 text-center transition-colors hover:bg-muted/50 disabled:opacity-60"
                >
                  {step === 'idle' ? (
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  ) : (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {step === 'idle' ? 'Click to choose a file' :
                        step === 'uploading' ? 'Uploading file…' : 'Reading records…'}
                    </p>
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

            {mode === 'paste' && step === 'idle' && (
              <>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={'First Name\tLast Name\tEmail\tCity\nJohn\tSmith\tjohn@example.com\tBoston'}
                  rows={8}
                  className="w-full rounded-lg border bg-background p-3 font-mono text-xs"
                />
                <Button onClick={handleParse} disabled={!pasteText.trim()} className="w-full">
                  Parse Pasted Data
                </Button>
              </>
            )}

            <details className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium">Expected columns</summary>
              <p className="mt-2">{COLUMNS.join(', ')}</p>
              <p className="mt-2">
                Column headers like “First Name”, “Phone”, or “City” are recognized automatically.
              </p>
              {mode === 'paste' && (
                <p className="mt-2">
                  Tip: select cells in your spreadsheet, copy, then paste here — columns are
                  tab-separated and detected automatically.
                </p>
              )}
            </details>
          </div>
        )}

        {/* Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span><strong>{records.length}</strong> records ready from <span className="text-muted-foreground">{fileName}</span></span>
            </div>
            <div className="max-h-64 overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/60 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">City</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2">{r.first_name} {r.last_name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.email || '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.city || '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {records.length > 50 && (
              <p className="text-xs text-muted-foreground">
                Showing first 50 of {records.length} records.
              </p>
            )}
          </div>
        )}

        {/* Done */}
        {step === 'done' && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <p className="text-sm font-medium">
              {result?.count} {result?.count === 1 ? 'champion' : 'champions'} imported successfully!
            </p>
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <p className="text-sm font-medium">Import failed</p>
            <p className="max-w-sm text-xs text-muted-foreground">{errorMsg}</p>
          </div>
        )}

        <DialogFooter>
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => reset()}>Cancel</Button>
              <Button onClick={handleImport} disabled={step !== 'preview'}>
                Import {records.length} {records.length === 1 ? 'record' : 'records'}
              </Button>
            </>
          )}
          {step === 'importing' && (
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing…
            </Button>
          )}
          {(step === 'done' || step === 'error') && (
            <Button variant="outline" onClick={() => handleClose(false)}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
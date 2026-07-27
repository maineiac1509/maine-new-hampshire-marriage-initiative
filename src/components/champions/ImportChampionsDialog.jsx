import React, { useState, useRef } from 'react';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Clipboard, Users,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

// Schema for the extractor — one row per person, carrying household fields too.
const CHAMPION_SCHEMA = {
  type: 'object',
  properties: {
    household_name: { type: 'string' },
    first_name: { type: 'string' },
    last_name: { type: 'string' },
    email: { type: 'string' },
    mobile_phone: { type: 'string' },
    relationship: { type: 'string' },
    home_phone: { type: 'string' },
    address: { type: 'string' },
    city: { type: 'string' },
    state: { type: 'string' },
    zip_code: { type: 'string' },
    area: { type: 'string' },
    status: { type: 'string' },
    registration_date: { type: 'string' },
    registration_type: { type: 'string' },
    group_name: { type: 'string' },
    assigned_volunteer: { type: 'string' },
    assigned_director: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['first_name', 'last_name'],
};

const HOUSEHOLD_FIELDS = [
  'household_name', 'address', 'city', 'state', 'zip_code', 'home_phone', 'area',
  'registration_date', 'registration_type', 'group_name', 'status',
  'assigned_volunteer', 'assigned_director', 'notes',
];

const COLUMNS = [
  'household_name', 'first_name', 'last_name', 'email', 'mobile_phone', 'home_phone',
  'relationship', 'address', 'city', 'state', 'zip_code', 'area', 'status',
  'registration_date', 'registration_type', 'group_name',
  'assigned_volunteer', 'assigned_director', 'notes',
];

const RELATIONSHIP_BY_INDEX = ['Primary', 'Spouse', 'Member'];

// Maps common spreadsheet column headers to entity field keys.
const HEADER_MAP = {
  household_name: ['household', 'household name', 'family', 'family name'],
  first_name: ['first name', 'firstname', 'first', 'fname', 'given name'],
  last_name: ['last name', 'lastname', 'last', 'lname', 'surname', 'family name'],
  email: ['email', 'e-mail', 'email address', 'e-mail address'],
  mobile_phone: ['mobile phone', 'mobile', 'cell', 'cell phone', 'cellphone', 'mobile number'],
  home_phone: ['home phone', 'home', 'home number', 'phone', 'phone number', 'telephone'],
  relationship: ['relationship', 'role', 'position', 'title'],
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

function normalizeOutput(output) {
  if (!output) return [];
  if (Array.isArray(output)) return output;
  if (typeof output === 'object') {
    const nested = Object.values(output).find((v) => Array.isArray(v));
    return nested || [output];
  }
  return [];
}

// Parses tab-separated pasted data (as copied from Excel / Google Sheets).
function parsePastedData(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (!lines.length) return [];
  const rows = lines.map((l) => l.split('\t'));
  const mappedHeaders = rows[0].map(mapHeader);
  const hasHeaderRow = mappedHeaders.some((h) => h !== null);
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

// Groups flat person-rows into households with their member contacts.
function buildHouseholds(rows) {
  const groups = [];
  const keyMap = new Map();
  rows.forEach((row) => {
    const name = (row.household_name || '').trim().toLowerCase();
    const ln = (row.last_name || '').trim().toLowerCase();
    const addr = (row.address || row.city || '').trim().toLowerCase();
    const key = name || `${ln}|${addr}`;
    let g = keyMap.get(key);
    if (!g) {
      g = { household: {}, members: [] };
      keyMap.set(key, g);
      groups.push(g);
    }
    // Merge household-level fields (first non-empty value wins).
    HOUSEHOLD_FIELDS.forEach((f) => {
      if (!g.household[f] && row[f]) g.household[f] = row[f];
    });
    g.members.push({
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      mobile_phone: row.mobile_phone,
      relationship: row.relationship,
    });
  });
  // Derive household name + relationships.
  groups.forEach((g) => {
    if (!g.household.household_name) {
      const ln = (g.members.find((m) => m.last_name)?.last_name || '').trim();
      g.household.household_name = ln ? `${ln} Household` : 'Household';
    }
    g.members.forEach((m, i) => {
      if (!m.relationship) m.relationship = RELATIONSHIP_BY_INDEX[i] || 'Member';
    });
  });
  return groups;
}

export default function ImportChampionsDialog({ open, onOpenChange, onImported }) {
  const [step, setStep] = useState('idle'); // idle | uploading | preview | importing | done | error
  const [households, setHouseholds] = useState([]);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [mode, setMode] = useState('upload'); // upload | paste
  const [pasteText, setPasteText] = useState('');
  const inputRef = useRef(null);

  function reset() {
    setStep('idle');
    setHouseholds([]);
    setFileName('');
    setResult(null);
    setErrorMsg('');
    setPasteText('');
    setMode('upload');
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleClose(open) {
    if (!open) reset();
    onOpenChange(open);
  }

  function applyRows(rows) {
    const parsed = rows.filter((r) => r && (r.first_name || r.last_name));
    if (!parsed.length) {
      throw new Error('No records found. Include a header row and one person per line.');
    }
    setHouseholds(buildHouseholds(parsed));
    setStep('preview');
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
      applyRows(normalizeOutput(res?.output));
    } catch (err) {
      setErrorMsg(err?.message || 'Something went wrong reading the file.');
      setStep('error');
    }
  }

  function handleParse() {
    setErrorMsg('');
    try {
      applyRows(parsePastedData(pasteText));
      setFileName('pasted data');
    } catch (err) {
      setErrorMsg(err?.message || 'Could not parse the pasted data.');
      setStep('error');
    }
  }

  async function handleImport() {
    setStep('importing');
    try {
      const createdHH = await base44.entities.ChampionHousehold.bulkCreate(
        households.map((g) => g.household)
      );
      const memberRecords = [];
      createdHH.forEach((hh, i) => {
        households[i].members.forEach((m) => {
          memberRecords.push({ ...m, household_id: hh.id });
        });
      });
      await base44.entities.HouseholdMember.bulkCreate(memberRecords);
      setResult({ households: createdHH.length, members: memberRecords.length });
      setStep('done');
      onImported?.();
    } catch (err) {
      setErrorMsg(err?.message || 'Could not import the records.');
      setStep('error');
    }
  }

  const memberCount = households.reduce((n, g) => n + g.members.length, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Champion Households
          </DialogTitle>
          <DialogDescription>
            Each row is a contact. Rows sharing a Household (or the same last name + address)
            are grouped into one household.
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
                  placeholder={'Household\tFirst Name\tLast Name\tEmail\tMobile\nSmith Family\tJohn\tSmith\tjohn@example.com\t555-0100\nSmith Family\tMary\tSmith\tmary@example.com\t555-0101'}
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
                Rows with the same <strong>Household</strong> value (or matching last name +
                address) become one household with multiple contacts.
              </p>
            </details>
          </div>
        )}

        {/* Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-emerald-500" />
              <span>
                <strong>{households.length}</strong> {households.length === 1 ? 'household' : 'households'}
                {' · '}
                <strong>{memberCount}</strong> {memberCount === 1 ? 'contact' : 'contacts'} from{' '}
                <span className="text-muted-foreground">{fileName}</span>
              </span>
            </div>
            <div className="max-h-64 overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/60 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Household</th>
                    <th className="px-3 py-2 font-medium">Contacts</th>
                    <th className="px-3 py-2 font-medium">City</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {households.slice(0, 50).map((g, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2 font-medium">{g.household.household_name}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {g.members.map((m) => `${m.first_name} ${m.last_name}`.trim()).join(', ')}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{g.household.city || '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">{g.household.status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {households.length > 50 && (
              <p className="text-xs text-muted-foreground">
                Showing first 50 of {households.length} households.
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
              {result?.households} {result?.households === 1 ? 'household' : 'households'} ({result?.members} contacts) imported successfully!
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
                Import {households.length} {households.length === 1 ? 'household' : 'households'}
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
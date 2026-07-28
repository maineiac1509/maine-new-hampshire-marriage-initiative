import React, { useState, useRef, useMemo } from 'react';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Clipboard, Users,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

// Full set of household-level fields the importer understands.
const HOUSEHOLD_FIELDS = [
  'household_name', 'address', 'address_line_2', 'city', 'state', 'zip_code',
  'home_phone', 'email', 'area', 'registration_date', 'registration_type',
  'group_name', 'status', 'champion_status',
  'church_name', 'church_city', 'church_state', 'church_zip_code',
  'church_priority', 'marriage_conference_priority',
  'do_not_call', 'do_not_text', 'email_opt_out',
  'cumulative_registrations', 'free_couple_registrations_used',
  'free_couple_registrations_available',
  'registrations_toward_next_free_registration',
  'registrations_needed_for_next_free_registration',
  'assigned_volunteer', 'assigned_director', 'notes',
];

const MEMBER_FIELDS = ['first_name', 'last_name', 'email', 'mobile_phone', 'work_phone', 'relationship'];

const COLUMNS = [
  'household_name', 'first_name', 'last_name', 'account_salutation', 'email',
  'mobile_phone', 'home_phone', 'work_phone', 'relationship',
  'address', 'address_line_2', 'city', 'state', 'zip_code', 'area', 'status',
  'champion_status', 'church_name', 'church_city', 'church_state', 'church_zip_code',
  'church_priority', 'marriage_conference_priority',
  'do_not_call', 'do_not_text', 'email_opt_out',
  'cumulative_registrations', 'free_couple_registrations_used',
  'free_couple_registrations_available',
  'registrations_toward_next_free_registration',
  'registrations_needed_for_next_free_registration',
  'registration_date', 'registration_type', 'group_name',
  'assigned_volunteer', 'assigned_director', 'notes',
];

const RELATIONSHIP_BY_INDEX = ['Primary', 'Spouse', 'Member'];

// Schema for the extractor — one row per person, carrying household fields too.
const CHAMPION_SCHEMA = {
  type: 'object',
  properties: {
    household_name: { type: 'string' },
    first_name: { type: 'string' },
    last_name: { type: 'string' },
    account_salutation: { type: 'string' },
    email: { type: 'string' },
    mobile_phone: { type: 'string' },
    home_phone: { type: 'string' },
    work_phone: { type: 'string' },
    relationship: { type: 'string' },
    address: { type: 'string' },
    address_line_2: { type: 'string' },
    city: { type: 'string' },
    state: { type: 'string' },
    zip_code: { type: 'string' },
    area: { type: 'string' },
    status: { type: 'string' },
    champion_status: { type: 'string' },
    church_name: { type: 'string' },
    church_city: { type: 'string' },
    church_state: { type: 'string' },
    church_zip_code: { type: 'string' },
    church_priority: { type: 'string' },
    marriage_conference_priority: { type: 'string' },
    do_not_call: { type: 'string' },
    do_not_text: { type: 'string' },
    email_opt_out: { type: 'string' },
    cumulative_registrations: { type: 'string' },
    free_couple_registrations_used: { type: 'string' },
    free_couple_registrations_available: { type: 'string' },
    registrations_toward_next_free_registration: { type: 'string' },
    registrations_needed_for_next_free_registration: { type: 'string' },
    registration_date: { type: 'string' },
    registration_type: { type: 'string' },
    group_name: { type: 'string' },
    assigned_volunteer: { type: 'string' },
    assigned_director: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['first_name', 'last_name'],
};

const HEADER_MAP = {
  household_name: ['household', 'household name', 'family', 'family name'],
  account_salutation: ['account salutation', 'salutation'],
  first_name: ['first name', 'firstname', 'first', 'fname', 'given name'],
  last_name: ['last name', 'lastname', 'last', 'lname', 'surname', 'family name'],
  email: ['email', 'e-mail', 'email address', 'e-mail address'],
  mobile_phone: ['mobile phone', 'mobile', 'cell', 'cell phone', 'cellphone', 'mobile number'],
  home_phone: ['home phone', 'home', 'home number', 'phone', 'phone number', 'telephone'],
  work_phone: ['work phone', 'work', 'work number', 'business phone'],
  relationship: ['relationship', 'role', 'position', 'title'],
  address: ['address', 'street', 'street address', 'address 1', 'address1'],
  address_line_2: ['address 2', 'address2', 'address line 2', 'address line two'],
  city: ['city', 'town'],
  state: ['state', 'st', 'province'],
  zip_code: ['zip', 'zip code', 'zip/postal', 'postal', 'postal code', 'postcode'],
  area: ['area', 'region', 'territory'],
  status: ['status'],
  champion_status: ['champion status', 'champion'],
  church_name: ['church name', 'church', 'home church', 'church attended'],
  church_city: ['church city'],
  church_state: ['church state'],
  church_zip_code: ['church zip', 'church zip code', 'church postal', 'church postal code'],
  church_priority: ['church priority', 'church prioritization', 'church prio'],
  marriage_conference_priority: ['marriage conference priority', 'conference priority', 'weekend priority', 'marriage priority'],
  do_not_call: ['do not call', 'dnc', 'do not call?', "don't call", 'no call'],
  do_not_text: ['do not text', 'dnt', 'do not text?', "don't text", 'no text'],
  email_opt_out: ['email opt out', 'email opt-out', 'opt out', 'opt-out', 'unsubscribe', 'email unsubscribe'],
  cumulative_registrations: ['cumulative registrations', 'cumulative', 'total registrations', 'registrations cumulative'],
  free_couple_registrations_used: ['free couple registrations used', 'free registrations used', 'free couple used', 'comp used'],
  free_couple_registrations_available: ['free couple registrations available', 'free registrations available', 'free couple available', 'comp available'],
  registrations_toward_next_free_registration: ['registrations toward next free registration', 'toward next free', 'toward next', 'registrations toward'],
  registrations_needed_for_next_free_registration: ['registrations needed for next free registration', 'needed for next free', 'needed for next', 'registrations needed'],
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

// --- value normalization for enum / boolean fields ---
const TRUTHY = new Set([
  'yes', 'y', 'true', '1', 'x', '✓', 'checked',
  'opt out', 'opt-out', 'unsubscribe', 'email opt out', 'email opt-out',
  'do not call', 'do not text', 'no call', 'no text', "don't call", "don't text",
]);

function parseBoolean(v) {
  const s = (v ?? '').toString().trim().toLowerCase();
  if (!s) return false;
  return TRUTHY.has(s);
}

function normalizePriority(v) {
  const s = (v ?? '').toString().trim().toLowerCase();
  if (['high', 'h', 'urgent'].includes(s)) return 'High';
  if (['medium', 'med', 'm', 'normal', 'mid'].includes(s)) return 'Medium';
  if (['low', 'l'].includes(s)) return 'Low';
  return null;
}

function parseNumber(v) {
  const s = (v ?? '').toString().replace(/[^0-9.-]/g, '');
  if (s === '' || s === '-' || s === '.') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normalizeChampionStatus(v) {
  const s = (v ?? '').toString().trim().toLowerCase();
  if (['active', 'a', 'current'].includes(s)) return 'Active';
  if (['inactive', 'i', 'former'].includes(s)) return 'Inactive';
  if (['prospect', 'p', 'potential', 'lead'].includes(s)) return 'Prospect';
  if (['alumni', 'alumnus', 'alum', 'past'].includes(s)) return 'Alumni';
  return null;
}

// Fields that need their values normalized before being written.
const NORMALIZERS = {
  church_priority: { fn: normalizePriority, label: 'Church Priority' },
  marriage_conference_priority: { fn: normalizePriority, label: 'Marriage Conference Priority' },
  champion_status: { fn: normalizeChampionStatus, label: 'Champion Status' },
  do_not_call: { fn: parseBoolean, label: 'Do Not Call' },
  do_not_text: { fn: parseBoolean, label: 'Do Not Text' },
  email_opt_out: { fn: parseBoolean, label: 'Email Opt Out' },
  cumulative_registrations: { fn: parseNumber, label: 'Cumulative Registrations' },
  free_couple_registrations_used: { fn: parseNumber, label: 'Free Couple Registrations Used' },
  free_couple_registrations_available: { fn: parseNumber, label: 'Free Couple Registrations Available' },
  registrations_toward_next_free_registration: { fn: parseNumber, label: 'Registrations Toward Next Free Registration' },
  registrations_needed_for_next_free_registration: { fn: parseNumber, label: 'Registrations Needed For Next Free Registration' },
};

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
// Also collects diagnostics: which fields imported, which were skipped, and
// any values that failed enum/boolean normalization.
function buildHouseholds(rows) {
  const groups = [];
  const keyMap = new Map();
  const fieldsImported = {};
  const validationErrors = [];

  // Track every non-blank value we see, so we can report coverage.
  rows.forEach((row) => {
    Object.entries(row).forEach(([f, v]) => {
      if (v != null && v.toString().trim() !== '') {
        fieldsImported[f] = (fieldsImported[f] || 0) + 1;
      }
    });
  });

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
      if (!g.household[f] && row[f] != null && row[f].toString().trim() !== '') {
        let val = row[f];
        // Normalize enum / boolean fields, capturing validation errors.
        if (NORMALIZERS[f]) {
          const resolved = NORMALIZERS[f].fn(val);
          if (resolved === null) {
            validationErrors.push({
              household: name || `${ln} household`,
              field: f,
              label: NORMALIZERS[f].label,
              value: val,
              message: `Unrecognized "${NORMALIZERS[f].label}" value — skipped.`,
            });
            return; // skip invalid value
          }
          val = resolved;
        }
        g.household[f] = val;
      }
    });
    g.members.push({
      first_name: row.account_salutation || row.first_name,
      last_name: row.last_name,
      email: row.email,
      mobile_phone: row.mobile_phone,
      work_phone: row.work_phone,
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

  // Fields in the expected set that never appeared with a value are "skipped".
  const fieldsSkipped = {};
  [...HOUSEHOLD_FIELDS, ...MEMBER_FIELDS, 'account_salutation'].forEach((f) => {
    if (!fieldsImported[f]) fieldsSkipped[f] = 'no values found in source';
  });

  return { groups, diagnostics: { fieldsImported, fieldsSkipped, validationErrors } };
}

function norm(s) { return (s || '').toString().trim().toLowerCase(); }

// Find an existing household that matches the incoming one.
// Match priority: household name → address+city → member email → member name.
function findExistingHousehold(incomingHH, incomingMembers, existingHHs, membersByHouse) {
  const inName = norm(incomingHH.household_name);
  const inAddr = `${norm(incomingHH.address)}|${norm(incomingHH.city)}`;
  const inEmails = incomingMembers.map((m) => norm(m.email)).filter(Boolean);
  const inKeys = incomingMembers
    .map((m) => `${norm(m.first_name)}|${norm(m.last_name)}`)
    .filter((k) => k !== '|');

  if (inName) {
    const m = existingHHs.find((h) => norm(h.household_name) === inName);
    if (m) return m;
  }
  if (inAddr !== '|') {
    const m = existingHHs.find((h) => `${norm(h.address)}|${norm(h.city)}` === inAddr);
    if (m) return m;
  }
  for (const h of existingHHs) {
    const ems = membersByHouse[h.id] || [];
    if (inEmails.length && ems.some((em) => inEmails.includes(norm(em.email)))) return h;
    if (inKeys.length && ems.some((em) => inKeys.includes(`${norm(em.first_name)}|${norm(em.last_name)}`))) return h;
  }
  return null;
}

// Find an existing member within a household by email, then by name.
function findExistingMember(incoming, houseMembers) {
  const inEmail = norm(incoming.email);
  if (inEmail) {
    const m = houseMembers.find((em) => norm(em.email) === inEmail);
    if (m) return m;
  }
  const inKey = `${norm(incoming.first_name)}|${norm(incoming.last_name)}`;
  if (inKey !== '|') {
    const m = houseMembers.find((em) => `${norm(em.first_name)}|${norm(em.last_name)}` === inKey);
    if (m) return m;
  }
  return null;
}

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
  const [step, setStep] = useState('idle'); // idle | uploading | extracting | preview | importing | done | error
  const [households, setHouseholds] = useState([]);
  const [diagnostics, setDiagnostics] = useState(null);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [mode, setMode] = useState('upload'); // upload | paste
  const [pasteText, setPasteText] = useState('');
  const inputRef = useRef(null);
  const [existingData, setExistingData] = useState({ households: [], membersByHouse: {}, loaded: false });
  const [dedupLoading, setDedupLoading] = useState(false);

  async function loadExistingForDedup() {
    setDedupLoading(true);
    try {
      const [existingHH, existingMembers] = await Promise.all([
        base44.entities.ChampionHousehold.list(),
        base44.entities.HouseholdMember.list(),
      ]);
      const membersByHouse = {};
      (existingMembers || []).forEach((m) => {
        (membersByHouse[m.household_id] = membersByHouse[m.household_id] || []).push(m);
      });
      setExistingData({ households: existingHH || [], membersByHouse, loaded: true });
    } catch {
      setExistingData({ households: [], membersByHouse: {}, loaded: true });
    } finally {
      setDedupLoading(false);
    }
  }

  function reset() {
    setStep('idle');
    setHouseholds([]);
    setDiagnostics(null);
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
    const { groups, diagnostics: diag } = buildHouseholds(parsed);
    setHouseholds(groups);
    setDiagnostics(diag);
    setStep('preview');
    loadExistingForDedup();
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
      // Load existing records for de-duplication.
      const [existingHH, existingMembers] = await Promise.all([
        base44.entities.ChampionHousehold.list(),
        base44.entities.HouseholdMember.list(),
      ]);
      const membersByHouse = {};
      (existingMembers || []).forEach((m) => {
        (membersByHouse[m.household_id] = membersByHouse[m.household_id] || []).push(m);
      });

      const summary = {
        householdsCreated: 0,
        householdsUpdated: 0,
        contactsCreated: 0,
        contactsUpdated: 0,
        contactsLinked: 0,
        fieldsImported: { ...(diagnostics?.fieldsImported || {}) },
        fieldsSkipped: { ...(diagnostics?.fieldsSkipped || {}) },
        validationErrors: [...(diagnostics?.validationErrors || [])],
      };

      for (const g of households) {
        const incomingHH = g.household;
        const match = findExistingHousehold(incomingHH, g.members, existingHH || [], membersByHouse);

        if (match) {
          // Update household fields that differ — import wins on mismatch.
          const hhUpdates = {};
          HOUSEHOLD_FIELDS.forEach((f) => {
            if (incomingHH[f] != null && incomingHH[f] !== '' && incomingHH[f] !== (match[f] ?? '')) {
              hhUpdates[f] = incomingHH[f];
            }
          });
          if (Object.keys(hhUpdates).length) {
            await base44.entities.ChampionHousehold.update(match.id, hhUpdates);
            summary.householdsUpdated++;
          } else {
            summary.contactsLinked++;
          }

          // Sync members: update matches, add new ones.
          const houseMembers = membersByHouse[match.id] || [];
          for (const im of g.members) {
            const em = findExistingMember(im, houseMembers);
            if (em) {
              const mUpdates = {};
              MEMBER_FIELDS.forEach((f) => {
                if (im[f] && im[f] !== (em[f] ?? '')) mUpdates[f] = im[f];
              });
              if (Object.keys(mUpdates).length) {
                await base44.entities.HouseholdMember.update(em.id, mUpdates);
                summary.contactsUpdated++;
              } else {
                summary.contactsLinked++;
              }
            } else {
              await base44.entities.HouseholdMember.create({ ...im, household_id: match.id });
              summary.contactsCreated++;
            }
          }
        } else {
          // No match — create a new household and its members.
          const created = await base44.entities.ChampionHousehold.create(incomingHH);
          summary.householdsCreated++;
          const memberRecords = g.members.map((m) => ({ ...m, household_id: created.id }));
          if (memberRecords.length) {
            await base44.entities.HouseholdMember.bulkCreate(memberRecords);
            summary.contactsCreated += memberRecords.length;
          }
        }
      }

      setResult(summary);
      setStep('done');
      onImported?.();
    } catch (err) {
      setErrorMsg(err?.message || 'Could not import the records.');
      setStep('error');
    }
  }

  const memberCount = households.reduce((n, g) => n + g.members.length, 0);

  const fieldLabel = (f) => f.replace(/_/g, ' ');

  // Compute per-household de-dup status against existing records.
  const dedup = useMemo(() => {
    if (!existingData.loaded) return { statuses: [], newCount: 0, updateCount: 0, loaded: false };
    const statuses = households.map((g) => {
      const match = findExistingHousehold(g.household, g.members, existingData.households, existingData.membersByHouse);
      if (!match) return { kind: 'new' };
      const hhChanges = HOUSEHOLD_FIELDS.filter((f) => g.household[f] != null && g.household[f] !== '' && g.household[f] !== (match[f] ?? ''));
      const houseMembers = existingData.membersByHouse[match.id] || [];
      let newMembers = 0, updatedMembers = 0;
      g.members.forEach((im) => {
        const em = findExistingMember(im, houseMembers);
        if (em) {
          if (MEMBER_FIELDS.some((f) => im[f] && im[f] !== (em[f] ?? ''))) updatedMembers++;
        } else {
          newMembers++;
        }
      });
      return { kind: 'update', hhChanges, newMembers, updatedMembers };
    });
    const newCount = statuses.filter((s) => s.kind === 'new').length;
    return { statuses, newCount, updateCount: statuses.length - newCount, loaded: true };
  }, [households, existingData]);

  const importedFieldCount = result ? Object.keys(result.fieldsImported).length : 0;
  const skippedFieldCount = result ? Object.keys(result.fieldsSkipped).length : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-emerald-500" />
              <span>
                <strong>{households.length}</strong> {households.length === 1 ? 'household' : 'households'}
                {' · '}
                <strong>{memberCount}</strong> {memberCount === 1 ? 'contact' : 'contacts'} from{' '}
                <span className="text-muted-foreground">{fileName}</span>
              </span>
              {dedupLoading && <span className="text-xs text-muted-foreground">· checking for duplicates…</span>}
              {dedup.loaded && (
                <span className="text-xs text-muted-foreground">
                  · <strong className="text-blue-600">{dedup.newCount}</strong> new
                  {' · '}
                  <strong className="text-amber-600">{dedup.updateCount}</strong> update
                </span>
              )}
            </div>

            {diagnostics?.validationErrors?.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                <p className="font-medium">
                  {diagnostics.validationErrors.length} value(s) couldn't be normalized and will be skipped
                </p>
                <details className="mt-1">
                  <summary className="cursor-pointer text-amber-700">View details</summary>
                  <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto">
                    {diagnostics.validationErrors.map((e, i) => (
                      <li key={i}>{e.household} · {e.label}: "{e.value}"</li>
                    ))}
                  </ul>
                </details>
              </div>
            )}

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
                      <td className="px-3 py-2">
                        {!dedup.loaded ? (
                          <span className="text-xs text-muted-foreground">Checking…</span>
                        ) : (() => {
                          const st = dedup.statuses[i];
                          if (!st || st.kind === 'new') {
                            return <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">New</span>;
                          }
                          const parts = [];
                          if (st.hhChanges.length) parts.push(st.hhChanges.map(fieldLabel).join(', '));
                          if (st.newMembers) parts.push(`+${st.newMembers} contact${st.newMembers > 1 ? 's' : ''}`);
                          if (st.updatedMembers) parts.push(`${st.updatedMembers} update${st.updatedMembers > 1 ? 's' : ''}`);
                          return (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex w-fit rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Update existing</span>
                              <span className="text-[10px] text-muted-foreground">{parts.length ? parts.join(' · ') : 'no changes'}</span>
                            </div>
                          );
                        })()}
                      </td>
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

        {/* Done — Import Summary */}
        {step === 'done' && result && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="text-sm font-medium">Import complete</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <SummaryStat label="Households created" value={result.householdsCreated} tone="emerald" />
              <SummaryStat label="Households updated" value={result.householdsUpdated} tone="amber" />
              <SummaryStat label="Contacts linked" value={result.contactsLinked} tone="blue" />
              <SummaryStat label="Contacts created" value={result.contactsCreated} tone="emerald" />
              <SummaryStat label="Contacts updated" value={result.contactsUpdated} tone="amber" />
              <SummaryStat label="Validation issues" value={result.validationErrors.length} tone={result.validationErrors.length ? 'red' : 'muted'} />
            </div>

            {importedFieldCount > 0 && (
              <details className="rounded-lg border bg-muted/30 p-3 text-xs">
                <summary className="cursor-pointer font-medium">Fields imported ({importedFieldCount})</summary>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                  {Object.entries(result.fieldsImported)
                    .sort((a, b) => b[1] - a[1])
                    .map(([f, c]) => (
                      <div key={f} className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{fieldLabel(f)}</span>
                        <span className="font-medium">{c}</span>
                      </div>
                    ))}
                </div>
              </details>
            )}

            {skippedFieldCount > 0 && (
              <details className="rounded-lg border bg-muted/30 p-3 text-xs">
                <summary className="cursor-pointer font-medium">Fields skipped ({skippedFieldCount})</summary>
                <div className="mt-2 space-y-1">
                  {Object.entries(result.fieldsSkipped).map(([f, reason]) => (
                    <div key={f} className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{fieldLabel(f)}</span>
                      <span className="text-amber-600">{reason}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {result.validationErrors.length > 0 && (
              <details className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
                <summary className="cursor-pointer font-medium text-destructive">Validation errors ({result.validationErrors.length})</summary>
                <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                  {result.validationErrors.map((e, i) => (
                    <div key={i} className="flex flex-col">
                      <span className="text-muted-foreground">{e.household} · {e.label}</span>
                      <span className="text-red-600">&ldquo;{e.value}&rdquo; — {e.message}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
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
              <Button onClick={handleImport} disabled={step !== 'preview' || dedupLoading}>
                {dedupLoading ? 'Checking duplicates…' : (
                  <>Import {dedup.loaded ? `${dedup.newCount} new` : households.length}{dedup.loaded && dedup.updateCount ? ` · ${dedup.updateCount} update` : ''}</>
                )}
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
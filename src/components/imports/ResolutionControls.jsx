import React, { useState } from 'react';
import { Loader2, Lock, ShieldAlert } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  RESOLUTION_TYPE_LABEL, RESOLUTION_TYPE_VARIANT,
  RESOLUTION_STATUS_VARIANT, RESOLUTION_STATUS_LABEL,
  OWNERSHIP_LABEL,
} from '@/lib/importLabels';

// Returns the resolution types the admin may choose for this comparison.
function getAvailableOptions(comparison) {
  const isNew = comparison.comparison_result === 'CREATE_NEW_RECORD_VALUE';
  const own = comparison.ownership_category;

  if (own === 'CHAMPION_CONNECT_MANAGED' || own === 'BLOCKED_FROM_EXISTING_RECORD_UPDATE') {
    return ['BLOCK_FIELD', 'SKIP_FIELD'];
  }
  if (own === 'RESTRICTIVE_PREFERENCE') {
    return isNew ? ['CREATE_WITH_INCOMING_VALUE', 'SKIP_FIELD'] : ['APPLY_RESTRICTION', 'KEEP_CURRENT', 'BLOCK_FIELD'];
  }
  if (own === 'SHARED_REVIEW') {
    return isNew
      ? ['CREATE_WITH_INCOMING_VALUE', 'SKIP_FIELD']
      : ['KEEP_CURRENT', 'USE_INCOMING', 'USE_CUSTOM_VALUE', 'SKIP_FIELD'];
  }
  if (own === 'FAMILYLIFE_MANAGED') {
    return isNew
      ? ['CREATE_WITH_INCOMING_VALUE', 'SKIP_FIELD']
      : ['KEEP_CURRENT', 'APPLY_SAFE_UPDATE', 'USE_CUSTOM_VALUE', 'SKIP_FIELD'];
  }
  return ['SKIP_FIELD'];
}

// Inline resolution controls for a single field comparison.
// Shows current/incoming/resolved values and lets the admin choose
// an allowed resolution type. Custom values are validated server-side.
export default function ResolutionControls({ comparison, resolution, onSave, disabled }) {
  const currentType = resolution?.resolution_type || '';
  const isResolved = resolution?.status === 'RESOLVED';
  const isPending = resolution?.status === 'PENDING';
  const options = getAvailableOptions(comparison);

  const [selectedType, setSelectedType] = useState(currentType);
  const [customValue, setCustomValue] = useState('');
  const [reason, setReason] = useState('');
  const [showCustom, setShowCustom] = useState(currentType === 'USE_CUSTOM_VALUE');
  const [saving, setSaving] = useState(false);

  const isLocked = options.length <= 1 && (options[0] === 'BLOCK_FIELD' || options[0] === 'SKIP_FIELD');
  const needsCustom = selectedType === 'USE_CUSTOM_VALUE';
  const isRestrictive = comparison.ownership_category === 'RESTRICTIVE_PREFERENCE';
  const showRestrictionNote = isRestrictive && comparison.current_normalized_value === 'true';

  function handleSelect(type) {
    setSelectedType(type);
    setShowCustom(type === 'USE_CUSTOM_VALUE');
  }

  async function handleSave() {
    if (!selectedType) return;
    setSaving(true);
    try {
      await onSave({
        comparison_id: comparison.id,
        resolution_type: selectedType,
        custom_value: needsCustom ? customValue : undefined,
        reason: reason || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  const hasChanged = selectedType !== currentType;

  return (
    <div className="space-y-1.5">
      {/* Current resolution badge */}
      <div className="flex flex-wrap items-center gap-1">
        {currentType && (
          <StatusBadge variant={RESOLUTION_TYPE_VARIANT[currentType] || 'neutral'}>
            {RESOLUTION_TYPE_LABEL[currentType] || currentType}
          </StatusBadge>
        )}
        {resolution && (
          <StatusBadge variant={RESOLUTION_STATUS_VARIANT[resolution.status] || 'neutral'}>
            {RESOLUTION_STATUS_LABEL[resolution.status] || resolution.status}
          </StatusBadge>
        )}
        {resolution?.resolution_source && resolution.resolution_source !== 'DEFAULT' && (
          <span className="text-[10px] text-muted-foreground">via {resolution.resolution_source.toLowerCase()}</span>
        )}
      </div>

      {/* Restriction note */}
      {showRestrictionNote && (
        <div className="flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-700">
          <ShieldAlert className="h-3 w-3 shrink-0" />
          Removing this restriction requires editing the Champion record directly.
        </div>
      )}

      {/* Locked fields */}
      {isLocked && !disabled ? (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          {RESOLUTION_TYPE_LABEL[options[0]] || options[0]}
        </div>
      ) : !disabled ? (
        <>
          {/* Option buttons */}
          <div className="flex flex-wrap gap-1">
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => handleSelect(opt)}
                disabled={saving}
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  selectedType === opt
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {RESOLUTION_TYPE_LABEL[opt] || opt}
              </button>
            ))}
          </div>

          {/* Custom value input */}
          {needsCustom && (
            <Input
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder="Enter custom value…"
              className="h-7 text-xs"
              disabled={saving}
            />
          )}

          {/* Save button */}
          {hasChanged && (
            <Button size="sm" onClick={handleSave} disabled={saving || (needsCustom && !customValue.trim())} className="h-7 text-xs">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Save
            </Button>
          )}
        </>
      ) : null}
    </div>
  );
}
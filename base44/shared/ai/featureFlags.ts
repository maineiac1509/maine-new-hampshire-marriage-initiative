// ============================================================
// AI Feature Flags
// ============================================================
// Controls AI availability at multiple scopes:
//   Global → Organization → Region → Church → User
//
// The most specific flag wins. This allows fine-grained control
// over who can use AI capabilities without code changes.
// ============================================================

// Evaluates whether AI is enabled for a given user and context.
//
// The authoritative global switch is `config.ai_enabled` — the master
// toggle set on the Ministry Coach Administration page. The
// `feature_flags` object contains optional scope-level overrides
// (user > church > region > organization) that can grant or revoke
// access for a specific scope regardless of the global setting.
//
// context shape: { organizationId, regionId, churchId }
export function isAIEnabled(config, user, context = {}) {
  const globalEnabled = config.ai_enabled ?? false;
  const flags = config.feature_flags || {};

  const orgEnabled = context.organizationId ? flags.organizations?.[context.organizationId] : undefined;
  const regionEnabled = context.regionId ? flags.regions?.[context.regionId] : undefined;
  const churchEnabled = context.churchId ? flags.churches?.[context.churchId] : undefined;
  const userEnabled = user?.id ? flags.users?.[user.id] : undefined;

  // Most specific flag wins (user > church > region > organization > global).
  if (userEnabled !== undefined) return userEnabled;
  if (churchEnabled !== undefined) return churchEnabled;
  if (regionEnabled !== undefined) return regionEnabled;
  if (orgEnabled !== undefined) return orgEnabled;
  return globalEnabled;
}

// Returns the scope level that determined the decision (for audit/logging).
export function getFeatureFlagSource(config, user, context = {}) {
  const flags = config.feature_flags || {};
  if (user?.id && flags.users?.[user.id] !== undefined) return 'user';
  if (context.churchId && flags.churches?.[context.churchId] !== undefined) return 'church';
  if (context.regionId && flags.regions?.[context.regionId] !== undefined) return 'region';
  if (context.organizationId && flags.organizations?.[context.organizationId] !== undefined) return 'organization';
  return 'global';
}
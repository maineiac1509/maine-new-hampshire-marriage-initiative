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
// context shape: { organizationId, regionId, churchId }
export function isAIEnabled(config, user, context = {}) {
  const flags = config.feature_flags || {};
  const globalEnabled = flags.global ?? config.ai_enabled ?? false;

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
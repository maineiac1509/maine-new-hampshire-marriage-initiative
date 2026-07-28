// ============================================================
// AI Security & Permission Model
// ============================================================
// AI receives only authorized data. The Context Builder uses
// user-scoped SDK calls (RLS-enforced), so any entity the user
// cannot read is automatically excluded from the context package.
//
// This module provides explicit boundary checks for the request
// level — verifying the user can access the requested champion
// before any data retrieval begins.
// ============================================================

import { AIError, AI_ERROR_CATEGORIES } from './errors.ts';

// Validates that the user has permission to access the requested champion.
// Uses a user-scoped query so RLS is enforced — if the user can't see
// the household, it won't be returned and we deny the request.
export async function authorizeChampionAccess(base44, user, householdId) {
  if (!householdId) return null;
  try {
    const household = await base44.entities.ChampionHousehold.get(householdId);
    if (!household) {
      throw new AIError(
        AI_ERROR_CATEGORIES.PERMISSION_DENIED,
        'The requested Champion is not accessible by this user.'
      );
    }
    return household;
  } catch (error) {
    if (error instanceof AIError) throw error;
    throw new AIError(
      AI_ERROR_CATEGORIES.PERMISSION_DENIED,
      'Access denied to the requested Champion.',
      { cause: error }
    );
  }
}

// Returns the effective permission scope for a user, used by the
// Context Builder to determine data access boundaries.
export function getUserPermissionScope(user) {
  const role = user?.role || 'user';
  return {
    role,
    isAdmin: role === 'admin',
    isDirector: role === 'director',
    canAccessAllChampions: role === 'admin' || role === 'director',
    userId: user?.id,
  };
}
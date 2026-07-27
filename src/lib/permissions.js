// Centralized, extensible role-based permission model for Champion Connect.
//
// A user's Role determines what they can administer.
// A user's Volunteer Team determines which Champions / Action Center items
// are emphasized. These are independent concepts.
//
// Stored role values are lowercase canonical strings (e.g. "admin") so that
// existing RLS rules keep working; ROLE_LABELS maps them to display names.
// To add a new role: add a ROLES entry, a ROLE_LABELS entry, and a
// CAPABILITY_MATRIX row — no other refactoring required.
export const ROLES = {
  ADMIN: 'admin',
  VOLUNTEER: 'volunteer',
};

export const ROLE_LABELS = {
  admin: 'Administrator',
  volunteer: 'Volunteer',
};

// capability -> which roles are allowed. New roles just add a row here.
const CAPABILITY_MATRIX = {
  admin: {
    manageUsers: true,
    assignChampions: true,
    deleteRecords: true,
    viewAllChampions: true,
    editAllChampions: true,
    editAssignedChampions: true,
    runReports: true,
    manageSettings: true,
    importData: true,
    manageAssignments: true,
    accessAdmin: true,
  },
  volunteer: {
    manageUsers: false,
    assignChampions: false,
    deleteRecords: false,
    viewAllChampions: true,
    editAllChampions: false,
    editAssignedChampions: true,
    runReports: false,
    manageSettings: false,
    importData: false,
    manageAssignments: false,
    accessAdmin: false,
  },
};

export function can(user, capability) {
  if (!user || !user.role) return false;
  const caps = CAPABILITY_MATRIX[user.role] || CAPABILITY_MATRIX.volunteer;
  return !!caps[capability];
}

export function isAdmin(user) {
  return user?.role === 'admin';
}

export function roleLabel(role) {
  return ROLE_LABELS[role] || 'Volunteer';
}
// Centralized, expandable role-based permission system for the FamilyLife Team Portal.
// Add new capabilities here; UI and future RLS can both read from this map.

export const ROLES = {
  ADMIN: 'admin',
  DIRECTOR: 'director',
  VOLUNTEER: 'volunteer',
};

export const ROLE_LABELS = {
  admin: 'Administrator',
  director: 'Director',
  volunteer: 'Volunteer',
};

// capability -> which roles are allowed
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
  },
  director: {
    manageUsers: true,
    assignChampions: true,
    deleteRecords: false,
    viewAllChampions: true,
    editAllChampions: true,
    editAssignedChampions: true,
    runReports: true,
    manageSettings: false,
    importData: true,
    manageAssignments: true,
  },
  volunteer: {
    manageUsers: false,
    assignChampions: false,
    deleteRecords: false,
    viewAllChampions: false,
    editAllChampions: false,
    editAssignedChampions: true,
    runReports: false,
    manageSettings: false,
    importData: false,
    manageAssignments: false,
  },
};

export function can(user, capability) {
  if (!user || !user.role) return false;
  const caps = CAPABILITY_MATRIX[user.role] || CAPABILITY_MATRIX.volunteer;
  return !!caps[capability];
}

export function roleLabel(role) {
  return ROLE_LABELS[role] || 'Volunteer';
}
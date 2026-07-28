// App-wide configuration values. Avoid hardcoding these across pages.
export const APP_CONFIG = {
  appName: 'Maine/New Hampshire Marriage Initiative',
  ministry: 'FamilyLife New England',
  event: 'Weekend to Remember',
  // Next Weekend to Remember — update as needed.
  weekendDate: '2026-11-07',
};

export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/', icon: 'LayoutDashboard' },
  { label: 'Marriage Champions', path: '/champions', icon: 'Users' },
  { label: 'Assignments', path: '/assignments', icon: 'UserCheck' },
  { label: 'Contact History', path: '/contact-history', icon: 'MessageSquare' },
  { label: 'Reports', path: '/reports', icon: 'BarChart3' },
  { label: 'Ministry Intelligence', path: '/intelligence', icon: 'Activity' },
  { label: 'Stewardship Guides', path: '/stewardship-guides', icon: 'BookOpen' },
  { label: 'Communication Center', path: '/communication', icon: 'MessagesSquare' },
  { label: 'Resource Library', path: '/resources', icon: 'Library' },
  { label: 'Users', path: '/users', icon: 'UsersRound', adminOnly: true },
  { label: 'Administration', path: '/administration', icon: 'Settings', adminOnly: true },
];

export const STATUS_OPTIONS = ['New', 'First Contact', 'Follow-Up', 'Completed', 'Inactive'];
export const REGISTRATION_TYPE_OPTIONS = ['Individual', 'Couple', 'Group'];

export const ACTIVITY_TYPE_OPTIONS = [
  'Phone Call', 'Voicemail', 'Text Message', 'Email', 'In Person',
  'Meeting', 'Prayer', 'Administrative Update', 'Other',
];
export const CONTACT_METHOD_OPTIONS = [
  'Phone', 'Email', 'Text Message', 'In Person', 'Video Call', 'Mail', 'Other',
];

// Maps each Activity Type to the outcomes that make sense for it.
// Used by the Log Activity dialog to filter the Outcome dropdown.
export const ACTIVITY_OUTCOMES = {
  'Phone Call': ['No Answer', 'Left Voicemail', 'Spoke with Champion', 'Requested Follow-up', 'Interested', 'Not Interested', 'Do Not Contact', 'Other'],
  'Voicemail': ['Left Voicemail', 'Other'],
  'Text Message': ['Spoke with Champion', 'Requested Follow-up', 'Interested', 'Not Interested', 'Do Not Contact', 'Other'],
  'Email': ['Spoke with Champion', 'Requested Follow-up', 'Interested', 'Not Interested', 'Do Not Contact', 'Other'],
  'In Person': ['Spoke with Champion', 'Requested Follow-up', 'Interested', 'Not Interested', 'Serving', 'Do Not Contact', 'Other'],
  'Meeting': ['Spoke with Champion', 'Requested Follow-up', 'Interested', 'Not Interested', 'Serving', 'Other'],
  'Prayer': ['Spoke with Champion', 'Requested Follow-up', 'Other'],
  'Administrative Update': ['Other'],
  'Other': CONTACT_OUTCOME_OPTIONS,
};
export const CONTACT_OUTCOME_OPTIONS = [
  'No Answer', 'Left Voicemail', 'Spoke with Champion', 'Requested Follow-up',
  'Interested', 'Not Interested', 'Serving', 'Do Not Contact', 'Other',
];

export const RELATIONSHIP_STATUS_OPTIONS = [
  'New',
  'Assigned',
  'First Contact Needed',
  'Attempted Contact',
  'Connected',
  'Following Up',
  'Registered for Weekend',
  'Attended Weekend',
  'Ongoing Champion',
  'Inactive',
];

// Semantic variant per Relationship Status. Maps to the shared StatusBadge
// color system (success / warning / info / neutral) so every badge stays
// consistent. Icons differentiate statuses that share a color.
export const RELATIONSHIP_STATUS_VARIANTS = {
  'New': 'warning',
  'Assigned': 'info',
  'First Contact Needed': 'warning',
  'Attempted Contact': 'warning',
  'Connected': 'info',
  'Following Up': 'info',
  'Registered for Weekend': 'success',
  'Attended Weekend': 'success',
  'Ongoing Champion': 'success',
  'Inactive': 'neutral',
};

// Semantic variant per Activity Type and Outcome — used by the Timeline.
export const ACTIVITY_TYPE_VARIANTS = {
  'Phone Call': 'info',
  'Voicemail': 'warning',
  'Text Message': 'info',
  'Email': 'info',
  'In Person': 'success',
  'Meeting': 'info',
  'Prayer': 'neutral',
  'Administrative Update': 'neutral',
  'Other': 'neutral',
};

export const OUTCOME_VARIANTS = {
  'No Answer': 'neutral',
  'Left Voicemail': 'warning',
  'Spoke with Champion': 'success',
  'Requested Follow-up': 'info',
  'Interested': 'success',
  'Not Interested': 'danger',
  'Serving': 'success',
  'Do Not Contact': 'danger',
  'Other': 'neutral',
};

// When an activity is logged with one of these outcomes, suggest a Relationship
// Status update. The user must confirm before the status actually changes.
export const OUTCOME_STATUS_SUGGESTIONS = {
  'Spoke with Champion': 'Connected',
  'Interested': 'Following Up',
  'Serving': 'Ongoing Champion',
};
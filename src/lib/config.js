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
  { label: 'Administration', path: '/administration', icon: 'Settings' },
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
export const CONTACT_OUTCOME_OPTIONS = [
  'No Answer', 'Left Voicemail', 'Spoke with Champion', 'Requested Follow-up',
  'Interested', 'Not Interested', 'Serving', 'Do Not Contact', 'Other',
];
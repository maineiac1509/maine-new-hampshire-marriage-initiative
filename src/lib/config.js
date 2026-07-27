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

export const RELATIONSHIP_STATUS_STYLES = {
  'New': 'bg-amber-100 text-amber-700',
  'Assigned': 'bg-blue-100 text-blue-700',
  'First Contact Needed': 'bg-orange-100 text-orange-700',
  'Attempted Contact': 'bg-yellow-100 text-yellow-700',
  'Connected': 'bg-emerald-100 text-emerald-700',
  'Following Up': 'bg-violet-100 text-violet-700',
  'Registered for Weekend': 'bg-cyan-100 text-cyan-700',
  'Attended Weekend': 'bg-teal-100 text-teal-700',
  'Ongoing Champion': 'bg-indigo-100 text-indigo-700',
  'Inactive': 'bg-slate-100 text-slate-500',
};

// When an activity is logged with one of these outcomes, suggest a Relationship
// Status update. The user must confirm before the status actually changes.
export const OUTCOME_STATUS_SUGGESTIONS = {
  'Spoke with Champion': 'Connected',
  'Interested': 'Following Up',
  'Serving': 'Ongoing Champion',
};
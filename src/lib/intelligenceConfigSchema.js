// Ministry Intelligence configuration schema.
//
// Single source of truth for configurable thresholds: field definitions,
// default values, validation rules, and human-friendly help text.
//
// Consumed by:
//   - ministrySignalEngine.js  (resolveConfig maps stored -> engine config)
//   - IntelligenceConfigSection.jsx (editable admin UI, validation, reset)
//
// Adding a new configurable threshold: add a field entry here. It is then
// automatically editable, validated, audited, and available to any signal
// rule that reads it from the resolved config — no other code changes.

export const CONFIG_GROUPS = [
  {
    key: 'capacity',
    label: 'Volunteer Capacity',
    fields: [
      { key: 'capacity_warning_threshold', label: 'Capacity Warning Threshold', unit: '%', default: 80, min: 50, max: 100,
        help: 'Team utilization percentage that indicates approaching capacity. Future capacity signals will use this to flag teams at risk before they are overloaded.' },
      { key: 'capacity_critical_threshold', label: 'Capacity Critical Threshold', unit: '%', default: 95, min: 50, max: 100,
        help: 'Team utilization percentage indicating critical overload. Must be greater than the warning threshold. Future capacity signals will escalate teams at this level.' },
      { key: 'capacity_risk_team_count', label: 'Capacity Risk Team Count', unit: 'teams', default: 2, min: 1, max: 50,
        help: 'Minimum number of teams over the capacity threshold required to generate a Volunteer Capacity Risk signal.' },
    ],
  },
  {
    key: 'backlog',
    label: 'Recommendation Backlog',
    fields: [
      { key: 'max_open_recommendations', label: 'Maximum Open Recommendations', unit: '', default: 10, min: 1, max: 500,
        help: 'Open recommendation count that triggers a Recommendation Backlog signal.' },
      { key: 'max_critical_recommendations', label: 'Maximum Critical Recommendations', unit: '', default: 2, min: 0, max: 100,
        help: 'Open critical recommendation count that triggers a Recommendation Backlog signal, regardless of the total open count.' },
      { key: 'recommendation_age_threshold', label: 'Recommendation Age Threshold', unit: 'days', default: 14, min: 1, max: 365,
        help: 'Age (in days) beyond which an open recommendation is considered aged. Reserved for future backlog signals.' },
    ],
  },
  {
    key: 'health',
    label: 'Stewardship Health',
    fields: [
      { key: 'health_decline_window', label: 'Health Decline Window', unit: 'Champions', default: 3, min: 1, max: 100,
        help: 'Number of Champions declining in stewardship health required to generate a Declining Stewardship Health signal.' },
      { key: 'health_improvement_window', label: 'Health Improvement Window', unit: 'Champions', default: 3, min: 1, max: 100,
        help: 'Number of improving Champions used to evaluate positive momentum. Reserved for future health signals.' },
    ],
  },
  {
    key: 'growth',
    label: 'Ministry Growth',
    fields: [
      { key: 'champion_growth_threshold', label: 'Champion Growth Threshold', unit: 'Champions', default: 3, min: 1, max: 500,
        help: 'New Champions in a period required to generate a Growing Ministry Region signal.' },
      { key: 'household_growth_threshold', label: 'Household Growth Threshold', unit: 'Households', default: 3, min: 1, max: 500,
        help: 'New households in a period used to evaluate growth. Reserved for future growth signals.' },
    ],
  },
  {
    key: 'distribution',
    label: 'Assignment Distribution',
    fields: [
      { key: 'assignment_imbalance_percentage', label: 'Assignment Imbalance Percentage', unit: '%', default: 50, min: 10, max: 200,
        help: 'How much a team\'s Champion load must exceed the team average (as a percentage) to generate an Assignment Imbalance signal.' },
      { key: 'max_unassigned_champions', label: 'Maximum Allowed Unassigned Champions', unit: 'Champions', default: 5, min: 0, max: 500,
        help: 'Unassigned Champion count that triggers an Unassigned Champion Growth signal.' },
    ],
  },
  {
    key: 'signals',
    label: 'Ministry Signals',
    fields: [
      { key: 'signal_aging_warning_days', label: 'Signal Aging Warning', unit: 'days', default: 14, min: 1, max: 365,
        help: 'Days an Open signal ages before it is highlighted as needing attention.' },
      { key: 'signal_aging_critical_days', label: 'Signal Aging Critical', unit: 'days', default: 30, min: 1, max: 365,
        help: 'Days an Open signal ages before it is considered critical. Must be greater than the warning threshold.' },
    ],
  },
  {
    key: 'transfers',
    label: 'Stewardship Transfers',
    fields: [
      { key: 'transfer_trend_threshold', label: 'Transfer Trend Threshold', unit: 'transfers', default: 3, min: 1, max: 200,
        help: 'Number of stewardship transfers in a period required to generate a Stewardship Transfer Trend signal.' },
    ],
  },
  {
    key: 'momentum',
    label: 'Positive Momentum',
    fields: [
      { key: 'min_recommendation_completion_rate', label: 'Minimum Recommendation Completion Rate', unit: '%', default: 50, min: 0, max: 100,
        help: 'Recommendation resolution rate used to evaluate positive ministry momentum. Reserved for future momentum signals.' },
      { key: 'min_health_improvement_percentage', label: 'Minimum Health Improvement Percentage', unit: '%', default: 5, min: 0, max: 100,
        help: 'Improvement percentage used to evaluate positive ministry momentum. Reserved for future momentum signals.' },
      { key: 'volunteer_capacity_requirement', label: 'Volunteer Capacity Requirement', unit: 'teams', default: 0, min: 0, max: 50,
        help: 'Maximum teams allowed over capacity while still recognizing positive momentum. Reserved for future momentum signals.' },
    ],
  },
];

// Flat map of field key -> default value (snake_case, matches entity fields).
export const DEFAULT_CONFIG_VALUES = CONFIG_GROUPS.reduce((acc, g) => {
  g.fields.forEach((f) => { acc[f.key] = f.default; });
  return acc;
}, {});

// Lookup: field key -> field definition (for labels/help in audit records).
export const FIELD_DEFS = CONFIG_GROUPS.reduce((acc, g) => {
  g.fields.forEach((f) => { acc[f.key] = f; });
  return acc;
}, {});

// Validate a full set of config values. Returns { [fieldKey]: message }.
export function validateConfig(values) {
  const errors = {};
  CONFIG_GROUPS.forEach((g) => {
    g.fields.forEach((f) => {
      const raw = values[f.key];
      if (raw === '' || raw === null || raw === undefined || Number.isNaN(Number(raw))) {
        errors[f.key] = `${f.label} must be a number.`;
        return;
      }
      const n = Number(raw);
      if (n < f.min) errors[f.key] = `${f.label} must be at least ${f.min}.`;
      else if (n > f.max) errors[f.key] = `${f.label} must be at most ${f.max}.`;
    });
  });
  // Cross-field range validation.
  if (!errors.capacity_warning_threshold && !errors.capacity_critical_threshold &&
      Number(values.capacity_critical_threshold) <= Number(values.capacity_warning_threshold)) {
    errors.capacity_critical_threshold = 'Critical threshold must be greater than the warning threshold.';
  }
  if (!errors.signal_aging_warning_days && !errors.signal_aging_critical_days &&
      Number(values.signal_aging_critical_days) <= Number(values.signal_aging_warning_days)) {
    errors.signal_aging_critical_days = 'Critical aging must be greater than the warning aging.';
  }
  return errors;
}
export const DEFAULT_THRESHOLDS = {
  enrolment: {
    watch:    0.90,   // cumulative ratio < this → score 1
    warn:     0.75,   // ratio < this → score 2
    critical: 0.50,   // ratio < this → score 3
  },
  screenFailure: {
    watch:    0.30,   // rate >= this → score 1
    warn:     0.50,   // rate >= this → score 2
    critical: 0.70,   // rate >= this → score 3
  },
  sdv: {
    watch:    0.90,   // SDV % < this → score 1
    warn:     0.80,   // SDV % < this → score 2
    critical: 0.65,   // SDV % < this → score 3
  },
  queryBurden: {
    watch:    3,      // aged queries > this → score 1
    warn:     8,      // aged queries > this → score 2
    critical: 15,     // aged queries > this → score 3
  },
  deviations: {
    watch:    3,      // max deviations >= this → score 1
    warn:     5,      // max deviations >= this → score 2
    critical: 8,      // max deviations >= this → score 3
  },
  rag: {
    red:   8,         // total score >= this → Red
    amber: 4,         // total score >= this → Amber
  },
  craOverdueDays: 45,
};

// Metadata for the threshold editor UI
export const THRESHOLD_LABELS = {
  enrolment: {
    label: 'Enrolment',
    hint: 'Based on cumulative enrolled ÷ cumulative target',
    fields: [
      { key: 'watch',    label: 'Watch below',    unit: '%', isPercent: true },
      { key: 'warn',     label: 'Warn below',     unit: '%', isPercent: true },
      { key: 'critical', label: 'Critical below', unit: '%', isPercent: true },
    ],
  },
  screenFailure: {
    label: 'Screen Failure Rate',
    hint: 'Screen failures ÷ (enrolled + screen failures)',
    fields: [
      { key: 'watch',    label: 'Watch above',    unit: '%', isPercent: true },
      { key: 'warn',     label: 'Warn above',     unit: '%', isPercent: true },
      { key: 'critical', label: 'Critical above', unit: '%', isPercent: true },
    ],
  },
  sdv: {
    label: 'SDV Completeness',
    hint: 'Latest month SDV % from Quality sheet',
    fields: [
      { key: 'watch',    label: 'Watch below',    unit: '%', isPercent: true },
      { key: 'warn',     label: 'Warn below',     unit: '%', isPercent: true },
      { key: 'critical', label: 'Critical below', unit: '%', isPercent: true },
    ],
  },
  queryBurden: {
    label: 'Aged Queries (>14 days)',
    hint: 'Count of open queries older than 14 days in the latest month',
    fields: [
      { key: 'watch',    label: 'Watch above',    unit: 'queries' },
      { key: 'warn',     label: 'Warn above',     unit: 'queries' },
      { key: 'critical', label: 'Critical above', unit: 'queries' },
    ],
  },
  deviations: {
    label: 'Protocol Deviations',
    hint: 'Maximum deviation count in any single month',
    fields: [
      { key: 'watch',    label: 'Watch at ≥',    unit: 'deviations' },
      { key: 'warn',     label: 'Warn at ≥',     unit: 'deviations' },
      { key: 'critical', label: 'Critical at ≥', unit: 'deviations' },
    ],
  },
  rag: {
    label: 'Overall RAG Thresholds',
    hint: 'Total risk score (sum of all dimension scores + modifiers, max 15)',
    fields: [
      { key: 'amber', label: 'Amber from score ≥', unit: 'pts' },
      { key: 'red',   label: 'Red from score ≥',   unit: 'pts' },
    ],
  },
  craOverdueDays: {
    label: 'CRA Visit',
    hint: 'Days since last monitoring visit before the site is flagged as overdue',
    fields: [
      { key: 'craOverdueDays', label: 'Overdue after', unit: 'days', isFlat: true },
    ],
  },
};

export function mergeThresholds(saved) {
  if (!saved) return DEFAULT_THRESHOLDS;
  return {
    enrolment:      { ...DEFAULT_THRESHOLDS.enrolment,      ...(saved.enrolment || {}) },
    screenFailure:  { ...DEFAULT_THRESHOLDS.screenFailure,  ...(saved.screenFailure || {}) },
    sdv:            { ...DEFAULT_THRESHOLDS.sdv,            ...(saved.sdv || {}) },
    queryBurden:    { ...DEFAULT_THRESHOLDS.queryBurden,    ...(saved.queryBurden || {}) },
    deviations:     { ...DEFAULT_THRESHOLDS.deviations,     ...(saved.deviations || {}) },
    rag:            { ...DEFAULT_THRESHOLDS.rag,            ...(saved.rag || {}) },
    craOverdueDays: saved.craOverdueDays ?? DEFAULT_THRESHOLDS.craOverdueDays,
  };
}

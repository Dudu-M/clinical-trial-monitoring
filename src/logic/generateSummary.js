function pct(ratio) {
  return Math.round((ratio ?? 0) * 100) + '%';
}

function formatDate(date) {
  if (!date) return 'unknown date';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function generateSummary(site, trialMeta) {
  const { scores, rag, trendSignal, persistentConcern, craOverdue, enrolmentSummary,
    screenFailureRate, latestSdvPct, latestQueriesAged, deviationsTrend, months, notes,
    lastMonitoringVisit, daysWithoutVisit } = site;

  const parts = [];

  // ── Opening: primary concern ───────────────────────────────────────────
  const enrollPct = pct(enrolmentSummary.ratio);

  // Priority 1: Screen failure masking enrolment (Site E pattern)
  if (scores.screenFailure >= 3 && scores.enrolment <= 1) {
    const sfPct = pct(screenFailureRate);
    const totalScreened = months.reduce((s, m) => s + (m.enrolled ?? 0) + (m.screenFailures ?? 0), 0);
    const totalFailed = months.reduce((s, m) => s + (m.screenFailures ?? 0), 0);
    parts.push(
      `Enrolment figures appear on or near target, but mask a serious screening problem — ${totalFailed} patients screened and failed across ${months.length} month${months.length !== 1 ? 's' : ''}, a ${sfPct} screen failure rate.`
    );
    parts.push(
      `This suggests a potential eligibility or screening protocol issue that requires investigation before further screening activity.`
    );
  }

  // Priority 2: Across-the-board deterioration (Site B pattern)
  else if (trendSignal === 'deteriorating') {
    parts.push(
      `Every quality metric has deteriorated over the monitoring period. Enrolment is at ${enrollPct} of cumulative target (${enrolmentSummary.cumEnrolled} of ${enrolmentSummary.cumTarget} patients).`
    );
    if (latestQueriesAged > 0) {
      parts.push(`Queries aged over 14 days have grown to ${latestQueriesAged} open items.`);
    }
    if (latestSdvPct != null) {
      parts.push(`SDV completion has fallen to ${pct(latestSdvPct)}.`);
    }
  }

  // Priority 3: Significant enrolment deficit
  else if (scores.enrolment >= 2) {
    const gap = enrolmentSummary.cumTarget - enrolmentSummary.cumEnrolled;
    parts.push(
      `Enrolment is significantly behind target — ${enrolmentSummary.cumEnrolled} of ${enrolmentSummary.cumTarget} patients enrolled (${enrollPct}), leaving a gap of ${gap} patients against the cumulative target.`
    );
  }

  // Priority 4: Query / SDV concern
  else if (scores.queryBurden >= 2 || scores.sdv >= 2) {
    parts.push(
      `Enrolment is on track at ${enrollPct}, but data quality concerns require attention.`
    );
    if (scores.queryBurden >= 2) {
      parts.push(`There are ${latestQueriesAged} queries aged over 14 days unresolved.`);
    }
    if (scores.sdv >= 2 && latestSdvPct != null) {
      parts.push(`SDV completion is ${pct(latestSdvPct)}, below the 80% acceptable threshold.`);
    }
  }

  // Default: describe highest-scoring dimension
  else {
    parts.push(
      `${site.rawName} is performing ${rag === 'green' ? 'well' : 'adequately'} with enrolment at ${enrollPct} of cumulative target.`
    );
  }

  // ── Secondary signals ──────────────────────────────────────────────────
  if (scores.deviations >= 2) {
    const devStr = deviationsTrend.join('→');
    parts.push(`Protocol deviations are ${trendSignal.includes('deteriorat') || trendSignal === 'trending-worse' ? 'rising' : 'elevated'} (${devStr}).`);
  }

  if (trendSignal === 'trending-worse' && scores.enrolment < 2 && scores.screenFailure < 3) {
    parts.push(`Overall site performance has trended downward over the monitoring period.`);
  }

  if (persistentConcern) {
    parts.push(`Risk has been persistently elevated for ${persistentConcern} consecutive month${persistentConcern !== 1 ? 's' : ''} — this is not a transient issue.`);
  }

  if (craOverdue && lastMonitoringVisit) {
    parts.push(`No CRA monitoring visit has been conducted in ${daysWithoutVisit} days (last visit: ${formatDate(lastMonitoringVisit)}) — a site visit is overdue.`);
  } else if (craOverdue) {
    parts.push(`No CRA monitoring visit on record within the data period — a site visit is overdue.`);
  }

  // ── Site notes ─────────────────────────────────────────────────────────
  if (notes && notes.length > 0) {
    parts.push(notes.filter(Boolean).join(' '));
  }

  // ── Data quality flags ─────────────────────────────────────────────────
  if (site.dataQualityFlags.includes('target_imputed')) {
    parts.push(`Note: one or more monthly targets were missing and have been imputed using the site's modal target value.`);
  }

  return parts.join(' ');
}

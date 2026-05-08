function pct(ratio) {
  return Math.round((ratio ?? 0) * 100) + '%';
}

function formatDate(date) {
  if (!date) return 'unknown date';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function noteText(note) {
  if (typeof note === 'string') return note;
  if (note && typeof note === 'object') return note.text || '';
  return '';
}

export function generateSummary(site, trialMeta) {
  const { scores, rag, trendSignal, persistentConcern, craOverdue, enrolmentSummary,
    screenFailureRate, latestSdvPct, latestQueriesAged, deviationsTrend, months, notes,
    lastMonitoringVisit, daysWithoutVisit, modifierFlags, modifierNotes } = site;

  const parts = [];
  const enrollPct = pct(enrolmentSummary.ratio);

  // Priority 1: Screen failure masking enrolment (Site E pattern)
  if (scores.screenFailure >= 3 && scores.enrolment <= 1) {
    const sfPct = pct(screenFailureRate);
    const totalScreened = months.reduce((s, m) => s + (m.enrolled ?? 0) + (m.screenFailures ?? 0), 0);
    const totalFailed = months.reduce((s, m) => s + (m.screenFailures ?? 0), 0);
    parts.push(
      `Enrolment figures appear on or near target, but mask a serious screening problem — ${totalFailed} patients screened and failed across ${months.length} month${months.length !== 1 ? 's' : ''}, a ${sfPct} screen failure rate.`
    );
    parts.push(`This suggests a potential eligibility or screening protocol issue that requires investigation before further screening activity.`);
  }

  // Priority 2: Across-the-board deterioration
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
    parts.push(`Enrolment is on track at ${enrollPct}, but data quality concerns require attention.`);
    if (scores.queryBurden >= 2) {
      parts.push(`There are ${latestQueriesAged} queries aged over 14 days unresolved.`);
    }
    if (scores.sdv >= 2 && latestSdvPct != null) {
      parts.push(`SDV completion is ${pct(latestSdvPct)}, below the 80% acceptable threshold.`);
    }
  }

  // Default
  else {
    parts.push(
      `${site.rawName} is performing ${rag === 'green' ? 'well' : 'adequately'} with enrolment at ${enrollPct} of cumulative target.`
    );
  }

  // Secondary signals
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
    const d = lastMonitoringVisit instanceof Date ? lastMonitoringVisit : new Date(lastMonitoringVisit);
    parts.push(`No CRA monitoring visit has been conducted in ${daysWithoutVisit} days (last visit: ${formatDate(d)}) — a site visit is overdue.`);
  } else if (craOverdue) {
    parts.push(`No CRA monitoring visit on record within the data period — a site visit is overdue.`);
  }

  // Modifier notes (leave, etc.)
  if (modifierNotes && modifierNotes.length > 0) {
    parts.push(modifierNotes.join(' '));
  }

  // Raw notes — convert objects to strings, never concatenate raw objects
  const rawNoteTexts = (notes || []).map(noteText).filter(Boolean);
  if (rawNoteTexts.length > 0) {
    parts.push(rawNoteTexts.join(' '));
  }

  // Data quality flags
  if (site.dataQualityFlags && site.dataQualityFlags.includes('target_imputed')) {
    parts.push(`Note: one or more monthly targets were missing and have been imputed using the site's modal target value.`);
  }

  return parts.join(' ');
}

// Actionable insights linked to specific metric issues
export function generateActionableInsights(scored) {
  const insights = [];
  const s = scored.scores || {};

  if (scored.persistentConcern) {
    const months = scored.persistentConcernMonthLabels || [];
    insights.push({
      severity: 'critical',
      text: `Risk has been persistently elevated for ${scored.persistentConcern} consecutive months${months.length > 0 ? ` (${months.join(', ')})` : ''}. This is not a transient issue — consider escalating to the sponsor or requesting an additional CRA visit.`,
    });
  }

  if (scored.craOverdue) {
    insights.push({
      severity: 'action',
      text: `CRA monitoring visit is overdue — ${scored.daysWithoutVisit} days since the last visit (threshold: 45 days).`,
      suggestion: 'Schedule a site visit and send a check-in email to the site coordinator.',
      linkTab: 'email',
      linkLabel: 'Open email draft →',
    });
  } else if (scored.daysWithoutVisit != null && scored.daysWithoutVisit > 30) {
    insights.push({
      severity: 'watch',
      text: `${scored.daysWithoutVisit} days since the last monitoring visit — approaching the overdue threshold.`,
      suggestion: 'Consider scheduling a visit proactively.',
      linkTab: 'email',
      linkLabel: 'Prepare email →',
    });
  }

  // SDV low + monitoring gap — link the two
  if (s.sdv >= 2 && scored.daysWithoutVisit != null && scored.daysWithoutVisit > 25) {
    insights.push({
      severity: 'insight',
      text: `SDV is below target (${Math.round((scored.latestSdvPct || 0) * 100)}%) and the site hasn't been visited in ${scored.daysWithoutVisit} days — a monitoring visit could address the SDV backlog and query resolution simultaneously.`,
      linkTab: 'email',
      linkLabel: 'Draft visit email →',
    });
  }

  if (s.enrolment >= 2) {
    const gap  = (scored.enrolmentSummary?.cumTarget || 0) - (scored.enrolmentSummary?.cumEnrolled || 0);
    const pctS = Math.round((scored.enrolmentSummary?.ratio || 0) * 100);
    insights.push({
      severity: s.enrolment === 3 ? 'action' : 'watch',
      text: `Enrolment is ${pctS}% of cumulative target — ${gap} patient${gap !== 1 ? 's' : ''} behind schedule.`,
      suggestion: 'Discuss with the site team. Common causes: eligibility criteria misapplication, patient flow bottlenecks, PI capacity.',
      linkTab: 'email',
      linkLabel: 'Contact site →',
    });
  }

  if (s.screenFailure >= 2) {
    insights.push({
      severity: 'watch',
      text: `Screen failure rate of ${Math.round((scored.screenFailureRate || 0) * 100)}% is above threshold — check whether eligibility criteria are being applied correctly.`,
    });
  }

  if (s.queryBurden >= 2) {
    insights.push({
      severity: 'action',
      text: `${scored.latestQueriesAged} queries have been open for >14 days.`,
      suggestion: 'Contact the coordinator to clear the query backlog before the next data cut.',
      linkTab: 'email',
      linkLabel: 'Draft follow-up →',
    });
  }

  if (s.deviations >= 2) {
    const trend = (scored.deviationsTrend || []).join(' → ');
    insights.push({
      severity: 'watch',
      text: `Protocol deviation count${trend ? ` (${trend})` : ''} indicates compliance issues — may require targeted protocol training.`,
    });
  }

  return insights;
}


export function generateHeadline(site, trialMeta) {
  const { scores, trendSignal, craOverdue, enrolmentSummary, screenFailureRate,
    latestSdvPct, latestQueriesAged, modifierFlags, notes, lastMonitoringVisit, daysWithoutVisit } = site;

  const parts = [];
  const allNoteText = (notes || []).map(noteText).join(' ').toLowerCase();

  // Note-based flags (from notes intelligence layer)
  if (allNoteText.includes('withdrawing') || allNoteText.includes('pi considering')) {
    parts.push('PI withdrawal risk');
  }
  if (allNoteText.includes('additional study') || allNoteText.includes('additional stud')) {
    parts.push('PI workload risk');
  }
  if (allNoteText.includes('eligibility') || allNoteText.includes('population mismatch') || allNoteText.includes('inclusion criteria')) {
    parts.push('eligibility problem');
  }

  // Primary concern
  if (scores.screenFailure >= 3 && scores.enrolment <= 1) {
    const sfPct = Math.round(screenFailureRate * 100);
    parts.unshift(`${sfPct}% screen failure rate masks on-target enrolment`);
  } else if (trendSignal === 'deteriorating') {
    parts.push('all quality metrics deteriorating');
  } else if (scores.enrolment >= 2) {
    parts.unshift(`Behind cumulative target (${Math.round(enrolmentSummary.ratio * 100)}%)`);
  } else if (scores.queryBurden >= 2) {
    parts.push(`${latestQueriesAged} aged queries`);
  } else if (scores.sdv >= 2 && latestSdvPct != null) {
    parts.push(`SDV at ${Math.round(latestSdvPct * 100)}%`);
  }

  // CRA visit overdue with date
  if (craOverdue) {
    if (lastMonitoringVisit) {
      const d = lastMonitoringVisit instanceof Date ? lastMonitoringVisit : new Date(lastMonitoringVisit);
      const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      parts.push(`CRA not visited since ${dateStr}`);
    } else {
      parts.push('CRA visit overdue');
    }
  }

  // Modifier flags (newly activated, leave)
  if (modifierFlags) {
    for (const f of modifierFlags) {
      if (f.includes('Recently activated')) parts.unshift('Recently activated');
      if (f.includes('Persistent')) {/* already shown as badge */}
    }
  }

  // All-green site
  if (parts.length === 0 && site.rag === 'green') {
    const sdvStr = latestSdvPct != null ? ` · ${Math.round(latestSdvPct * 100)}% SDV` : '';
    const qStr = latestQueriesAged === 0 ? ' · zero aged queries' : '';
    return `Exemplar site — hitting targets${sdvStr}${qStr}`;
  }

  return parts.join(' · ') || `${site.rawName} — monitoring ongoing`;
}

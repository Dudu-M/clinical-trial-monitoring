function pct(ratio) {
  return Math.round((ratio ?? 0) * 100) + '%';
}

function formatMonthRange(months) {
  if (!months || months.length === 0) return 'the recent period';
  if (months.length === 1) return months[0].month;
  return `${months[0].month}–${months[months.length - 1].month}`;
}

function formatDate(date) {
  if (!date) return 'an unknown date';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function generateEmail(site, trialMeta) {
  const { scores, enrolmentSummary, screenFailureRate, latestSdvPct,
    latestQueriesAged, deviationsTrend, months } = site;

  const coordName = site.coordinator?.name || 'Site Coordinator';
  const coordEmail = site.coordinator?.email || '';
  const period = formatMonthRange(months);

  const bodyParagraphs = [];

  // Opening
  bodyParagraphs.push(
    `I hope this message finds you well. I am writing on behalf of the Lindus Trial Management Team as part of our routine review of the CARDINAL study (Sponsor: ${trialMeta?.sponsor || 'Hartwell Therapeutics'}) covering ${period}.`
  );

  // Enrolment paragraph (if flagged)
  if (scores.enrolment >= 2) {
    const gap = enrolmentSummary.cumTarget - enrolmentSummary.cumEnrolled;
    bodyParagraphs.push(
      `We've noticed that enrolment at ${site.rawName} is currently at ${pct(enrolmentSummary.ratio)} of cumulative target — ${enrolmentSummary.cumEnrolled} of ${enrolmentSummary.cumTarget} patients enrolled, with a gap of ${gap}. We'd love to understand if there are any barriers to screening or enrolment that we can help address.`
    );
  } else if (scores.enrolment === 1) {
    bodyParagraphs.push(
      `Enrolment at ${site.rawName} is slightly below target at ${pct(enrolmentSummary.ratio)}. If there are any factors affecting recruitment pace, please let us know how we can support.`
    );
  }

  // Screen failure paragraph
  if (scores.screenFailure >= 2) {
    bodyParagraphs.push(
      `We've also noticed an elevated screen failure rate of ${pct(screenFailureRate)} over the ${period} period, which is higher than we'd typically expect. We'd love to understand a bit more about the screening process to see if there's anything we can do to support you — for example, whether any eligibility criteria are proving difficult to apply in practice.`
    );
  }

  // Query burden paragraph
  if (scores.queryBurden >= 2) {
    bodyParagraphs.push(
      `There are currently ${latestQueriesAged} queries aged over 14 days outstanding at your site. Timely query resolution is important for data integrity — please could you prioritise these with your team, and let us know if any are unclear or require sponsor input to resolve?`
    );
  } else if (scores.queryBurden === 1) {
    bodyParagraphs.push(
      `We note there are a small number of queries aged over 14 days outstanding. Please do action these when you have a moment.`
    );
  }

  // SDV paragraph
  if (scores.sdv >= 2 && latestSdvPct != null) {
    bodyParagraphs.push(
      `Source data verification at your site is currently at ${pct(latestSdvPct)}, which is below the 80% threshold we aim to maintain. We'd like to arrange a monitoring visit to support completion — please could you let us know your availability?`
    );
  }

  // Deviations paragraph
  if (scores.deviations >= 2) {
    const devStr = deviationsTrend.join('→');
    bodyParagraphs.push(
      `We have also noted that protocol deviations have been trending upward (${devStr} over the period). We'd appreciate a brief discussion with the PI to understand root causes and agree any corrective actions.`
    );
  }

  // Closing (always)
  if (bodyParagraphs.length === 1) {
    // No concerns — positive check-in
    bodyParagraphs.push(
      `We're pleased to see that ${site.rawName} is performing well across all metrics. Thank you for your team's continued dedication to the CARDINAL study.`
    );
  }

  bodyParagraphs.push(
    `Please do not hesitate to reach out if you have any questions, require additional support, or would like to arrange a call. We very much appreciate your team's ongoing commitment to the CARDINAL study.`
  );

  const subject = `CARDINAL Study — Site Check-In: ${site.rawName}`;
  const body = [
    `Dear ${coordName},`,
    '',
    ...bodyParagraphs.map(p => p.trim()),
    '',
    'Kind regards,',
    'The Lindus Trial Management Team',
  ].join('\n\n');

  return { subject, body, toEmail: coordEmail, toName: coordName };
}

export function generateSponsorUpdate(site, trialMeta) {
  const { scores, rag, enrolmentSummary, persistentConcern, craOverdue } = site;

  const ragLabel = rag.toUpperCase();
  const enrollPct = pct(enrolmentSummary.ratio);

  const concerns = [];
  if (scores.enrolment >= 2) concerns.push('enrolment shortfall');
  if (scores.screenFailure >= 2) concerns.push('elevated screen failure rate');
  if (scores.queryBurden >= 2) concerns.push('aged query accumulation');
  if (scores.sdv >= 2) concerns.push('SDV incompleteness');
  if (scores.deviations >= 2) concerns.push('rising protocol deviations');

  const hospital = site.hospital ? ` (${site.hospital})` : '';
  const concernText = concerns.length > 0
    ? `Key concerns: ${concerns.join(', ')}.`
    : 'No significant concerns identified at this time.';

  const actionText = (() => {
    if (scores.total >= 8) return 'Immediate escalation and targeted action plan under development.';
    if (scores.total >= 4) return 'Site under enhanced monitoring.';
    return 'Continue routine monitoring.';
  })();

  const persistentNote = persistentConcern
    ? ` Risk profile has been elevated for ${persistentConcern} consecutive months.`
    : '';

  const visitNote = craOverdue ? ' CRA monitoring visit is overdue.' : '';

  return `${site.rawName}${hospital} — ${ragLabel}. As of ${formatDate(trialMeta?.dataEnd)}, ${enrolmentSummary.cumEnrolled} of ${enrolmentSummary.cumTarget} cumulative patients enrolled (${enrollPct}); composite risk score ${scores.total}/15. ${concernText}${persistentNote}${visitNote} ${actionText}`.trim();
}

function scoreEnrolment(site) {
  const months = site.months;
  let cumTarget = 0;
  let cumEnrolled = 0;
  for (const m of months) {
    if (m.target != null) cumTarget += m.target;
    if (m.enrolled != null) cumEnrolled += m.enrolled;
  }
  if (cumTarget === 0) return 0;
  const ratio = cumEnrolled / cumTarget;
  if (ratio >= 0.9) return 0;
  if (ratio >= 0.75) return 1;
  if (ratio >= 0.5) return 2;
  return 3;
}

function scoreScreenFailure(site) {
  let totalEnrolled = 0;
  let totalFailed = 0;
  for (const m of site.months) {
    totalEnrolled += m.enrolled ?? 0;
    totalFailed += m.screenFailures ?? 0;
  }
  const denom = totalEnrolled + totalFailed;
  if (denom === 0) return 0;
  const rate = totalFailed / denom;
  if (rate < 0.3) return 0;
  if (rate < 0.5) return 1;
  if (rate < 0.7) return 2;
  return 3; // 70%+ always critical
}

function scoreQueryBurden(months) {
  if (months.length === 0) return 0;
  const latest = months[months.length - 1];
  const q = latest.queriesAged ?? 0;
  if (q === 0) return 0;
  if (q <= 3) return 1;
  if (q <= 8) return 2;
  return 3;
}

function scoreSDV(months) {
  if (months.length === 0) return 0;
  for (let i = months.length - 1; i >= 0; i--) {
    const sdv = months[i].sdvPct;
    if (sdv != null && !isNaN(sdv)) {
      if (sdv >= 0.9) return 0;
      if (sdv >= 0.8) return 1;
      if (sdv >= 0.65) return 2;
      return 3;
    }
  }
  return 0;
}

function scoreDeviations(months) {
  if (months.length === 0) return 0;
  const devs = months.map(m => m.deviations ?? 0);
  const last = devs[devs.length - 1];
  const max = Math.max(...devs);
  const isRising = devs.length > 1 && devs.every((v, i) => i === 0 || v >= devs[i - 1]);
  if (max === 0) return 0;
  if (isRising && last >= 3) return 3;
  if (max >= 3 || isRising) return 2;
  return 1;
}

function scoreMonthSnapshot(month) {
  const enrolTarget = month.target ?? 0;
  const enrolScore = enrolTarget === 0 ? 0 : (() => {
    const r = (month.enrolled ?? 0) / enrolTarget;
    if (r >= 0.9) return 0;
    if (r >= 0.75) return 1;
    if (r >= 0.5) return 2;
    return 3;
  })();

  const sfDenom = (month.enrolled ?? 0) + (month.screenFailures ?? 0);
  const sfScore = sfDenom === 0 ? 0 : (() => {
    const r = (month.screenFailures ?? 0) / sfDenom;
    if (r < 0.3) return 0;
    if (r < 0.5) return 1;
    if (r < 0.7) return 2;
    return 3;
  })();

  const q = month.queriesAged ?? 0;
  const qScore = q === 0 ? 0 : q <= 3 ? 1 : q <= 8 ? 2 : 3;

  const sdv = month.sdvPct ?? 1;
  const sdvScore = sdv >= 0.9 ? 0 : sdv >= 0.8 ? 1 : sdv >= 0.65 ? 2 : 3;

  const dev = month.deviations ?? 0;
  const devScore = dev === 0 ? 0 : dev <= 2 ? 1 : 2;

  return enrolScore + sfScore + qScore + sdvScore + devScore;
}

function trendSignal(months) {
  if (months.length < 2) return 'stable';
  const firstScore = scoreMonthSnapshot(months[0]);
  const lastScore  = scoreMonthSnapshot(months[months.length - 1]);
  const delta = lastScore - firstScore;
  if (delta >= 2) return 'deteriorating';
  if (delta === 1) return 'trending-worse';
  if (delta < 0) return 'improving';
  return 'stable';
}

function persistentConcernMonths(months) {
  if (months.length < 2) return { count: null, labels: [] };
  let maxConsecutive = 0;
  let current = 0;
  let currentLabels = [];
  let bestLabels = [];
  for (const m of months) {
    if (scoreMonthSnapshot(m) >= 6) {
      current++;
      currentLabels.push(m.month);
      if (current > maxConsecutive) {
        maxConsecutive = current;
        bestLabels = [...currentLabels];
      }
    } else {
      current = 0;
      currentLabels = [];
    }
  }
  return maxConsecutive >= 2
    ? { count: maxConsecutive, labels: bestLabels }
    : { count: null, labels: [] };
}

function extractNoteText(note) {
  if (typeof note === 'string') return note;
  if (note && typeof note === 'object') return note.text || '';
  return '';
}

function hasLeaveKeyword(notes) {
  const combined = (notes || []).map(extractNoteText).join(' ').toLowerCase();
  return ['leave', 'annual leave', 'absence', 'away', 'off sick'].some(kw => combined.includes(kw));
}

export function scoreSites(sites, trialMeta) {
  const dataEndDate = trialMeta.dataEnd;

  const scored = Object.values(sites).map(site => {
    const months = site.months;
    let cumTarget = 0;
    let cumEnrolled = 0;
    let totalScreenFailed = 0;
    for (const m of months) {
      if (m.target != null) cumTarget += m.target;
      cumEnrolled += m.enrolled ?? 0;
      totalScreenFailed += m.screenFailures ?? 0;
    }
    const sfDenom = cumEnrolled + totalScreenFailed;
    const screenFailureRate = sfDenom > 0 ? totalScreenFailed / sfDenom : 0;

    const scores = {
      enrolment:    scoreEnrolment(site),
      screenFailure: scoreScreenFailure(site),
      queryBurden:  scoreQueryBurden(months),
      sdv:          scoreSDV(months),
      deviations:   scoreDeviations(months),
    };
    const baseTotal = scores.enrolment + scores.screenFailure + scores.queryBurden + scores.sdv + scores.deviations;

    const trend = trendSignal(months);
    const persistentResult = persistentConcernMonths(months);
    const persistent = persistentResult.count;
    const persistentConcernMonthLabels = persistentResult.labels;

    const lastVisit = site.lastMonitoringVisit;
    const daysWithoutVisit = lastVisit
      ? (dataEndDate - lastVisit) / (1000 * 60 * 60 * 24)
      : Infinity;
    const craOverdue = daysWithoutVisit > 45;

    const latestMonthWithSdv = [...months].reverse().find(m => m.sdvPct != null);
    const latestSdvPct = latestMonthWithSdv ? latestMonthWithSdv.sdvPct : null;
    const latestQueriesAged = months.length > 0 ? (months[months.length - 1].queriesAged ?? 0) : 0;
    const deviationsTrend = months.map(m => m.deviations ?? 0);

    // ── Contextual modifiers ──────────────────────────────────────────────
    let adjustedTotal = baseTotal;
    const modifierFlags = [];
    const modifierNotes = [];

    // Modifier 1: Newly activated — < 2 full months of data
    const isNewlyActivated = months.length < 2;
    if (isNewlyActivated) {
      adjustedTotal = Math.max(0, adjustedTotal - 2);
      modifierFlags.push('Recently activated — limited data');
    }

    // Modifier 2: Coordinator on leave
    const onLeave = hasLeaveKeyword(site.notes || []);
    if (onLeave) {
      adjustedTotal = Math.max(0, adjustedTotal - 1);
      modifierNotes.push('Note: recent coordinator absence may affect metrics');
    }

    // Modifier 3: Persistent concern — adds 2 points
    if (persistent) {
      adjustedTotal = Math.min(15, adjustedTotal + 2);
      modifierFlags.push(`⚠ Persistent concern — ${persistent} months`);
    }

    scores.total = adjustedTotal;

    const rag = scores.total >= 8 ? 'red' : scores.total >= 4 ? 'amber' : 'green';

    return {
      ...site,
      scores,
      rag,
      trendSignal: trend,
      persistentConcern: persistent,
      craOverdue,
      lastMonitoringVisit: lastVisit,
      daysWithoutVisit: isFinite(daysWithoutVisit) ? Math.round(daysWithoutVisit) : null,
      enrolmentSummary: {
        cumEnrolled,
        cumTarget,
        ratio: cumTarget > 0 ? cumEnrolled / cumTarget : 0,
        runRate: months.length > 0 ? cumEnrolled / months.length : 0,
      },
      screenFailureRate,
      latestSdvPct,
      latestQueriesAged,
      deviationsTrend,
      modifierFlags,
      modifierNotes,
      isNewlyActivated,
      onLeave,
      persistentConcernMonthLabels,
    };
  });

  return scored.sort((a, b) => {
    if (b.scores.total !== a.scores.total) return b.scores.total - a.scores.total;
    return a.id.localeCompare(b.id);
  });
}

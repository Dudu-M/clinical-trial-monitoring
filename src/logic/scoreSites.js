import { DEFAULT_THRESHOLDS, mergeThresholds } from './defaultThresholds';

function scoreEnrolment(site, t) {
  let cumTarget = 0;
  let cumEnrolled = 0;
  for (const m of site.months) {
    if (m.target != null) cumTarget += m.target;
    if (m.enrolled != null) cumEnrolled += m.enrolled;
  }
  if (cumTarget === 0) return 0;
  const ratio = cumEnrolled / cumTarget;
  if (ratio >= t.enrolment.watch)    return 0;
  if (ratio >= t.enrolment.warn)     return 1;
  if (ratio >= t.enrolment.critical) return 2;
  return 3;
}

function scoreScreenFailure(site, t) {
  let totalEnrolled = 0;
  let totalFailed = 0;
  for (const m of site.months) {
    totalEnrolled += m.enrolled ?? 0;
    totalFailed += m.screenFailures ?? 0;
  }
  const denom = totalEnrolled + totalFailed;
  if (denom === 0) return 0;
  const rate = totalFailed / denom;
  if (rate < t.screenFailure.watch)    return 0;
  if (rate < t.screenFailure.warn)     return 1;
  if (rate < t.screenFailure.critical) return 2;
  return 3;
}

function scoreQueryBurden(months, t) {
  if (months.length === 0) return 0;
  const q = months[months.length - 1].queriesAged ?? 0;
  if (q === 0)                        return 0;
  if (q <= t.queryBurden.watch)       return 1;
  if (q <= t.queryBurden.warn)        return 2;
  return 3;
}

function scoreSDV(months, t) {
  if (months.length === 0) return 0;
  for (let i = months.length - 1; i >= 0; i--) {
    const sdv = months[i].sdvPct;
    if (sdv != null && !isNaN(sdv)) {
      if (sdv >= t.sdv.watch)    return 0;
      if (sdv >= t.sdv.warn)     return 1;
      if (sdv >= t.sdv.critical) return 2;
      return 3;
    }
  }
  return 0;
}

function scoreDeviations(months, t) {
  if (months.length === 0) return 0;
  const devs = months.map(m => m.deviations ?? 0);
  const last  = devs[devs.length - 1];
  const max   = Math.max(...devs);
  const isRising = devs.length > 1 && devs.every((v, i) => i === 0 || v >= devs[i - 1]);

  if (max < t.deviations.watch) return 0;
  if (isRising && last >= t.deviations.critical) return 3;
  if (max >= t.deviations.critical || (isRising && max >= t.deviations.warn)) return 2;
  if (max >= t.deviations.warn) return 2;
  return 1; // max >= watch
}

// Internal snapshot scorer — uses defaults, only for trend/persistent tracking
function scoreMonthSnapshot(month) {
  const t = DEFAULT_THRESHOLDS;
  const enrolTarget = month.target ?? 0;
  const enrolScore = enrolTarget === 0 ? 0 : (() => {
    const r = (month.enrolled ?? 0) / enrolTarget;
    if (r >= t.enrolment.watch)    return 0;
    if (r >= t.enrolment.warn)     return 1;
    if (r >= t.enrolment.critical) return 2;
    return 3;
  })();

  const sfDenom = (month.enrolled ?? 0) + (month.screenFailures ?? 0);
  const sfScore = sfDenom === 0 ? 0 : (() => {
    const r = (month.screenFailures ?? 0) / sfDenom;
    if (r < t.screenFailure.watch)    return 0;
    if (r < t.screenFailure.warn)     return 1;
    if (r < t.screenFailure.critical) return 2;
    return 3;
  })();

  const q = month.queriesAged ?? 0;
  const qScore = q === 0 ? 0 : q <= t.queryBurden.watch ? 1 : q <= t.queryBurden.warn ? 2 : 3;

  const sdv = month.sdvPct ?? 1;
  const sdvScore = sdv >= t.sdv.watch ? 0 : sdv >= t.sdv.warn ? 1 : sdv >= t.sdv.critical ? 2 : 3;

  const dev = month.deviations ?? 0;
  const devScore = dev < t.deviations.watch ? 0 : dev < t.deviations.warn ? 1 : 2;

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

export function scoreSites(sites, trialMeta, savedThresholds) {
  const t = mergeThresholds(savedThresholds);
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
      enrolment:     scoreEnrolment(site, t),
      screenFailure: scoreScreenFailure(site, t),
      queryBurden:   scoreQueryBurden(months, t),
      sdv:           scoreSDV(months, t),
      deviations:    scoreDeviations(months, t),
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
    const craOverdue = daysWithoutVisit > t.craOverdueDays;

    const latestMonthWithSdv = [...months].reverse().find(m => m.sdvPct != null);
    const latestSdvPct = latestMonthWithSdv ? latestMonthWithSdv.sdvPct : null;
    const latestQueriesAged = months.length > 0 ? (months[months.length - 1].queriesAged ?? 0) : 0;
    const deviationsTrend = months.map(m => m.deviations ?? 0);

    // ── Contextual modifiers ─────────────────────────────────────────────
    let adjustedTotal = baseTotal;
    const modifierFlags = [];
    const modifierNotes = [];

    const isNewlyActivated = months.length < 2;
    if (isNewlyActivated) {
      adjustedTotal = Math.max(0, adjustedTotal - 2);
      modifierFlags.push('Recently activated — limited data');
    }

    const onLeave = hasLeaveKeyword(site.notes || []);
    if (onLeave) {
      adjustedTotal = Math.max(0, adjustedTotal - 1);
      modifierNotes.push('Note: recent coordinator absence may affect metrics');
    }

    if (persistent) {
      adjustedTotal = Math.min(15, adjustedTotal + 2);
      modifierFlags.push(`⚠ Persistent concern — ${persistent} months`);
    }

    scores.total = adjustedTotal;
    const rag = scores.total >= t.rag.red ? 'red' : scores.total >= t.rag.amber ? 'amber' : 'green';

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

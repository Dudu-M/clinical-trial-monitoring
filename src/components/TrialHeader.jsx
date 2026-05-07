function formatDateRange(start, end) {
  if (!start || !end) return '';
  const opts = { month: 'short', year: 'numeric' };
  return `${start.toLocaleDateString('en-GB', opts)} – ${end.toLocaleDateString('en-GB', opts)}`;
}

export default function TrialHeader({ trialMeta, rankedSites, onReset }) {
  const totalEnrolled = rankedSites.reduce((s, site) => s + (site.enrolmentSummary?.cumEnrolled ?? 0), 0);
  const totalTarget = trialMeta.totalTarget || 120;
  const remaining = Math.max(0, totalTarget - totalEnrolled);

  // Calculate months remaining from data end to an assumed trial end
  // We don't have an explicit end date, so calculate run rate from data
  const dataMonthCount = rankedSites.reduce((max, site) => Math.max(max, site.months?.length ?? 0), 0);
  const avgMonthlyRate = dataMonthCount > 0 ? totalEnrolled / dataMonthCount : 0;

  // Required run rate: remaining patients / assumed 4 more months
  const remainingMonths = 4;
  const requiredRate = remainingMonths > 0 ? remaining / remainingMonths : 0;

  const onTrack = avgMonthlyRate >= requiredRate;

  const periodLabel = formatDateRange(trialMeta.dataStart, trialMeta.dataEnd);

  return (
    <div className="trial-header">
      <div className="trial-header-top">
        <div className="trial-header-meta">
          <div className="trial-header-logo">
            <span className="trial-logo-mark">◆</span>
            Lindus Health
          </div>
          <div className="trial-header-divider" />
          <div>
            <h1 className="trial-name">CARDINAL</h1>
            <p className="trial-sponsor">{trialMeta.sponsor}</p>
          </div>
        </div>
        <div className="trial-header-actions">
          <span className="trial-period">{periodLabel}</span>
          <button className="btn-secondary" onClick={onReset}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Upload new file
          </button>
        </div>
      </div>

      <div className="trial-trajectory">
        <div className="trajectory-stat">
          <span className="trajectory-label">Enrolled</span>
          <span className="trajectory-value">{totalEnrolled} <span className="trajectory-denom">/ {totalTarget}</span></span>
        </div>
        <div className="trajectory-stat">
          <span className="trajectory-label">Remaining</span>
          <span className="trajectory-value">{remaining}</span>
        </div>
        <div className="trajectory-stat">
          <span className="trajectory-label">Current rate</span>
          <span className={`trajectory-value ${onTrack ? 'text-green' : 'text-red'}`}>
            {avgMonthlyRate.toFixed(1)}<span className="trajectory-denom">/month</span>
          </span>
        </div>
        <div className="trajectory-stat">
          <span className="trajectory-label">Required rate</span>
          <span className="trajectory-value">{requiredRate.toFixed(1)}<span className="trajectory-denom">/month</span></span>
        </div>
        <div className="trajectory-pill-wrap">
          <span className={`trajectory-pill ${onTrack ? 'trajectory-pill--green' : 'trajectory-pill--red'}`}>
            {onTrack ? '↑ On track' : '↓ Below required rate'}
          </span>
        </div>
      </div>

      <div className="trajectory-sentence">
        {totalEnrolled} of {totalTarget} patients enrolled. {remaining} remaining across an estimated {remainingMonths} months.
        Required run rate: {requiredRate.toFixed(1)}/month. Current rate: {avgMonthlyRate.toFixed(1)}/month
        {' '}
        <span className={onTrack ? 'text-green' : 'text-red'}>
          ({onTrack ? 'on track' : 'below required rate'})
        </span>.
      </div>
    </div>
  );
}

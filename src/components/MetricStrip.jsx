function ScoreDot({ score }) {
  const cls = ['score-dot', `score-dot--${score}`].join(' ');
  return <span className={cls} title={`Score: ${score}/3`} />;
}

function DevSparkline({ values }) {
  if (!values || values.length === 0) return <span className="metric-no-data">—</span>;
  if (values.length === 1) return <span>{values[0]}</span>;

  const w = 60;
  const h = 24;
  const max = Math.max(...values, 1);
  const step = w / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * step;
    const y = h - (v / max) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  const last = values[values.length - 1];
  const first = values[0];
  const arrow = last > first ? ' ↑' : last < first ? ' ↓' : '';
  const color = last > first ? 'var(--red)' : last < first ? 'var(--green)' : 'var(--slate)';

  return (
    <span className="dev-sparkline-wrap">
      <svg width={w} height={h} className="dev-sparkline">
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
        {values.map((v, i) => (
          <circle key={i} cx={i * step} cy={h - (v / max) * (h - 4) - 2} r="2" fill={color} />
        ))}
      </svg>
      <span style={{ color }} className="dev-sparkline-label">
        {values.join('→')}{arrow}
      </span>
    </span>
  );
}

export default function MetricStrip({ site }) {
  const { scores, enrolmentSummary, screenFailureRate, latestSdvPct,
    latestQueriesAged, deviationsTrend, months } = site;

  const enrollPct = Math.round((enrolmentSummary?.ratio ?? 0) * 100);
  const sfPct = Math.round((screenFailureRate ?? 0) * 100);
  const sdvPct = latestSdvPct != null ? Math.round(latestSdvPct * 100) : null;

  return (
    <div className="metric-strip">
      <div className={`metric-item metric-item--${scores.enrolment}`}>
        <span className="metric-label">Enrolment vs target</span>
        <span className="metric-value">
          {enrolmentSummary.cumEnrolled}/{enrolmentSummary.cumTarget}
          <span className="metric-sub"> — {enrollPct}%</span>
        </span>
        <ScoreDot score={scores.enrolment} />
      </div>

      <div className={`metric-item metric-item--${scores.screenFailure}`}>
        <span className="metric-label">Screen failure rate</span>
        <span className="metric-value">{sfPct}%</span>
        <ScoreDot score={scores.screenFailure} />
      </div>

      <div className={`metric-item metric-item--${scores.queryBurden}`}>
        <span className="metric-label">Aged queries (&gt;14d)</span>
        <span className="metric-value">{latestQueriesAged ?? 0} queries</span>
        <ScoreDot score={scores.queryBurden} />
      </div>

      <div className={`metric-item metric-item--${scores.sdv}`}>
        <span className="metric-label">SDV completion</span>
        <span className="metric-value">{sdvPct != null ? `${sdvPct}%` : 'No data'}</span>
        <ScoreDot score={scores.sdv} />
      </div>

      <div className={`metric-item metric-item--${scores.deviations}`}>
        <span className="metric-label">Protocol deviations</span>
        <span className="metric-value">
          <DevSparkline values={deviationsTrend} />
        </span>
        <ScoreDot score={scores.deviations} />
      </div>
    </div>
  );
}

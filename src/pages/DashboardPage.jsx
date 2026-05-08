import { useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../store/AppContext';
import { scoreSites } from '../logic/scoreSites';
import { generateHeadline, generateSummary } from '../logic/generateSummary';
import RagBadge from '../components/shared/RagBadge';
import DataQualityBanner from '../components/shared/DataQualityBanner';

function pct(ratio) { return Math.round((ratio ?? 0) * 100) + '%'; }

function TrendBadge({ signal, rag }) {
  // Only show trend when it adds information: red/amber always; green only if improving
  if (rag === 'green' && signal !== 'improving') return null;

  const map = {
    deteriorating:    { cls: 'trend-deteriorating',  label: '↓ Deteriorating' },
    'trending-worse': { cls: 'trend-trending-worse', label: '↘ Trending worse' },
    stable:           { cls: 'trend-stable',          label: '→ Stable' },
    improving:        { cls: 'trend-improving',       label: '↑ Improving' },
  };
  const { cls, label } = map[signal] || map.stable;
  return <span className={`trend-badge ${cls}`}>{label}</span>;
}

function PersistentFlag({ site }) {
  if (!site.persistentConcern) return null;
  const months = site.persistentConcernMonthLabels || [];
  return (
    <div className="persistent-tooltip">
      <span className="flag-chip red">⚠ Persistent concern — {site.persistentConcern} months</span>
      {months.length > 0 && (
        <div className="persistent-tooltip-box">
          High-risk score in: {months.join(', ')}
        </div>
      )}
    </div>
  );
}

function SiteCard({ site, rank, trialMeta }) {
  const navigate = useNavigate();
  const { id } = useParams();

  const ragCardCls = site.rag === 'red' ? 'rag-red-card' : site.rag === 'amber' ? 'rag-amber-card' : 'rag-green-card';
  const scoreCls   = site.rag === 'red' ? 'red' : site.rag === 'amber' ? 'amber' : 'green';
  const headline   = site.rag === 'green' ? generateSummary(site, trialMeta) : generateHeadline(site, trialMeta);
  const isAtRisk   = site.rag === 'red' || site.rag === 'amber';

  const sfPct    = Math.round((site.screenFailureRate || 0) * 100);
  const sdvPct   = site.latestSdvPct != null ? Math.round(site.latestSdvPct * 100) : null;
  const devTrend = (site.deviationsTrend || []).join('→') || '—';

  const metrics = [
    { label: 'Enrolment', value: pct(site.enrolmentSummary?.ratio), warn: (site.enrolmentSummary?.ratio ?? 1) < 0.75 },
    { label: 'Screen fail', value: sfPct + '%', warn: sfPct >= 30 },
    { label: 'Aged queries', value: site.latestQueriesAged ?? '—', warn: (site.latestQueriesAged ?? 0) > 3 },
    { label: 'SDV', value: sdvPct != null ? sdvPct + '%' : '—', warn: sdvPct != null && sdvPct < 80 },
    { label: 'Deviations', value: devTrend, warn: false },
  ];

  // Last 2 operational notes for at-risk sites
  const recentNotes = isAtRisk ? (site.noteHistory || []).slice(-2) : [];

  return (
    <div
      className={`site-rank-card ${ragCardCls} site-rank-card--clickable`}
      onClick={() => navigate(`/trial/${id}/sites/${site.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate(`/trial/${id}/sites/${site.id}`); }}
    >
      <div className="site-rank-header" style={{ cursor: 'pointer' }}>
        <span className="site-rank-number">#{rank}</span>

        <div className="site-rank-info">
          <div className="site-rank-name">{site.rawName}</div>
          {site.hospital && <div className="site-rank-hospital">{site.hospital}</div>}
        </div>

        <div className="site-rank-signals">
          <RagBadge status={site.rag === 'red' ? 'Red' : site.rag === 'amber' ? 'Amber' : 'Green'} />
          <TrendBadge signal={site.trendSignal} rag={site.rag} />
          <span className={`site-rank-score ${scoreCls}`}>{site.scores?.total}</span>
          <span style={{ color: 'var(--text-muted)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </span>
        </div>
      </div>

      {/* Flags row */}
      {(site.craOverdue || (site.modifierFlags && site.modifierFlags.length > 0)) && (
        <div style={{ padding: '0 20px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {site.modifierFlags && site.modifierFlags.map((f, i) =>
            f.includes('Persistent') ? (
              <PersistentFlag key={i} site={site} />
            ) : (
              <span key={i} className={`flag-chip ${f.includes('⚠') ? 'red' : 'info'}`}>{f}</span>
            )
          )}
          {site.craOverdue && !site.modifierFlags?.some(f => f.includes('CRA')) && (
            <span className="flag-chip amber">CRA visit overdue</span>
          )}
        </div>
      )}

      {/* Headline */}
      <div style={{ padding: '0 20px 12px', fontSize: 13, color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: 1.5 }}>
        {headline}
      </div>

      {/* Metric strip */}
      <div className="site-card-metrics">
        {metrics.map(m => (
          <div key={m.label} className={`site-card-metric${m.warn ? ' warn' : ''}`}>
            <div className="site-card-metric-val">{m.value}</div>
            <div className="site-card-metric-label">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Operational notes — last 2, at-risk sites only */}
      {recentNotes.length > 0 && (
        <div className="site-card-notes">
          <div className="site-card-notes-label">Recent notes</div>
          {recentNotes.map((n, i) => (
            <div key={i} className="site-card-note">
              {n.month && <span className="site-card-note-month">{n.month}</span>}
              <span className="site-card-note-text">{n.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function buildTrialMeta(trial) {
  const allMonthDates = Object.values(trial.sites || {})
    .flatMap(s => (s.months || []).map(m => new Date(m.date)));
  const dataStart = allMonthDates.length > 0 ? new Date(Math.min(...allMonthDates)) : new Date();
  const dataEnd   = allMonthDates.length > 0 ? new Date(Math.max(...allMonthDates)) : new Date();
  const dataEndMonth = new Date(dataEnd.getFullYear(), dataEnd.getMonth() + 1, 0);
  return {
    trialName: trial.name,
    sponsor: trial.sponsor,
    totalTarget: trial.totalTarget || 120,
    dataStart,
    dataEnd: dataEndMonth,
  };
}

function monthsRemainingFrom(iso) {
  if (!iso) return null;
  const now = new Date();
  const target = new Date(iso);
  const m = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  return Math.max(0, m);
}

export default function DashboardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useAppStore();
  const trial = state.trials[id];

  if (!trial) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Trial not found</div>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Back to trials</button>
      </div>
    );
  }

  const hasSites = Object.keys(trial.sites || {}).length > 0;
  const trialMeta = buildTrialMeta(trial);
  const rankedSites = hasSites ? scoreSites(trial.sites, trialMeta, trial.thresholds) : [];

  const totalEnrolled = rankedSites.reduce((s, site) => s + (site.enrolmentSummary?.cumEnrolled || 0), 0);
  const remaining     = (trial.totalTarget || 0) - totalEnrolled;
  const pctOfTarget   = trial.totalTarget ? Math.round((totalEnrolled / trial.totalTarget) * 100) : null;

  const monthsRemaining = trial.monthsRemainingFromSheet != null
    ? trial.monthsRemainingFromSheet
    : monthsRemainingFrom(trial.targetCompletionDate);

  const allMonthDates = Object.values(trial.sites || {}).flatMap(s => (s.months || []).map(m => new Date(m.date)));
  const uniqueMonths  = allMonthDates.length > 0
    ? new Set(allMonthDates.map(d => `${d.getFullYear()}-${d.getMonth()}`)).size
    : 1;

  const currentRunRate  = uniqueMonths > 0 ? (totalEnrolled / uniqueMonths).toFixed(1) : null;
  const requiredRunRate = trial.requiredRunRate
    || (monthsRemaining && trial.totalTarget
      ? ((trial.totalTarget - totalEnrolled) / Math.max(1, monthsRemaining)).toFixed(1)
      : null);

  const isOnTrack = currentRunRate && requiredRunRate && Number(currentRunRate) >= Number(requiredRunRate);

  const redSites   = rankedSites.filter(s => s.rag === 'red').length;
  const amberSites = rankedSites.filter(s => s.rag === 'amber').length;
  const greenSites = rankedSites.length - redSites - amberSites;

  const dataRange = (() => {
    if (allMonthDates.length === 0) return '';
    const lo = new Date(Math.min(...allMonthDates));
    const hi = new Date(Math.max(...allMonthDates));
    const fmt = d => d.toLocaleString('en-GB', { month: 'short', year: 'numeric' });
    return lo.getTime() === hi.getTime() ? fmt(lo) : `${fmt(lo)} – ${fmt(hi)}`;
  })();

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 className="page-title">{trial.name}</h1>
            {hasSites && (
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {redSites > 0   && <span className="rag-pill red">{redSites} Red</span>}
                {amberSites > 0 && <span className="rag-pill amber">{amberSites} Amber</span>}
                {greenSites > 0 && <span className="rag-pill green">{greenSites} Green</span>}
                {isOnTrack !== null && (
                  <span className={`trial-stat-track ${isOnTrack ? 'on-track' : 'off-track'}`} style={{ fontSize: 12, padding: '3px 10px' }}>
                    {isOnTrack ? '↑ On track' : '↓ Off track'}
                  </span>
                )}
              </div>
            )}
          </div>
          <p className="text-secondary" style={{ marginTop: 4, fontSize: 13 }}>
            {trial.sponsor}{trial.indication ? ` · ${trial.indication}` : ''}
            {dataRange && <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>· {dataRange}</span>}
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={() => navigate(`/trial/${id}/data`)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Upload Data
          </button>
          <button className="btn btn-secondary" onClick={() => navigate(`/trial/${id}/reports`)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            Reports
          </button>
        </div>
      </div>

      <DataQualityBanner notices={trial.dataQualityNotices} trialId={id} />

      {/* Trial stat bar */}
      {hasSites && (
        <div className="trial-stat-bar">
          <div className="trial-stat">
            <div className="trial-stat-label">Enrolled</div>
            <div className="trial-stat-value">
              {totalEnrolled}<span className="trial-stat-total">/{trial.totalTarget || '—'}</span>
            </div>
            {pctOfTarget !== null && (
              <div className="trial-stat-sub">{pctOfTarget}% of target</div>
            )}
          </div>

          <div className="trial-stat-divider" />

          <div className="trial-stat">
            <div className="trial-stat-label">Remaining</div>
            <div className="trial-stat-value">{Math.max(0, remaining)}</div>
            <div className="trial-stat-sub">patients to target</div>
          </div>

          {monthsRemaining !== null && (
            <>
              <div className="trial-stat-divider" />
              <div className={`trial-stat ${monthsRemaining <= 1 ? 'bad' : monthsRemaining <= 3 ? 'warn' : ''}`}>
                <div className="trial-stat-label">Months Left</div>
                <div className="trial-stat-value">{monthsRemaining}</div>
                <div className="trial-stat-sub">to completion</div>
              </div>
            </>
          )}

          {currentRunRate && (
            <>
              <div className="trial-stat-divider" />
              <div className={`trial-stat ${isOnTrack ? 'good' : 'bad'}`}>
                <div className="trial-stat-label">Current Rate</div>
                <div className="trial-stat-value">{currentRunRate}<span className="trial-stat-unit">/mo</span></div>
                <div className="trial-stat-sub">actual enrolment</div>
              </div>
            </>
          )}

          {requiredRunRate && (
            <>
              <div className="trial-stat-divider" />
              <div className="trial-stat">
                <div className="trial-stat-label">Required Rate</div>
                <div className="trial-stat-value">{requiredRunRate}<span className="trial-stat-unit">/mo</span></div>
                <div className="trial-stat-sub">to hit target</div>
              </div>
            </>
          )}

        </div>
      )}

      {/* Site ranking */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 className="section-title">
          Site Performance Ranking
          <span className="text-muted" style={{ fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
            worst → best · click to view detail
          </span>
        </h2>
      </div>

      {!hasSites ? (
        <div className="card card-pad-lg">
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-title">No data uploaded yet</div>
            <div className="empty-state-text">
              Upload an Excel file to start tracking site performance.
            </div>
            <button className="btn btn-primary" onClick={() => navigate(`/trial/${id}/data`)}>Upload Data</button>
          </div>
        </div>
      ) : (
        <div className="site-cards">
          {rankedSites.map((site, i) => (
            <SiteCard key={site.id} site={site} rank={i + 1} trialMeta={trialMeta} />
          ))}
        </div>
      )}
    </div>
  );
}

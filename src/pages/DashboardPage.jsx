import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../store/AppContext';
import { scoreSites } from '../logic/scoreSites';
import { generateSummary } from '../logic/generateSummary';
import RagBadge from '../components/shared/RagBadge';
import DataQualityBanner from '../components/shared/DataQualityBanner';

function TrendBadge({ signal }) {
  const map = {
    deteriorating:  { cls: 'trend-deteriorating',  label: '↓ Deteriorating' },
    'trending-worse': { cls: 'trend-trending-worse', label: '↘ Trending worse' },
    stable:         { cls: 'trend-stable',          label: '→ Stable' },
    improving:      { cls: 'trend-improving',       label: '↑ Improving' },
  };
  const { cls, label } = map[signal] || map.stable;
  return <span className={`trend-badge ${cls}`}>{label}</span>;
}

function DimPill({ label, score }) {
  const cls = `dimension-pill-score s${score}`;
  return (
    <div className="dimension-pill">
      <span className="dimension-pill-label">{label}</span>
      <span className={cls}>{score}</span>
    </div>
  );
}

function SiteRankCard({ site, rank, trialMeta }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();

  const ragCardCls = site.rag === 'red' ? 'rag-red-card' : site.rag === 'amber' ? 'rag-amber-card' : 'rag-green-card';
  const scoreCls = site.rag === 'red' ? 'red' : site.rag === 'amber' ? 'amber' : 'green';

  const summary = generateSummary(site, trialMeta);

  const flags = [];
  if (site.scores.enrolment >= 2) flags.push({ cls: site.rag, text: 'Enrolment deficit' });
  if (site.scores.screenFailure >= 2) flags.push({ cls: 'red', text: 'Screen failure rate' });
  if (site.scores.queryBurden >= 2) flags.push({ cls: 'amber', text: 'Aged queries' });
  if (site.scores.sdv >= 2) flags.push({ cls: 'amber', text: 'SDV incomplete' });
  if (site.scores.deviations >= 2) flags.push({ cls: 'amber', text: 'Protocol deviations' });
  if (site.craOverdue) flags.push({ cls: 'info', text: 'CRA visit overdue' });
  if (site.persistentConcern) flags.push({ cls: 'red', text: `Risk elevated ${site.persistentConcern}+ months` });

  return (
    <div className={`site-rank-card ${ragCardCls}`}>
      <div className="site-rank-header" onClick={() => setOpen(o => !o)}>
        <span className="site-rank-number">#{rank}</span>
        <div className="site-rank-info">
          <div className="site-rank-name">{site.rawName}</div>
          {site.hospital && <div className="site-rank-hospital">{site.hospital}</div>}
        </div>
        <div className="site-rank-signals">
          <RagBadge status={site.rag === 'red' ? 'Red' : site.rag === 'amber' ? 'Amber' : 'Green'} />
          <TrendBadge signal={site.trendSignal} />
          <span className={`site-rank-score ${scoreCls}`}>{site.scores.total}</span>
          <span className={`site-rank-chevron${open ? ' open' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </span>
        </div>
      </div>

      {open && (
        <div className="site-rank-body">
          {/* Why flagged summary */}
          <div className="site-rank-summary">{summary}</div>

          {/* Dimension breakdown */}
          <div className="site-rank-dimensions">
            <DimPill label="Enrolment" score={site.scores.enrolment} />
            <DimPill label="Screen fail" score={site.scores.screenFailure} />
            <DimPill label="Queries" score={site.scores.queryBurden} />
            <DimPill label="SDV" score={site.scores.sdv} />
            <DimPill label="Deviations" score={site.scores.deviations} />
          </div>

          {/* Flag chips */}
          {flags.length > 0 && (
            <div className="site-rank-flags">
              {flags.map((f, i) => (
                <span key={i} className={`flag-chip ${f.cls}`}>
                  {f.text}
                </span>
              ))}
            </div>
          )}

          <div className="site-rank-actions">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate(`/trial/${id}/sites/${site.id}`)}
            >
              View full detail →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatMonthsRemaining(targetDate) {
  if (!targetDate) return null;
  const now = new Date();
  const target = new Date(targetDate);
  const months = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  return Math.max(0, months);
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
  const rankedSites = hasSites ? scoreSites(trial.sites, buildTrialMeta(trial)) : [];
  const trialMeta = buildTrialMeta(trial);

  const totalEnrolled = rankedSites.reduce((s, site) => s + (site.enrolmentSummary?.cumEnrolled || 0), 0);
  const pctOfTarget = trial.totalTarget ? Math.round((totalEnrolled / trial.totalTarget) * 100) : null;
  const activeSites = rankedSites.filter(s => s.months && s.months.length > 0).length;
  const monthsRemaining = formatMonthsRemaining(trial.targetCompletionDate);

  const totalTarget = trial.totalTarget || 0;
  const avgRunRate = activeSites > 0
    ? (rankedSites.reduce((s, site) => s + (site.enrolmentSummary?.runRate || 0), 0) / activeSites).toFixed(1)
    : null;
  const requiredRunRate = (monthsRemaining && totalTarget)
    ? ((totalTarget - totalEnrolled) / Math.max(1, monthsRemaining)).toFixed(1)
    : null;

  const redSites = rankedSites.filter(s => s.rag === 'red').length;
  const amberSites = rankedSites.filter(s => s.rag === 'amber').length;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{trial.name}</h1>
          <p className="text-secondary" style={{ marginTop: 4, fontSize: 13 }}>
            {trial.sponsor}{trial.indication ? ` · ${trial.indication}` : ''}
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

      {/* Data quality notices */}
      <DataQualityBanner notices={trial.dataQualityNotices} />

      {/* Metric strip */}
      {hasSites && (
        <div className="metric-strip">
          <div className="metric-card">
            <div className="label metric-card-label">Active Sites</div>
            <div className="metric-card-value">{activeSites}</div>
            <div className="metric-card-sub">{rankedSites.length} total</div>
          </div>
          <div className="metric-card">
            <div className="label metric-card-label">Enrolled to Date</div>
            <div className="metric-card-value">{totalEnrolled}</div>
            <div className="metric-card-sub">of {trial.totalTarget || '—'} target</div>
          </div>
          {pctOfTarget !== null && (
            <div className={`metric-card ${pctOfTarget >= 90 ? 'good' : pctOfTarget >= 70 ? '' : 'warn'}`}>
              <div className="label metric-card-label">% of Target</div>
              <div className="metric-card-value">{pctOfTarget}%</div>
              <div className="metric-card-sub">cumulative</div>
            </div>
          )}
          {monthsRemaining !== null && (
            <div className={`metric-card ${monthsRemaining > 3 ? '' : monthsRemaining > 1 ? 'warn' : 'bad'}`}>
              <div className="label metric-card-label">Months Remaining</div>
              <div className="metric-card-value">{monthsRemaining}</div>
              <div className="metric-card-sub">to target completion</div>
            </div>
          )}
          {requiredRunRate && (
            <div className="metric-card">
              <div className="label metric-card-label">Required Run Rate</div>
              <div className="metric-card-value">{requiredRunRate}</div>
              <div className="metric-card-sub">pts/site/month needed</div>
            </div>
          )}
          {avgRunRate && (
            <div className={`metric-card ${Number(avgRunRate) >= Number(requiredRunRate) ? 'good' : 'bad'}`}>
              <div className="label metric-card-label">Current Run Rate</div>
              <div className="metric-card-value">{avgRunRate}</div>
              <div className="metric-card-sub">pts/site/month actual</div>
            </div>
          )}
          <div className="metric-card">
            <div className="label metric-card-label">Site RAG</div>
            <div className="metric-card-value" style={{ fontSize: 14, display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
              {redSites > 0 && <span style={{ color: 'var(--red)', fontWeight: 700, fontSize: 22 }}>{redSites}</span>}
              {redSites > 0 && <span style={{ fontSize: 12, color: 'var(--red)' }}>Red</span>}
              {amberSites > 0 && <span style={{ color: 'var(--amber)', fontWeight: 700, fontSize: 22, marginLeft: 6 }}>{amberSites}</span>}
              {amberSites > 0 && <span style={{ fontSize: 12, color: 'var(--amber)' }}>Amber</span>}
              {redSites === 0 && amberSites === 0 && <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: 22 }}>All</span>}
              {redSites === 0 && amberSites === 0 && <span style={{ fontSize: 12, color: 'var(--green)' }}>Green</span>}
            </div>
            <div className="metric-card-sub">site performance</div>
          </div>
        </div>
      )}

      {/* Site ranking */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 className="section-title">
          Site Performance Ranking
          <span className="text-muted" style={{ fontWeight: 400, marginLeft: 8, fontSize: 12 }}>worst → best · click to expand</span>
        </h2>
      </div>

      {!hasSites ? (
        <div className="card card-pad-lg">
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-title">No data uploaded yet</div>
            <div className="empty-state-text">
              Upload an Excel file with enrolment and quality data to start tracking site performance.
            </div>
            <button className="btn btn-primary" onClick={() => navigate(`/trial/${id}/data`)}>
              Upload Data
            </button>
          </div>
        </div>
      ) : (
        <div className="site-cards">
          {rankedSites.map((site, i) => (
            <SiteRankCard key={site.id} site={site} rank={i + 1} trialMeta={trialMeta} />
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
    startDate: trial.startDate ? new Date(trial.startDate) : null,
    targetCompletionDate: trial.targetCompletionDate ? new Date(trial.targetCompletionDate) : null,
    dataStart,
    dataEnd: dataEndMonth,
  };
}

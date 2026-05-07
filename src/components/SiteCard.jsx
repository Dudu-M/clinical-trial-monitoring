import { useState } from 'react';
import MetricStrip from './MetricStrip';
import ExplainabilityPanel from './ExplainabilityPanel';
import CommunicationsDrawer from './CommunicationsDrawer';

function RagBadge({ rag }) {
  const label = { red: 'Red', amber: 'Amber', green: 'Green' }[rag] || rag;
  return <span className={`rag-badge rag-badge--${rag}`}>{label}</span>;
}

function TrendSignalChip({ signal }) {
  const map = {
    deteriorating: { label: '↑ Deteriorating', cls: 'trend--red' },
    'trending-worse': { label: '↑ Trending worse', cls: 'trend--amber' },
    stable: { label: '→ Stable', cls: 'trend--neutral' },
    improving: { label: '↓ Improving', cls: 'trend--green' },
  };
  const { label, cls } = map[signal] || map.stable;
  return <span className={`trend-chip ${cls}`}>{label}</span>;
}

function formatDate(date) {
  if (!date) return '—';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function SiteCard({ site, trialMeta, rank }) {
  const [commsOpen, setCommsOpen] = useState(false);

  return (
    <div className={`site-card site-card--${site.rag}`}>
      <div className="site-card-body">
        {/* Left column */}
        <div className="site-card-left">
          <div className="site-rank">#{rank}</div>
          <h2 className="site-name">{site.rawName}</h2>
          {site.hospital && <p className="site-hospital">{site.hospital}</p>}

          <div className="site-signals">
            <RagBadge rag={site.rag} />
            <TrendSignalChip signal={site.trendSignal} />
          </div>

          {site.persistentConcern && (
            <div className="site-persistent-flag">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              Persistent concern — {site.persistentConcern} month{site.persistentConcern !== 1 ? 's' : ''}
            </div>
          )}

          {site.craOverdue && (
            <div className="site-cra-flag">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              CRA visit overdue{site.lastMonitoringVisit ? ` — last visit ${formatDate(site.lastMonitoringVisit)}` : ''}
            </div>
          )}

          <div className="site-score">
            <span className="site-score-label">Risk score</span>
            <span className={`site-score-value score-color--${site.rag}`}>
              {site.scores.total}<span className="site-score-denom">/15</span>
            </span>
          </div>
        </div>

        {/* Centre: metric strip */}
        <div className="site-card-center">
          <MetricStrip site={site} />
        </div>

        {/* Right: explainability */}
        <div className="site-card-right">
          <ExplainabilityPanel site={site} trialMeta={trialMeta} />
        </div>
      </div>

      {/* Communications drawer toggle */}
      <div className="site-card-footer">
        <button
          className={`comms-toggle ${commsOpen ? 'comms-toggle--open' : ''}`}
          onClick={() => setCommsOpen(o => !o)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {commsOpen ? 'Hide communications' : 'Show communications'}
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ transform: commsOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>

      <CommunicationsDrawer site={site} trialMeta={trialMeta} open={commsOpen} />
    </div>
  );
}

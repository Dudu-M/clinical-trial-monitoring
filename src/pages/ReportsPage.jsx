import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../store/AppContext';
import { scoreSites } from '../logic/scoreSites';
import { generateSponsorUpdate } from '../logic/generateEmail';
import RagBadge from '../components/shared/RagBadge';
import CopyButton from '../components/shared/CopyButton';

function buildTrialMeta(trial) {
  const allMonthDates = Object.values(trial.sites || {})
    .flatMap(s => (s.months || []).map(m => new Date(m.date)));
  const dataEnd   = allMonthDates.length > 0 ? new Date(Math.max(...allMonthDates)) : new Date();
  const dataEndMonth = new Date(dataEnd.getFullYear(), dataEnd.getMonth() + 1, 0);
  return {
    trialName: trial.name,
    sponsor: trial.sponsor,
    totalTarget: trial.totalTarget || 120,
    dataStart: allMonthDates.length > 0 ? new Date(Math.min(...allMonthDates)) : new Date(),
    dataEnd: dataEndMonth,
  };
}

export default function ReportsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useAppStore();
  const trial = state.trials[id];
  const [copiedAll, setCopiedAll] = useState(false);

  if (!trial) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Trial not found</div>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Back to trials</button>
      </div>
    );
  }

  const hasSites = Object.keys(trial.sites || {}).length > 0;

  if (!hasSites) {
    return (
      <div>
        <div className="page-header">
          <div className="page-header-left">
            <h1 className="page-title">Sponsor Reports</h1>
          </div>
        </div>
        <div className="card card-pad-lg">
          <div className="empty-state">
            <div className="empty-state-icon">📄</div>
            <div className="empty-state-title">No data yet</div>
            <div className="empty-state-text">Upload trial data first to generate sponsor update paragraphs.</div>
            <button className="btn btn-primary" onClick={() => navigate(`/trial/${id}/data`)}>Upload Data</button>
          </div>
        </div>
      </div>
    );
  }

  const trialMeta = buildTrialMeta(trial);
  const rankedSites = scoreSites(trial.sites, trialMeta);

  const allUpdates = rankedSites.map(site => generateSponsorUpdate(site, trialMeta)).join('\n\n');

  function handleCopyAll() {
    navigator.clipboard.writeText(allUpdates);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  }

  const dataEndLabel = trialMeta.dataEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Sponsor Reports</h1>
          <p className="text-secondary" style={{ marginTop: 4, fontSize: 13 }}>
            Auto-generated site update paragraphs as of {dataEndLabel}
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={handleCopyAll}>
            {copiedAll ? '✓ Copied all' : 'Copy all updates'}
          </button>
        </div>
      </div>

      {/* Trial summary */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="section-title" style={{ marginBottom: 10 }}>Trial Overview</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
          <div>
            <div className="label" style={{ marginBottom: 4 }}>Trial</div>
            <div style={{ fontWeight: 700 }}>{trial.name}</div>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 4 }}>Sponsor</div>
            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{trial.sponsor}</div>
          </div>
          {trial.indication && (
            <div>
              <div className="label" style={{ marginBottom: 4 }}>Indication</div>
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{trial.indication}</div>
            </div>
          )}
          <div>
            <div className="label" style={{ marginBottom: 4 }}>Sites Reporting</div>
            <div style={{ fontWeight: 700 }}>{rankedSites.length}</div>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 4 }}>Data Period</div>
            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{dataEndLabel}</div>
          </div>
        </div>
      </div>

      {/* RAG summary bar */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="section-title" style={{ marginRight: 8 }}>Site RAG Summary:</span>
          {rankedSites.map(site => (
            <span key={site.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
              <RagBadge status={site.rag === 'red' ? 'Red' : site.rag === 'amber' ? 'Amber' : 'Green'} />
              <span style={{ fontWeight: 600 }}>{site.rawName}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Per-site sponsor update paragraphs */}
      <div className="reports-grid">
        {rankedSites.map(site => {
          const update = generateSponsorUpdate(site, trialMeta);
          return (
            <div key={site.id} className="report-site-card">
              <div className="report-site-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="report-site-name">{site.rawName}</span>
                  {site.hospital && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{site.hospital}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <RagBadge status={site.rag === 'red' ? 'Red' : site.rag === 'amber' ? 'Amber' : 'Green'} score={site.scores.total} />
                  <CopyButton text={update} />
                </div>
              </div>
              <div className="report-site-body">
                <div className="copy-box-text" style={{ fontSize: 13, lineHeight: 1.7 }}>{update}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

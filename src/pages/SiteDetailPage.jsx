import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../store/AppContext';
import { scoreSites } from '../logic/scoreSites';
import { generateSummary } from '../logic/generateSummary';
import { generateEmail, generateSponsorUpdate } from '../logic/generateEmail';
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

function pct(ratio) {
  return Math.round((ratio ?? 0) * 100) + '%';
}

function ScoreBreakdown({ scores }) {
  const dims = [
    { key: 'enrolment',    label: 'Enrolment' },
    { key: 'screenFailure', label: 'Screen Failure' },
    { key: 'queryBurden',  label: 'Query Burden' },
    { key: 'sdv',          label: 'SDV Completeness' },
    { key: 'deviations',   label: 'Protocol Deviations' },
  ];
  return (
    <div className="score-panel">
      {dims.map(({ key, label }) => {
        const s = scores[key];
        const cls = `s${s}`;
        return (
          <div className="score-row" key={key}>
            <div className="score-row-header">
              <span className="score-row-name">{label}</span>
              <span className={`score-row-val ${cls}`}>{s}/3</span>
            </div>
            <div className="score-row-bar">
              <div className={`score-row-fill ${cls}`} style={{ width: `${(s / 3) * 100}%` }} />
            </div>
          </div>
        );
      })}
      <div className="score-row" style={{ background: 'var(--navy-pale)', border: '1px solid #C5D3E8' }}>
        <div className="score-row-header">
          <span className="score-row-name" style={{ color: 'var(--navy)' }}>Total Risk Score</span>
          <span className="score-row-val" style={{ color: 'var(--navy)' }}>{scores.total}/15</span>
        </div>
      </div>
    </div>
  );
}

function MonthTable({ months }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Month</th>
            <th className="num">Target</th>
            <th className="num">Enrolled</th>
            <th className="num">Screen Fails</th>
            <th className="num">Queries &gt;14d</th>
            <th className="num">SDV %</th>
            <th className="num">Deviations</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 500 }}>{m.month}</td>
              <td className="num">{m.target ?? '—'}</td>
              <td className="num">{m.enrolled ?? '—'}</td>
              <td className={`num${(m.screenFailures || 0) > 5 ? ' flag' : ''}`}>
                {m.screenFailures ?? '—'}
              </td>
              <td className={`num${(m.queriesAged || 0) > 8 ? ' flag' : ''}`}>
                {m.queriesAged ?? '—'}
              </td>
              <td className={`num${m.sdvPct != null && m.sdvPct < 0.8 ? ' flag' : ''}`}>
                {m.sdvPct != null ? pct(m.sdvPct) : '—'}
              </td>
              <td className={`num${(m.deviations || 0) >= 3 ? ' flag' : ''}`}>
                {m.deviations ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotesSection({ trialId, siteId, notes }) {
  const { actions } = useAppStore();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    actions.addNote(trialId, siteId, text.trim());
    setText('');
    setSubmitting(false);
  }

  return (
    <div>
      {notes && notes.length > 0 ? (
        <div className="notes-list" style={{ marginBottom: 16 }}>
          {notes.filter(n => n && typeof n === 'object').map(note => (
            <div key={note.id} className="note-item">
              <div className="note-meta">
                <span className="note-author">{note.author}</span>
                <span className="note-date">{new Date(note.date).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="note-text">{note.text}</div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 14 }}>No notes yet.</p>
      )}

      <form className="note-form" onSubmit={handleSubmit}>
        <textarea
          className="note-textarea w-full"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Add a note…"
        />
        <div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={submitting || !text.trim()}>
            Add Note
          </button>
        </div>
      </form>
    </div>
  );
}

function EmailSection({ site, trialMeta, trialId, siteId }) {
  const { actions } = useAppStore();
  const { subject, body, toEmail } = generateEmail(site, trialMeta);
  const [logged, setLogged] = useState(false);

  function handleLog() {
    actions.logEmail(trialId, siteId, 'check-in', toEmail || site.coordinator?.email || '', subject);
    setLogged(true);
    setTimeout(() => setLogged(false), 3000);
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>To: </span>
        {site.coordinator?.name || 'Site Coordinator'}
        {toEmail ? ` <${toEmail}>` : ''}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Subject: </span>{subject}
      </div>

      <div className="copy-box">
        <div className="copy-box-actions">
          <CopyButton text={body} />
        </div>
        <div className="copy-box-text">{body}</div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary btn-sm" onClick={handleLog} disabled={logged}>
          {logged ? '✓ Logged' : 'Log as Sent'}
        </button>
      </div>
    </div>
  );
}

function EmailLogSection({ emailLog }) {
  if (!emailLog || emailLog.length === 0) {
    return <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No emails logged yet.</p>;
  }
  return (
    <div className="email-log-list">
      {[...emailLog].reverse().map(entry => (
        <div key={entry.id} className="email-log-item">
          <span className="email-log-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </span>
          <div className="email-log-body">
            <div className="email-log-subject">{entry.subject}</div>
            <div className="email-log-meta">
              {new Date(entry.sentDate).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {entry.recipient ? ` · ${entry.recipient}` : ''}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SiteDetailPage() {
  const { id, siteId } = useParams();
  const navigate = useNavigate();
  const { state } = useAppStore();
  const trial = state.trials[id];
  const [activeTab, setActiveTab] = useState('overview');

  if (!trial || !trial.sites?.[siteId]) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Site not found</div>
        <button className="btn btn-primary" onClick={() => navigate(`/trial/${id}`)}>Back to Dashboard</button>
      </div>
    );
  }

  const trialMeta = buildTrialMeta(trial);

  // Score the site (it may already have scores but re-compute for freshness)
  const rawSite = trial.sites[siteId];
  const scored = scoreSites(trial.sites, trialMeta).find(s => s.id === siteId) || rawSite;

  const summary = generateSummary(scored, trialMeta);
  const ragLabel = scored.rag === 'red' ? 'Red' : scored.rag === 'amber' ? 'Amber' : 'Green';

  const trendMap = {
    deteriorating: '↓ Deteriorating',
    'trending-worse': '↘ Trending Worse',
    stable: '→ Stable',
    improving: '↑ Improving',
  };
  const trendCls = `trend-badge trend-${scored.trendSignal || 'stable'}`;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 6 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/trial/${id}`)} style={{ marginBottom: 10, marginLeft: -8 }}>
          ← Dashboard
        </button>
      </div>

      <div className="site-detail-header">
        <div className="site-detail-header-info">
          <div className="site-detail-title">{scored.rawName}</div>
          {scored.hospital && <div className="site-detail-sub">{scored.hospital}</div>}
          <div className="site-detail-badges">
            <RagBadge status={ragLabel} score={scored.scores?.total} />
            {scored.trendSignal && (
              <span className={trendCls}>{trendMap[scored.trendSignal] || scored.trendSignal}</span>
            )}
            {scored.persistentConcern && (
              <span className="flag-chip red">Persistent risk: {scored.persistentConcern}+ months</span>
            )}
            {scored.craOverdue && (
              <span className="flag-chip amber">CRA visit overdue</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>
          {scored.pi?.name && <div><span style={{ fontWeight: 600 }}>PI:</span> {scored.pi.name}</div>}
          {scored.coordinator?.name && <div><span style={{ fontWeight: 600 }}>CRC:</span> {scored.coordinator.name}</div>}
          {scored.dateActivated && (
            <div><span style={{ fontWeight: 600 }}>Activated:</span> {new Date(scored.dateActivated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[
          { key: 'overview', label: 'Overview & Analysis' },
          { key: 'months', label: 'Monthly Data' },
          { key: 'notes', label: `Notes (${(rawSite.notes || []).filter(n => n && typeof n === 'object').length})` },
          { key: 'email', label: 'Email Draft' },
          { key: 'log', label: `Email Log (${(rawSite.emailLog || []).length})` },
        ].map(t => (
          <button
            key={t.key}
            className={`tab-btn${activeTab === t.key ? ' active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div>
          {/* Analysis summary */}
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <div className="section-title" style={{ marginBottom: 10 }}>Why this site is flagged</div>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-primary)' }}>{summary}</p>
          </div>

          {/* Score breakdown */}
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>Score Breakdown <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-muted)' }}>(0 = no concern, 3 = critical)</span></div>
            {scored.scores && <ScoreBreakdown scores={scored.scores} />}
          </div>

          {/* Key metrics */}
          <div className="metric-strip">
            {scored.enrolmentSummary && (
              <>
                <div className="metric-card">
                  <div className="label metric-card-label">Enrolled</div>
                  <div className="metric-card-value">{scored.enrolmentSummary.cumEnrolled}</div>
                  <div className="metric-card-sub">of {scored.enrolmentSummary.cumTarget} target</div>
                </div>
                <div className={`metric-card ${scored.enrolmentSummary.ratio >= 0.9 ? 'good' : scored.enrolmentSummary.ratio >= 0.75 ? '' : 'warn'}`}>
                  <div className="label metric-card-label">Enrolment</div>
                  <div className="metric-card-value">{pct(scored.enrolmentSummary.ratio)}</div>
                  <div className="metric-card-sub">of cumulative target</div>
                </div>
                <div className="metric-card">
                  <div className="label metric-card-label">Run Rate</div>
                  <div className="metric-card-value">{scored.enrolmentSummary.runRate.toFixed(1)}</div>
                  <div className="metric-card-sub">pts/month avg</div>
                </div>
              </>
            )}
            {scored.screenFailureRate > 0 && (
              <div className={`metric-card ${scored.screenFailureRate >= 0.5 ? 'bad' : scored.screenFailureRate >= 0.3 ? 'warn' : 'good'}`}>
                <div className="label metric-card-label">Screen Failure</div>
                <div className="metric-card-value">{pct(scored.screenFailureRate)}</div>
                <div className="metric-card-sub">of screened patients</div>
              </div>
            )}
            {scored.latestSdvPct != null && (
              <div className={`metric-card ${scored.latestSdvPct >= 0.9 ? 'good' : scored.latestSdvPct >= 0.8 ? '' : 'warn'}`}>
                <div className="label metric-card-label">SDV</div>
                <div className="metric-card-value">{pct(scored.latestSdvPct)}</div>
                <div className="metric-card-sub">latest month</div>
              </div>
            )}
            {scored.latestQueriesAged > 0 && (
              <div className={`metric-card ${scored.latestQueriesAged > 8 ? 'bad' : scored.latestQueriesAged > 3 ? 'warn' : ''}`}>
                <div className="label metric-card-label">Aged Queries</div>
                <div className="metric-card-value">{scored.latestQueriesAged}</div>
                <div className="metric-card-sub">&gt;14 days</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Monthly data */}
      {activeTab === 'months' && (
        <div className="card card-pad">
          {scored.months && scored.months.length > 0 ? (
            <MonthTable months={scored.months} />
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No monthly data available.</p>
          )}
        </div>
      )}

      {/* Tab: Notes */}
      {activeTab === 'notes' && (
        <div className="card card-pad">
          <NotesSection trialId={id} siteId={siteId} notes={rawSite.notes || []} />
        </div>
      )}

      {/* Tab: Email draft */}
      {activeTab === 'email' && (
        <div>
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>Check-in Email Draft</div>
            <EmailSection site={scored} trialMeta={trialMeta} trialId={id} siteId={siteId} />
          </div>

          {/* Sponsor update */}
          <div className="card card-pad">
            <div className="section-title" style={{ marginBottom: 12 }}>Sponsor Update Paragraph</div>
            <div className="copy-box">
              <div className="copy-box-actions">
                <CopyButton text={generateSponsorUpdate(scored, trialMeta)} />
              </div>
              <div className="copy-box-text">{generateSponsorUpdate(scored, trialMeta)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Email log */}
      {activeTab === 'log' && (
        <div className="card card-pad">
          <EmailLogSection emailLog={rawSite.emailLog || []} />
        </div>
      )}
    </div>
  );
}

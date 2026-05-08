import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../store/AppContext';
import { scoreSites } from '../logic/scoreSites';
import { generateSummary, generateActionableInsights } from '../logic/generateSummary';
import { generateEmail, generateSponsorUpdate } from '../logic/generateEmail';
import { analyseNotes } from '../logic/notesIntelligence';
import RagBadge from '../components/shared/RagBadge';
import CopyButton from '../components/shared/CopyButton';

function buildTrialMeta(trial) {
  const allMonthDates = Object.values(trial.sites || {})
    .flatMap(s => (s.months || []).map(m => new Date(m.date)));
  const dataEnd = allMonthDates.length > 0 ? new Date(Math.max(...allMonthDates)) : new Date();
  const dataEndMonth = new Date(dataEnd.getFullYear(), dataEnd.getMonth() + 1, 0);
  return {
    trialName: trial.name,
    sponsor: trial.sponsor,
    totalTarget: trial.totalTarget || 120,
    dataStart: allMonthDates.length > 0 ? new Date(Math.min(...allMonthDates)) : new Date(),
    dataEnd: dataEndMonth,
  };
}

function pct(ratio) { return Math.round((ratio ?? 0) * 100) + '%'; }

function scoreLevel(score) {
  if (score >= 3) return 'flagged';
  if (score >= 1) return 'watch';
  return 'ok';
}


function MetricCard({ label, value, sub, level, sub2 }) {
  const colorCls = level === 'flagged' ? 'bad' : level === 'watch' ? 'warn' : '';
  const bg = level === 'flagged' ? '#FEF6F6'
           : level === 'watch'   ? '#FFFCF0'
           : 'var(--surface)';
  const border = level === 'flagged' ? 'var(--red-border)'
               : level === 'watch'   ? 'var(--amber-border)'
               : 'var(--border)';
  return (
    <div className="metric-card" style={{ background: bg, borderColor: border, boxShadow: 'none', height: '100%', boxSizing: 'border-box', padding: '14px 14px' }}>
      <div className="label metric-card-label">{label}</div>
      <div className={`metric-card-value ${colorCls}`}>{value}</div>
      {sub && <div className="metric-card-sub">{sub}</div>}
      {sub2 && (
        <div className="metric-card-sub" style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
          {sub2}
        </div>
      )}
    </div>
  );
}

function StatGroups({ scored }) {
  const s = scored.scores || {};

  const craLevel = scored.craOverdue ? 'flagged'
    : scored.daysWithoutVisit != null && scored.daysWithoutVisit > 30 ? 'watch'
    : 'ok';

  const metrics = [
    {
      key: 'enrol',
      card: (
        <MetricCard
          label="Enrolment"
          value={pct(scored.enrolmentSummary?.ratio)}
          sub={`${scored.enrolmentSummary?.cumEnrolled ?? 0} of ${scored.enrolmentSummary?.cumTarget ?? 0}`}
          sub2={`${(scored.enrolmentSummary?.runRate ?? 0).toFixed(1)} pts/month avg`}
          level={scoreLevel(s.enrolment ?? 0)}
        />
      ),
    },
    scored.screenFailureRate > 0 && {
      key: 'sf',
      card: (
        <MetricCard
          label="Screen Failure"
          value={pct(scored.screenFailureRate)}
          sub="of screened"
          level={scoreLevel(s.screenFailure ?? 0)}
        />
      ),
    },
    {
      key: 'sdv',
      card: (
        <MetricCard
          label="SDV"
          value={scored.latestSdvPct != null ? pct(scored.latestSdvPct) : '—'}
          sub="latest month"
          level={scoreLevel(s.sdv ?? 0)}
        />
      ),
    },
    {
      key: 'queries',
      card: (
        <MetricCard
          label="Aged Queries"
          value={scored.latestQueriesAged ?? 0}
          sub=">14 days open"
          level={scoreLevel(s.queryBurden ?? 0)}
        />
      ),
    },
    {
      key: 'dev',
      card: (
        <MetricCard
          label="Deviations"
          value={(scored.deviationsTrend || []).at(-1) ?? 0}
          sub={scored.deviationsTrend?.length > 1 ? (scored.deviationsTrend || []).join(' → ') : 'latest month'}
          level={scoreLevel(s.deviations ?? 0)}
        />
      ),
    },
    {
      key: 'cra',
      card: (() => {
        const dateStr = scored.lastMonitoringVisit
          ? new Date(scored.lastMonitoringVisit).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
          : null;
        const daysStr = scored.daysWithoutVisit != null ? `${scored.daysWithoutVisit} days ago` : null;
        return (
          <MetricCard
            label="CRA Monitoring Visit"
            value={dateStr || '—'}
            sub={daysStr || 'no visit recorded'}
            level={craLevel}
          />
        );
      })(),
    },
  ].filter(Boolean);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${metrics.length}, 1fr)`, gap: 8, alignItems: 'stretch' }}>
        {metrics.map(m => (
          <div key={m.key} style={{ display: 'flex' }}>
            {m.card}
          </div>
        ))}
      </div>
      {/* Overdue tag — shown below the row so it's always visible regardless of card layout */}
      {(scored.craOverdue || scored.modifierFlags?.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {scored.craOverdue && (
            <span className="flag-chip amber">
              CRA visit overdue{scored.daysWithoutVisit != null ? ` · ${scored.daysWithoutVisit} days` : ''}
            </span>
          )}
          {!scored.lastMonitoringVisit && (
            <span className="flag-chip amber">No monitoring visit on record</span>
          )}
          {scored.modifierFlags?.map((f, i) =>
            f.includes('Persistent') ? null : (
              <span key={i} className={`flag-chip ${f.includes('⚠') ? 'red' : 'info'}`}>{f}</span>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ── Why card with collapsed insights ─────────────────────────────
function InsightCard({ insight, onTabSwitch }) {
  const severity = insight.severity;
  const borderColor = severity === 'critical' || severity === 'action'
    ? 'var(--red)'
    : severity === 'watch'
    ? 'var(--amber)'
    : 'var(--navy-mid)';
  return (
    <div style={{
      display: 'flex',
      gap: 12,
      padding: '10px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        width: 3,
        borderRadius: 2,
        background: borderColor,
        flexShrink: 0,
        alignSelf: 'stretch',
        minHeight: 16,
      }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)' }}>{insight.text}</div>
        {insight.suggestion && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>{insight.suggestion}</div>
        )}
        {insight.linkTab && onTabSwitch && (
          <button
            style={{
              display: 'inline-block',
              marginTop: 4,
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--navy-mid)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
              textUnderlineOffset: 2,
            }}
            onClick={() => onTabSwitch(insight.linkTab)}
          >
            {insight.linkLabel || 'View →'}
          </button>
        )}
      </div>
    </div>
  );
}

function WhyCard({ scored, summary, insights, stringNotes, onTabSwitch }) {
  const [showInsights, setShowInsights] = useState(false);

  const analysed = analyseNotes(stringNotes);

  return (
    <div className="card card-pad" style={{ marginBottom: 16 }}>
      <div className="section-title" style={{ marginBottom: 10 }}>Why this site is flagged</div>

      {/* Summary paragraph */}
      <p style={{ fontSize: 13, lineHeight: 1.75, color: 'var(--text-primary)' }}>{summary}</p>

      {/* Collapsible suggested actions */}
      {insights.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ padding: '4px 0', fontWeight: 600, color: 'var(--navy-mid)' }}
            onClick={() => setShowInsights(v => !v)}
          >
            {showInsights
              ? '↑ Hide suggested actions'
              : `↓ ${insights.length} suggested action${insights.length !== 1 ? 's' : ''}`}
          </button>
          {showInsights && (
            <div style={{ marginTop: 10 }}>
              {insights.map((ins, i) => (
                <InsightCard key={i} insight={ins} onTabSwitch={onTabSwitch} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Operational notes — separate, only if not already folded into summary */}
      {analysed.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <div className="label" style={{ marginBottom: 10 }}>Operational notes from data</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {analysed.map((n, i) => (
              <div key={i} style={{ fontSize: 13, lineHeight: 1.6 }}>
                <span style={{ color: 'var(--text-muted)' }}>{n.rawText}</span>
                {n.insight && (
                  <div style={{
                    fontSize: 12,
                    color: 'var(--text-primary)',
                    fontWeight: 500,
                    borderLeft: '3px solid var(--navy-light)',
                    paddingLeft: 10,
                    marginTop: 4,
                  }}>
                    {n.insight}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Score breakdown ───────────────────────────────────────────────
function ScoreBreakdown({ scores, scored }) {
  const dims = [
    { key: 'enrolment',     label: 'Enrolment' },
    { key: 'screenFailure', label: 'Screen Failure' },
    { key: 'queryBurden',   label: 'Query Burden' },
    { key: 'sdv',           label: 'SDV Completeness' },
    { key: 'deviations',    label: 'Protocol Deviations' },
  ];
  const baseSum = dims.reduce((n, { key }) => n + (scores[key] ?? 0), 0);
  const adjustedTotal = scores.total ?? baseSum;
  const delta = adjustedTotal - baseSum;

  const modifiers = [];
  if (scored?.persistentConcern) modifiers.push({ label: `Persistent concern (${scored.persistentConcern} months)`, delta: +2 });
  if (scored?.isNewlyActivated)  modifiers.push({ label: 'Recently activated — limited data', delta: -2 });
  if (scored?.onLeave)           modifiers.push({ label: 'Coordinator absence noted', delta: -1 });

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

      {/* Modifiers */}
      {modifiers.map((mod, i) => (
        <div key={i} className="score-row" style={{ background: 'var(--bg)', opacity: 0.85 }}>
          <div className="score-row-header">
            <span className="score-row-name" style={{ fontStyle: 'italic' }}>{mod.label}</span>
            <span className="score-row-val" style={{ color: mod.delta > 0 ? 'var(--red)' : 'var(--green)' }}>
              {mod.delta > 0 ? `+${mod.delta}` : mod.delta}
            </span>
          </div>
        </div>
      ))}

      {/* Base sum (only shown when modifiers are present) */}
      {delta !== 0 && (
        <div className="score-row">
          <div className="score-row-header">
            <span className="score-row-name" style={{ color: 'var(--text-secondary)' }}>Base score (5 dimensions)</span>
            <span className="score-row-val" style={{ color: 'var(--text-secondary)' }}>{baseSum}/15</span>
          </div>
        </div>
      )}

      <div className="score-row" style={{ background: 'var(--navy-pale)', border: '1px solid #C5D3E8' }}>
        <div className="score-row-header">
          <span className="score-row-name" style={{ color: 'var(--navy)' }}>
            {delta !== 0 ? 'Adjusted Risk Score' : 'Total Risk Score'}
          </span>
          <span className="score-row-val" style={{ color: 'var(--navy)' }}>{adjustedTotal}/15</span>
        </div>
      </div>
    </div>
  );
}

// ── Monthly data table ────────────────────────────────────────────
function MonthTable({ months }) {
  const hasVisitDates = months.some(m => m.monitoringVisitDate);
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
            {hasVisitDates && <th>Monitoring Visit</th>}
          </tr>
        </thead>
        <tbody>
          {months.map((m, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 500 }}>{m.month}</td>
              <td className="num">{m.target ?? '—'}</td>
              <td className="num">{m.enrolled ?? '—'}</td>
              <td className={`num${(m.screenFailures || 0) > 5 ? ' flag' : ''}`}>{m.screenFailures ?? '—'}</td>
              <td className={`num${(m.queriesAged || 0) > 8 ? ' flag' : ''}`}>{m.queriesAged ?? '—'}</td>
              <td className={`num${m.sdvPct != null && m.sdvPct < 0.8 ? ' flag' : ''}`}>
                {m.sdvPct != null ? pct(m.sdvPct) : '—'}
              </td>
              <td className={`num${(m.deviations || 0) >= 3 ? ' flag' : ''}`}>{m.deviations ?? '—'}</td>
              {hasVisitDates && (
                <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                  {m.monitoringVisitDate
                    ? new Date(m.monitoringVisitDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
                    : '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Team notes ────────────────────────────────────────────────────
function UserNotesSection({ trialId, siteId, notes }) {
  const { actions } = useAppStore();
  const [text, setText] = useState('');
  const userNotes = (notes || []).filter(n => n && typeof n === 'object');

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    actions.addNote(trialId, siteId, text.trim());
    setText('');
  }

  return (
    <div>
      {userNotes.length > 0 ? (
        <div className="notes-list" style={{ marginBottom: 16 }}>
          {userNotes.map(note => (
            <div key={note.id} className="note-item">
              <div className="note-meta">
                <span className="note-author">{note.author}</span>
                <span className="note-date">
                  {new Date(note.date).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="note-text">{note.text}</div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 14 }}>No team notes yet.</p>
      )}
      <form className="note-form" onSubmit={handleSubmit}>
        <textarea
          className="note-textarea w-full"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Add a note visible to all trial managers…"
        />
        <div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!text.trim()}>Add Note</button>
        </div>
      </form>
    </div>
  );
}

// ── Email sub-tabs ────────────────────────────────────────────────
function EmailCoordinatorTab({ site, trialMeta, trialId, siteId }) {
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
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>To: </span>
        {site.coordinator?.name || 'Site Coordinator'}{toEmail ? ` <${toEmail}>` : ''}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Subject: </span>{subject}
      </div>
      <div className="copy-box">
        <div className="copy-box-actions"><CopyButton text={body} /></div>
        <div className="copy-box-text">{body}</div>
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="btn btn-secondary btn-sm" onClick={handleLog} disabled={logged}>
          {logged ? '✓ Logged' : 'Log as Sent'}
        </button>
      </div>
    </div>
  );
}

function SponsorUpdateTab({ site, trialMeta }) {
  const text = generateSponsorUpdate(site, trialMeta);
  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
        Ready-to-paste paragraph for sponsor status updates.
      </p>
      <div className="copy-box">
        <div className="copy-box-actions"><CopyButton text={text} /></div>
        <div className="copy-box-text">{text}</div>
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

// ── Main page ─────────────────────────────────────────────────────
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
  const rawSite = trial.sites[siteId];
  const scored  = scoreSites(trial.sites, trialMeta, trial.thresholds).find(s => s.id === siteId) || rawSite;

  const summary  = generateSummary(scored, trialMeta);
  const insights = generateActionableInsights(scored);
  const ragLabel = scored.rag === 'red' ? 'Red' : scored.rag === 'amber' ? 'Amber' : 'Green';
  const showTrend = scored.rag !== 'green' || scored.trendSignal === 'improving';

  const trendMap = {
    deteriorating:    '↓ Deteriorating',
    'trending-worse': '↘ Trending Worse',
    stable:           '→ Stable',
    improving:        '↑ Improving',
  };

  const allNotes    = rawSite.notes || [];
  const stringNotes = allNotes.filter(n => typeof n === 'string');

  const tabs = [
    { key: 'overview', label: 'Overview & Analysis' },
    { key: 'months',   label: 'Monthly Data' },
    { key: 'email',    label: 'Email & Updates' },
    { key: 'log',      label: `Email Log (${(rawSite.emailLog || []).length})` },
    { key: 'team',     label: `Team Notes (${allNotes.filter(n => n && typeof n === 'object').length})` },
  ];

  return (
    <div>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 14, marginLeft: -8 }} onClick={() => navigate(`/trial/${id}`)}>
        ← Back to Dashboard
      </button>

      {/* Site header */}
      <div className="site-detail-header">
        <div className="site-detail-header-info">
          <div className="site-detail-title">{scored.rawName}</div>
          {scored.hospital && <div className="site-detail-sub">{scored.hospital}</div>}
          <div className="site-detail-badges">
            <RagBadge status={ragLabel} score={scored.scores?.total} />
            {showTrend && scored.trendSignal && (
              <span className={`trend-badge trend-${scored.trendSignal}`}>
                {trendMap[scored.trendSignal] || scored.trendSignal}
              </span>
            )}
            {scored.modifierFlags && scored.modifierFlags.map((f, i) =>
              f.includes('Persistent') ? (
                <div key={i} className="persistent-tooltip">
                  <span className="flag-chip red">{f}</span>
                  {scored.persistentConcernMonthLabels?.length > 0 && (
                    <div className="persistent-tooltip-box">
                      High-risk score in: {scored.persistentConcernMonthLabels.join(', ')}
                    </div>
                  )}
                </div>
              ) : (
                <span key={i} className={`flag-chip ${f.includes('⚠') ? 'red' : 'info'}`}>{f}</span>
              )
            )}
            {scored.craOverdue && (
              <span className="flag-chip amber">CRA visit overdue</span>
            )}
          </div>
        </div>
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: 'var(--text-secondary)' }}>
          {scored.pi?.name && <div><span style={{ fontWeight: 600 }}>PI:</span> {scored.pi.name}</div>}
          {scored.coordinator?.name && <div><span style={{ fontWeight: 600 }}>CRC:</span> {scored.coordinator.name}</div>}
          {scored.dateActivated && (
            <div>
              <span style={{ fontWeight: 600 }}>Activated:</span>{' '}
              {new Date(scored.dateActivated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {tabs.map(t => (
          <button key={t.key} className={`tab-btn${activeTab === t.key ? ' active' : ''}`} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div>
          {/* Grouped metric cards */}
          <StatGroups scored={scored} />

          {/* Why flagged — summary + collapsed insights + operational notes */}
          <WhyCard
            scored={scored}
            summary={summary}
            insights={insights}
            stringNotes={stringNotes}
            onTabSwitch={tab => setActiveTab(tab)}
          />

          {/* Score breakdown */}
          <div className="card card-pad">
            <div className="section-title" style={{ marginBottom: 12 }}>
              Score Breakdown
              <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                (0 = no concern · 3 = critical · total out of 15)
              </span>
            </div>
            {scored.scores && <ScoreBreakdown scores={scored.scores} scored={scored} />}
          </div>
        </div>
      )}

      {activeTab === 'months' && (
        <div className="card card-pad">
          {scored.months?.length > 0
            ? <MonthTable months={scored.months} />
            : <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No monthly data available.</p>}
        </div>
      )}

      {activeTab === 'team' && (
        <div className="card card-pad">
          <UserNotesSection trialId={id} siteId={siteId} notes={rawSite.notes || []} />
        </div>
      )}

      {/* Email & Updates — side by side */}
      {activeTab === 'email' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
          <div className="card card-pad">
            <div className="section-title" style={{ marginBottom: 14 }}>Email Coordinator</div>
            <EmailCoordinatorTab site={scored} trialMeta={trialMeta} trialId={id} siteId={siteId} />
          </div>
          <div className="card card-pad">
            <div className="section-title" style={{ marginBottom: 14 }}>Sponsor Update</div>
            <SponsorUpdateTab site={scored} trialMeta={trialMeta} />
          </div>
        </div>
      )}

      {activeTab === 'log' && (
        <div className="card card-pad">
          <EmailLogSection emailLog={rawSite.emailLog || []} />
        </div>
      )}
    </div>
  );
}

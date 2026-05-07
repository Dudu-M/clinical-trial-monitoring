import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/AppContext';
import { importFromFile } from '../utils/storage';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function LandingPage() {
  const { state, actions } = useAppStore();
  const navigate = useNavigate();
  const trials = Object.values(state.trials);

  function openTrial(id) {
    actions.setActiveTrial(id);
    navigate(`/trial/${id}`);
  }

  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const imported = await importFromFile(file);
      // Overwrite local state with imported
      actions.loadState(imported);
    } catch {
      alert('Could not import file — is it a valid CARDINAL save?');
    }
    e.target.value = '';
  }

  return (
    <div className="landing-shell">
      <header className="landing-topbar">
        <div>
          <div className="landing-topbar-brand">CARDINAL</div>
          <div className="landing-topbar-sub">Clinical Trial Monitor · Lindus Health</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Import save
            <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
          </label>
        </div>
      </header>

      <div className="landing-content">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 className="page-title">Your Trials</h1>
            <p className="text-secondary" style={{ marginTop: 4, fontSize: 13 }}>
              {trials.length === 0
                ? 'No trials yet. Create your first trial to get started.'
                : `${trials.length} trial${trials.length !== 1 ? 's' : ''} tracked`}
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/trial/new')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Trial
          </button>
        </div>

        {trials.length === 0 ? (
          <div className="card card-pad-lg" style={{ maxWidth: 480 }}>
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">No trials yet</div>
              <div className="empty-state-text">
                Set up your first clinical trial to start tracking enrolment, site performance, and generating sponsor updates.
              </div>
              <button className="btn btn-primary btn-lg" onClick={() => navigate('/trial/new')}>
                Create first trial
              </button>
            </div>
          </div>
        ) : (
          <div className="trials-grid">
            {trials
              .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
              .map(trial => {
                const siteCount = Object.keys(trial.sites || {}).length;
                const totalEnrolled = Object.values(trial.sites || {}).reduce((sum, s) => {
                  const months = s.months || [];
                  const lastMonth = months[months.length - 1];
                  return sum + (lastMonth?.enrolled || 0);
                }, 0);

                return (
                  <div key={trial.id} className="trial-card" onClick={() => openTrial(trial.id)}>
                    <div>
                      <div className="trial-card-name">{trial.name}</div>
                      <div className="trial-card-sponsor">{trial.sponsor}{trial.indication ? ` · ${trial.indication}` : ''}</div>
                    </div>

                    <div className="trial-card-stats">
                      <div>
                        <div className="trial-card-stat-val">{siteCount}</div>
                        <div className="trial-card-stat-label">Sites</div>
                      </div>
                      <div>
                        <div className="trial-card-stat-val">{totalEnrolled}</div>
                        <div className="trial-card-stat-label">Enrolled</div>
                      </div>
                      {trial.totalTarget && (
                        <div>
                          <div className="trial-card-stat-val">
                            {Math.round((totalEnrolled / trial.totalTarget) * 100)}%
                          </div>
                          <div className="trial-card-stat-label">of target</div>
                        </div>
                      )}
                    </div>

                    <div className="trial-card-footer">
                      <span className="trial-card-date">
                        {trial.lastUpdated ? `Updated ${formatDate(trial.lastUpdated)}` : `Created ${formatDate(trial.createdAt)}`}
                      </span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                  </div>
                );
              })}

            <div className="trial-card trial-card-new" onClick={() => navigate('/trial/new')}>
              <div className="trial-card-new-icon">+</div>
              <div className="trial-card-new-label">New Trial</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { NavLink, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/AppContext';
import { exportToFile } from '../../utils/storage';

const icons = {
  dashboard: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  upload: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  reports: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  settings: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
    </svg>
  ),
  home: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  export: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
};

export default function Sidebar({ trialId }) {
  const { state } = useAppStore();
  const navigate = useNavigate();
  const trial = trialId ? state.trials[trialId] : null;

  function handleExport() {
    exportToFile(state);
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">CARDINAL</div>
        <div className="sidebar-logo-sub">Trial Monitor</div>
      </div>

      {trial && (
        <div className="sidebar-trial-section">
          <div className="sidebar-trial-label">Active Trial</div>
          <div className="sidebar-trial-name">{trial.name}</div>
        </div>
      )}

      <nav className="sidebar-nav">
        <div className="sidebar-nav-group-label">Navigate</div>

        <NavLink to="/" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          {icons.home}
          All Trials
        </NavLink>

        {trialId && (
          <>
            <NavLink
              to={`/trial/${trialId}`}
              end
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {icons.dashboard}
              Dashboard
            </NavLink>

            <NavLink
              to={`/trial/${trialId}/data`}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {icons.upload}
              Upload Data
            </NavLink>

            <NavLink
              to={`/trial/${trialId}/reports`}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {icons.reports}
              Reports
            </NavLink>

            <NavLink
              to={`/trial/${trialId}/setup`}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {icons.settings}
              Trial Setup
            </NavLink>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-footer-btn" onClick={handleExport}>
          {icons.export}
          Export save file
        </button>
      </div>
    </aside>
  );
}

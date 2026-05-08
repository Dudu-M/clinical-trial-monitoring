import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAppStore } from '../../store/AppContext';

const icons = {
  dashboard: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  upload: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  reports: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
    </svg>
  ),
  home: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  export: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  collapseLeft: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  collapseRight: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
};

export default function Sidebar({ trialId }) {
  const { state } = useAppStore();
  const trial = trialId ? state.trials[trialId] : null;

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebarCollapsed') !== 'false'  // default: closed
  );

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebarCollapsed', String(next));
  }

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">CARDINAL</div>
        <div className="sidebar-logo-sub">Trial Monitor</div>
      </div>

      <div className="sidebar-toggle">
        <button className="sidebar-toggle-btn" onClick={toggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? icons.collapseRight : icons.collapseLeft}
        </button>
      </div>

      {trial && !collapsed && (
        <div className="sidebar-trial-section">
          <div className="sidebar-trial-label">Active Trial</div>
          <div className="sidebar-trial-name">{trial.name}</div>
        </div>
      )}

      <nav className="sidebar-nav">
        {!collapsed && <div className="sidebar-nav-group-label">Navigate</div>}

        <NavLink to="/" data-label="All Trials" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          {icons.home}
          <span className="nav-link-text">All Trials</span>
        </NavLink>

        {trialId && (
          <>
            <NavLink
              to={`/trial/${trialId}`}
              end
              data-label="Dashboard"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {icons.dashboard}
              <span className="nav-link-text">Dashboard</span>
            </NavLink>

            <NavLink
              to={`/trial/${trialId}/data`}
              data-label="Upload Data"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {icons.upload}
              <span className="nav-link-text">Upload Data</span>
            </NavLink>

            <NavLink
              to={`/trial/${trialId}/reports`}
              data-label="Reports"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {icons.reports}
              <span className="nav-link-text">Reports</span>
            </NavLink>

            <NavLink
              to={`/trial/${trialId}/setup`}
              data-label="Trial Setup"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {icons.settings}
              <span className="nav-link-text">Trial Setup</span>
            </NavLink>
          </>
        )}
      </nav>

      <div className="sidebar-footer" />
    </aside>
  );
}

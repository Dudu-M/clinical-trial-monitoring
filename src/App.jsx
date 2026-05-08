import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { AppProvider } from './store/AppContext';
import { useAppStore } from './store/AppContext';
import AppShell from './components/layout/AppShell';
import LandingPage from './pages/LandingPage';
import TrialSetupPage from './pages/TrialSetupPage';
import DashboardPage from './pages/DashboardPage';
import DataUploadPage from './pages/DataUploadPage';
import SiteDetailPage from './pages/SiteDetailPage';
import ReportsPage from './pages/ReportsPage';

// On first bootstrap only: if there's exactly one trial and the user landed on '/',
// skip the landing page and go straight to the dashboard.
// Uses a ref so that explicit navigation back to '/' is never intercepted.
function AutoRedirect() {
  const { state, bootstrapped } = useAppStore();
  const navigate = useNavigate();
  const didRedirect = useRef(false);

  useEffect(() => {
    if (!bootstrapped || didRedirect.current) return;
    const trials = Object.values(state.trials);
    if (trials.length === 1 && window.location.pathname === '/') {
      didRedirect.current = true;
      navigate(`/trial/${trials[0].id}`, { replace: true });
    } else if (bootstrapped) {
      // bootstrapped without redirecting — mark as done so we never redirect later
      didRedirect.current = true;
    }
  }, [bootstrapped, state.trials, navigate]);

  return null;
}

function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16, color: 'var(--text-secondary)' }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--navy)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <div style={{ fontSize: 13 }}>Loading CARDINAL data…</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function AppRoutes() {
  const { bootstrapped } = useAppStore();
  if (!bootstrapped) return <Loading />;

  return (
    <>
      <AutoRedirect />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/trial/new" element={<TrialSetupPage />} />
        <Route path="/trial/:id" element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="setup" element={<TrialSetupPage />} />
          <Route path="data" element={<DataUploadPage />} />
          <Route path="sites/:siteId" element={<SiteDetailPage />} />
          <Route path="reports" element={<ReportsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}

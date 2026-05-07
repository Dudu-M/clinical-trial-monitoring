import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './store/AppContext';
import AppShell from './components/layout/AppShell';
import LandingPage from './pages/LandingPage';
import TrialSetupPage from './pages/TrialSetupPage';
import DashboardPage from './pages/DashboardPage';
import DataUploadPage from './pages/DataUploadPage';
import SiteDetailPage from './pages/SiteDetailPage';
import ReportsPage from './pages/ReportsPage';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </AppProvider>
  );
}

import { Outlet, useParams } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function AppShell() {
  const { id } = useParams();

  return (
    <div className="app-shell">
      <Sidebar trialId={id} />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

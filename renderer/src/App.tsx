import { useEffect } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import SideNav from './components/SideNav';
import CommandBar from './components/CommandBar';
import DetailsPane from './components/DetailsPane';
import HomePage from './pages/HomePage';
import ImportPage from './pages/ImportPage';
import PreviewPage from './pages/PreviewPage';
import DiffPage from './pages/DiffPage';
import GanttPage from './pages/GanttPage';
import UnscheduledPage from './pages/UnscheduledPage';
import InvalidPage from './pages/InvalidPage';
import ImportsPage from './pages/ImportsPage';
import ViewsPage from './pages/ViewsPage';
import ExportPage from './pages/ExportPage';
import SettingsPage from './pages/SettingsPage';
import MembersPage from './pages/MembersPage';
import GroupsPage from './pages/GroupsPage';
import SchedulesPage from './pages/SchedulesPage';
import { useAppStore } from './state/store';

const App = () => {
  const navigate = useNavigate();
  const initSchedules = useAppStore((state) => state.initSchedules);
  const lastError = useAppStore((state) => state.lastError);
  const setZoom = useAppStore((state) => state.setZoom);
  const setFocusDate = useAppStore((state) => state.setFocusDate);

  useEffect(() => {
    initSchedules();
  }, [initSchedules]);

  useEffect(() => {
    const isTypingElement = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      return (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );
    };

    const handleKeydown = (event: KeyboardEvent) => {
      if (isTypingElement(event.target)) {
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('app:focus-search'));
      }

      if (event.ctrlKey && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        navigate('/import');
        window.dispatchEvent(new CustomEvent('app:open-file'));
      }

      if (!event.ctrlKey && event.key.toLowerCase() === 't') {
        setFocusDate(new Date().toISOString().slice(0, 10));
      }

      if (event.ctrlKey) {
        if (event.key === '1') {
          setZoom('day');
        } else if (event.key === '2') {
          setZoom('week');
        } else if (event.key === '3') {
          setZoom('month');
        } else if (event.key === '4') {
          setZoom('quarter');
        }
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [navigate, setZoom, setFocusDate]);

  return (
    <div className="app-shell">
      <SideNav />
      <div className="main-shell">
        <CommandBar />
        <div className="content-shell">
          <main className="main-pane">
            {lastError ? <div className="alert">{lastError}</div> : null}
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/preview" element={<PreviewPage />} />
              <Route path="/diff" element={<DiffPage />} />
              <Route path="/gantt" element={<GanttPage />} />
              <Route path="/members" element={<MembersPage />} />
              <Route path="/groups" element={<GroupsPage />} />
              <Route path="/unscheduled" element={<UnscheduledPage />} />
              <Route path="/invalid" element={<InvalidPage />} />
              <Route path="/imports" element={<ImportsPage />} />
              <Route path="/views" element={<ViewsPage />} />
              <Route path="/schedules" element={<SchedulesPage />} />
              <Route path="/export" element={<ExportPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
          <DetailsPane />
        </div>
      </div>
    </div>
  );
};

export default App;

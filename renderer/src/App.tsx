import { useEffect, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import SideNav from './components/SideNav';
import CommandBar from './components/CommandBar';
import DetailsPane from './components/DetailsPane';
import TaskCreateModal from './components/TaskCreateModal';
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
import ProjectsPage from './pages/ProjectsPage';
import SchedulesPage from './pages/SchedulesPage';
import { useAppStore } from './state/store';

const App = () => {
  const navigate = useNavigate();
  const initSchedules = useAppStore((state) => state.initSchedules);
  const lastError = useAppStore((state) => state.lastError);
  const taskCreateModal = useAppStore((state) => state.taskCreateModal);
  const setZoom = useAppStore((state) => state.setZoom);
  const setFocusDate = useAppStore((state) => state.setFocusDate);
  const undo = useAppStore((state) => state.undo);
  const redo = useAppStore((state) => state.redo);
  const createTask = useAppStore((state) => state.createTask);
  const currentScheduleId = useAppStore((state) => state.currentScheduleId);
  const currentImportId = useAppStore((state) => state.currentImportId);
  const setSelectedTask = useAppStore((state) => state.setSelectedTask);
  const triggerEditFocus = useAppStore((state) => state.triggerEditFocus);
  const updateTask = useAppStore((state) => state.updateTask);
  const setLastError = useAppStore((state) => state.setLastError);
  const closeTaskCreateModal = useAppStore((state) => state.closeTaskCreateModal);
  const [taskCreateError, setTaskCreateError] = useState<string | null>(null);

  useEffect(() => {
    initSchedules();
  }, [initSchedules]);

  useEffect(() => {
    if (!window.api?.onMenuAction) {
      return;
    }
    const removeListener = window.api.onMenuAction(async (_event, payload) => {
      if (!payload) {
        return;
      }
      if (payload.action === 'edit') {
        setSelectedTask(payload.task);
        triggerEditFocus();
      } else if (payload.action === 'unschedule') {
        try {
          const ok = await updateTask({
            currentTaskKeyFull: payload.task.taskKeyFull,
            memberName: payload.task.memberName,
            projectId: payload.task.projectId,
            projectGroup: payload.task.projectGroup ?? null,
            taskName: payload.task.taskName,
            start: null,
            end: null,
            note: payload.task.note ?? null,
            assignees: payload.task.assignees ?? []
          });
          if (!ok) {
            setLastError('未確定への更新に失敗しました。');
          }
        } catch (error) {
          console.error('Failed to unschedule task from context menu.', error);
          setLastError(
            error instanceof Error ? error.message : '未確定への更新に失敗しました。'
          );
        }
      }
    });
    return removeListener;
  }, [setSelectedTask, triggerEditFocus, updateTask, setLastError]);

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

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          void redo();
        } else {
          void undo();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        void redo();
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
  }, [navigate, setZoom, setFocusDate, undo, redo]);

  const handleCreateTask = async (input: {
    projectId: string;
    projectGroup: string | null;
    taskName: string;
    memberName: string;
    allowExistingProjectId?: boolean;
  }) => {
    if (!currentScheduleId) {
      setTaskCreateError('スケジュールが選択されていません。');
      return false;
    }
    setTaskCreateError(null);
    const ok = await createTask({
      scheduleId: currentScheduleId,
      importId: currentImportId ?? undefined,
      allowExistingProjectId: input.allowExistingProjectId ?? true,
      projectId: input.projectId,
      projectGroup: input.projectGroup,
      taskName: input.taskName,
      memberName: input.memberName,
      assignees: [],
      start: null,
      end: null,
      note: null
    });
    if (ok) {
      triggerEditFocus();
      closeTaskCreateModal();
    } else {
      setTaskCreateError('タスクの追加に失敗しました。');
    }
    return ok;
  };

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
              <Route path="/projects" element={<ProjectsPage />} />
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
      <TaskCreateModal
        mode="task"
        isOpen={taskCreateModal.isOpen}
        projectId={taskCreateModal.projectId ?? undefined}
        projectGroup={taskCreateModal.projectGroup ?? null}
        autoFocusOnOpen
        errorMessage={taskCreateError}
        onClearError={() => setTaskCreateError(null)}
        onClose={() => {
          setTaskCreateError(null);
          closeTaskCreateModal();
        }}
        onCreate={handleCreateTask}
      />
    </div>
  );
};

export default App;

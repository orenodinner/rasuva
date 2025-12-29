import { useEffect, useMemo, useRef } from 'react';
import ContextMenu from '../components/ContextMenu';
import GanttView from '../components/GanttView';
import UnscheduledDrawer from '../components/UnscheduledDrawer';
import { useAppStore } from '../state/store';

const GanttPage = () => {
  const gantt = useAppStore((state) => state.gantt);
  const loadGantt = useAppStore((state) => state.loadGantt);
  const currentScheduleId = useAppStore((state) => state.currentScheduleId);
  const rangeStart = useAppStore((state) => state.rangeStart);
  const rangeEnd = useAppStore((state) => state.rangeEnd);
  const setRange = useAppStore((state) => state.setRange);
  const collapsedGroups = useAppStore((state) => state.collapsedGroups);
  const setCollapsedGroups = useAppStore((state) => state.setCollapsedGroups);
  const collapseAll = useAppStore((state) => state.collapseAll);
  const expandAll = useAppStore((state) => state.expandAll);
  const isUnscheduledDrawerOpen = useAppStore((state) => state.isUnscheduledDrawerOpen);
  const toggleUnscheduledDrawer = useAppStore((state) => state.toggleUnscheduledDrawer);
  const selectedTask = useAppStore((state) => state.selectedTask);
  const taskOrder = useAppStore((state) => state.taskOrder);
  const setSelectedTask = useAppStore((state) => state.setSelectedTask);
  const triggerEditFocus = useAppStore((state) => state.triggerEditFocus);
  const deleteTask = useAppStore((state) => state.deleteTask);
  const setLastError = useAppStore((state) => state.setLastError);

  const allGroupIds = useMemo(() => {
    if (!gantt?.tasks) {
      return [];
    }
    const groupIds = new Set<string>();
    gantt.tasks.forEach((task) => {
      const members = new Set([task.memberName, ...(task.assignees ?? [])]);
      members.forEach((memberName) => {
        if (!memberName || memberName.trim().length === 0) {
          return;
        }
        groupIds.add(`member:${memberName}`);
        groupIds.add(`project:${memberName}:${task.projectId}`);
      });
    });
    return Array.from(groupIds);
  }, [gantt]);

  const unscheduledCount = useMemo(() => {
    if (!gantt?.tasks) {
      return 0;
    }
    return gantt.tasks.filter((task) => task.status === 'unscheduled').length;
  }, [gantt]);

  const storageKey = currentScheduleId ? `rasuva:view:${currentScheduleId}` : null;
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!currentScheduleId) {
      return;
    }
    if (!gantt) {
      loadGantt();
    }
  }, [gantt, loadGantt, currentScheduleId]);

  useEffect(() => {
    if (!storageKey) {
      return;
    }
    hasLoadedRef.current = false;
    let nextGroups: string[] | null = null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { collapsedGroups?: unknown };
        if (Array.isArray(parsed.collapsedGroups)) {
          nextGroups = parsed.collapsedGroups.filter(
            (value): value is string => typeof value === 'string'
          );
        }
      }
    } catch {
      nextGroups = null;
    }
    setCollapsedGroups(nextGroups ?? []);
    hasLoadedRef.current = true;
  }, [storageKey, setCollapsedGroups]);

  useEffect(() => {
    if (!storageKey || !hasLoadedRef.current) {
      return;
    }
    const payload = JSON.stringify({ collapsedGroups });
    localStorage.setItem(storageKey, payload);
  }, [storageKey, collapsedGroups]);

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

    const handleKeydown = async (event: KeyboardEvent) => {
      if (isTypingElement(event.target)) {
        return;
      }

      if (event.key === 'Escape') {
        if (selectedTask) {
          event.preventDefault();
          setSelectedTask(null);
        }
        return;
      }

      if (event.key === 'Enter') {
        if (selectedTask) {
          event.preventDefault();
          triggerEditFocus();
        }
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!selectedTask) {
          return;
        }
        event.preventDefault();
        const confirmed = window.confirm('このタスクを削除しますか？');
        if (!confirmed) {
          return;
        }
        try {
          const ok = await deleteTask(selectedTask);
          if (!ok) {
            setLastError('タスクの削除に失敗しました。');
          }
        } catch (error) {
          console.error('Failed to delete task from keyboard shortcut.', error);
          setLastError(
            error instanceof Error ? error.message : 'タスクの削除に失敗しました。'
          );
        }
        return;
      }

      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
        return;
      }
      if (taskOrder.length === 0) {
        return;
      }

      const currentIndex = selectedTask
        ? taskOrder.findIndex((task) => task.taskKeyFull === selectedTask.taskKeyFull)
        : -1;
      const nextIndex =
        event.key === 'ArrowDown'
          ? currentIndex < 0
            ? 0
            : Math.min(taskOrder.length - 1, currentIndex + 1)
          : currentIndex < 0
            ? taskOrder.length - 1
            : Math.max(0, currentIndex - 1);

      const nextTask = taskOrder[nextIndex];
      if (nextTask && nextTask.taskKeyFull !== selectedTask?.taskKeyFull) {
        event.preventDefault();
        setSelectedTask(nextTask);
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [selectedTask, taskOrder, setSelectedTask, triggerEditFocus, deleteTask, setLastError]);

  if (!currentScheduleId) {
    return (
      <div className="page gantt-page">
        <div className="page-header">
          <h1>ガント</h1>
          <p>スケジュールを選択してください。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page gantt-page">
      <div className="page-header">
        <h1>ガント</h1>
        <p>担当者 → プロジェクト → タスクのタイムラインです。</p>
      </div>
      <div className="view-toggle">
        <label className="range-control">
          <span>開始</span>
          <input
            className="text-input"
            type="date"
            value={rangeStart ?? ''}
            onChange={(event) => setRange(event.target.value || null, rangeEnd)}
          />
        </label>
        <label className="range-control">
          <span>終了</span>
          <input
            className="text-input"
            type="date"
            value={rangeEnd ?? ''}
            onChange={(event) => setRange(rangeStart, event.target.value || null)}
          />
        </label>
        <button
          className="cmd-button cmd-button--ghost"
          type="button"
          onClick={() => setRange(null, null)}
        >
          期間リセット
        </button>
        <button
          className="cmd-button cmd-button--ghost"
          type="button"
          onClick={() => collapseAll(allGroupIds)}
          disabled={allGroupIds.length === 0}
        >
          すべて折りたたむ
        </button>
        <button
          className="cmd-button cmd-button--ghost"
          type="button"
          onClick={expandAll}
          disabled={collapsedGroups.length === 0}
        >
          すべて展開
        </button>
        <button
          className={`cmd-button cmd-button--ghost${isUnscheduledDrawerOpen ? ' cmd-button--active' : ''}`}
          type="button"
          onClick={toggleUnscheduledDrawer}
          disabled={unscheduledCount === 0}
        >
          未確定タスク ({unscheduledCount}件)
        </button>
      </div>
      <GanttView />
      <UnscheduledDrawer isOpen={isUnscheduledDrawerOpen} />
      <ContextMenu />
    </div>
  );
};

export default GanttPage;

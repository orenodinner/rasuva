import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAppStore } from '../state/store';

const ContextMenu = () => {
  const contextMenu = useAppStore((state) => state.contextMenu);
  const hideContextMenu = useAppStore((state) => state.hideContextMenu);
  const setSelectedTask = useAppStore((state) => state.setSelectedTask);
  const triggerEditFocus = useAppStore((state) => state.triggerEditFocus);
  const updateTask = useAppStore((state) => state.updateTask);
  const createTask = useAppStore((state) => state.createTask);
  const deleteTask = useAppStore((state) => state.deleteTask);
  const setLastError = useAppStore((state) => state.setLastError);
  const openTaskCreateModal = useAppStore((state) => state.openTaskCreateModal);
  const currentScheduleId = useAppStore((state) => state.currentScheduleId);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!contextMenu.visible) {
      return;
    }
    setPosition({ x: contextMenu.x, y: contextMenu.y });
  }, [contextMenu.visible, contextMenu.x, contextMenu.y]);

  useLayoutEffect(() => {
    if (!contextMenu.visible || !menuRef.current) {
      return;
    }
    const rect = menuRef.current.getBoundingClientRect();
    const padding = 8;
    let nextX = position.x;
    let nextY = position.y;

    if (nextX + rect.width > window.innerWidth - padding) {
      nextX = Math.max(padding, window.innerWidth - rect.width - padding);
    }
    if (nextY + rect.height > window.innerHeight - padding) {
      nextY = Math.max(padding, window.innerHeight - rect.height - padding);
    }

    if (nextX !== position.x || nextY !== position.y) {
      setPosition({ x: nextX, y: nextY });
    }
  }, [contextMenu.visible, position.x, position.y]);

  useEffect(() => {
    if (!contextMenu.visible) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current || !(event.target instanceof Node)) {
        hideContextMenu();
        return;
      }
      if (!menuRef.current.contains(event.target)) {
        hideContextMenu();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        hideContextMenu();
      }
    };
    const handleScroll = () => {
      hideContextMenu();
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [contextMenu.visible, hideContextMenu]);

  if (!contextMenu.visible || !contextMenu.target) {
    return null;
  }

  const target = contextMenu.target;

  const assertNever = (value: never) => value;

  switch (target.type) {
    case 'project': {
      const handleAddTask = () => {
        openTaskCreateModal({
          projectId: target.projectId,
          projectGroup: target.projectGroup ?? null
        });
        hideContextMenu();
      };

      return (
        <div
          ref={menuRef}
          className="gantt-context-menu"
          style={{ left: position.x, top: position.y }}
        >
          <div className="gantt-context-menu__title">プロジェクト: {target.projectId}</div>
          <button type="button" className="gantt-context-menu__item" onClick={handleAddTask}>
            タスクを追加
          </button>
        </div>
      );
    }
    case 'task': {
      const task = target.task;

      const handleEdit = () => {
        setSelectedTask(task);
        triggerEditFocus();
        hideContextMenu();
      };

      const handleUnschedule = async () => {
        setSelectedTask(task);
        hideContextMenu();
        try {
          const ok = await updateTask({
            currentTaskKeyFull: task.taskKeyFull,
            memberName: task.memberName,
            projectId: task.projectId,
            projectGroup: task.projectGroup ?? null,
            taskName: task.taskName,
            start: null,
            end: null,
            note: task.note ?? null,
            assignees: task.assignees ?? []
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
      };

      const handleDuplicate = async () => {
        if (!currentScheduleId) {
          setLastError('スケジュールが選択されていません。');
          hideContextMenu();
          return;
        }
        hideContextMenu();
        try {
          const ok = await createTask({
            scheduleId: currentScheduleId,
            allowExistingProjectId: true,
            projectId: task.projectId,
            projectGroup: task.projectGroup ?? null,
            taskName: `${task.taskName} のコピー`,
            memberName: task.memberName,
            assignees: task.assignees ?? [],
            start: task.start ?? null,
            end: task.end ?? null,
            note: task.note ?? null
          });
          if (!ok) {
            setLastError('タスクの複製に失敗しました。');
          }
        } catch (error) {
          console.error('Failed to duplicate task from context menu.', error);
          setLastError(error instanceof Error ? error.message : 'タスクの複製に失敗しました。');
        }
      };

      const handleDelete = async () => {
        hideContextMenu();
        const confirmed = window.confirm('このタスクを削除しますか？');
        if (!confirmed) {
          return;
        }
        try {
          const ok = await deleteTask(task);
          if (!ok) {
            setLastError('タスクの削除に失敗しました。');
          }
        } catch (error) {
          console.error('Failed to delete task from context menu.', error);
          setLastError(error instanceof Error ? error.message : 'タスクの削除に失敗しました。');
        }
      };

      return (
        <div
          ref={menuRef}
          className="gantt-context-menu"
          style={{ left: position.x, top: position.y }}
        >
          <div className="gantt-context-menu__title">{task.taskName}</div>
          <button type="button" className="gantt-context-menu__item" onClick={handleEdit}>
            詳細を開く
          </button>
          <button type="button" className="gantt-context-menu__item" onClick={handleDuplicate}>
            タスクを複製
          </button>
          <button
            type="button"
            className="gantt-context-menu__item"
            onClick={handleUnschedule}
            disabled={task.status === 'unscheduled'}
          >
            未確定にする
          </button>
          <button
            type="button"
            className="gantt-context-menu__item gantt-context-menu__item--danger"
            onClick={handleDelete}
          >
            タスクを削除
          </button>
        </div>
      );
    }
    default: {
      assertNever(target);
      return null;
    }
  }
};

export default ContextMenu;

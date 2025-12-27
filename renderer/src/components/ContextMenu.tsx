import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAppStore } from '../state/store';

const ContextMenu = () => {
  const contextMenu = useAppStore((state) => state.contextMenu);
  const hideContextMenu = useAppStore((state) => state.hideContextMenu);
  const setSelectedTask = useAppStore((state) => state.setSelectedTask);
  const triggerEditFocus = useAppStore((state) => state.triggerEditFocus);
  const updateTask = useAppStore((state) => state.updateTask);
  const setLastError = useAppStore((state) => state.setLastError);
  const openTaskCreateModal = useAppStore((state) => state.openTaskCreateModal);
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

  if (target.type === 'project') {
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
      <button
        type="button"
        className="gantt-context-menu__item"
        onClick={handleUnschedule}
        disabled={task.status === 'unscheduled'}
      >
        未確定にする
      </button>
    </div>
  );
};

export default ContextMenu;

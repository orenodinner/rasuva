import { useMemo, type DragEvent } from 'react';
import type { NormalizedTask } from '@domain';
import { useAppStore } from '../state/store';

type UnscheduledDrawerProps = {
  isOpen: boolean;
};

const UnscheduledDrawer = ({ isOpen }: UnscheduledDrawerProps) => {
  const gantt = useAppStore((state) => state.gantt);
  const setSelectedTask = useAppStore((state) => state.setSelectedTask);

  const tasks = useMemo(() => {
    return gantt ? gantt.tasks.filter((task) => task.status === 'unscheduled') : [];
  }, [gantt]);

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, task: NormalizedTask) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(
      'application/json',
      JSON.stringify({ taskKeyFull: task.taskKeyFull })
    );
    event.dataTransfer.setData('text/plain', task.taskKeyFull);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <section className="unscheduled-drawer" aria-label="未確定タスク">
      <div className="unscheduled-drawer__header">
        <div>
          <h3 className="unscheduled-drawer__title">未確定タスク</h3>
          <p className="unscheduled-drawer__hint">ドラッグして日付に配置できます。</p>
        </div>
        <span className="unscheduled-drawer__count">{tasks.length} 件</span>
      </div>
      {tasks.length === 0 ? (
        <div className="empty-state">未確定タスクはありません。</div>
      ) : (
        <div className="unscheduled-drawer__list">
          {tasks.map((task) => (
            <button
              key={task.taskKeyFull}
              type="button"
              className="unscheduled-item"
              draggable
              onDragStart={(event) => handleDragStart(event, task)}
              onClick={() => setSelectedTask(task)}
            >
              <div>
                <div className="unscheduled-item__title">{task.taskName}</div>
                <div className="unscheduled-item__meta">
                  {task.projectId} / {task.memberName}
                </div>
              </div>
              <span className="unscheduled-item__badge">未確定</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

export default UnscheduledDrawer;

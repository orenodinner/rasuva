import type { NormalizedTask } from '@domain';
import { getStatusLabel } from './status';

interface TaskListProps {
  tasks: NormalizedTask[];
  onSelect: (task: NormalizedTask) => void;
  emptyLabel?: string;
}

const TaskList = ({ tasks, onSelect, emptyLabel }: TaskListProps) => {
  if (tasks.length === 0) {
    return <div className="empty-state">{emptyLabel ?? '該当タスクはありません。'}</div>;
  }

  return (
    <div className="task-table">
      <div className="task-table__head">
        <div>担当者</div>
        <div>プロジェクト</div>
        <div>タスク</div>
        <div>開始</div>
        <div>終了</div>
        <div>状態</div>
      </div>
      {tasks.map((task) => (
        <button
          key={task.taskKeyFull}
          className="task-table__row"
          onClick={() => onSelect(task)}
        >
          <div>{task.memberName}</div>
          <div>{task.projectId}</div>
          <div className="task-table__task">{task.taskName}</div>
          <div>{task.start ?? '—'}</div>
          <div>{task.end ?? '—'}</div>
          <div>
            <span className={`status-pill status-pill--${task.status}`}>
              {getStatusLabel(task.status)}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
};

export default TaskList;

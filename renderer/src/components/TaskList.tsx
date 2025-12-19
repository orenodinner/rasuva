import type { NormalizedTask } from '@domain';

interface TaskListProps {
  tasks: NormalizedTask[];
  onSelect: (task: NormalizedTask) => void;
  emptyLabel?: string;
}

const TaskList = ({ tasks, onSelect, emptyLabel }: TaskListProps) => {
  if (tasks.length === 0) {
    return <div className="empty-state">{emptyLabel ?? 'No tasks found.'}</div>;
  }

  return (
    <div className="task-table">
      <div className="task-table__head">
        <div>Member</div>
        <div>Project</div>
        <div>Task</div>
        <div>Start</div>
        <div>End</div>
        <div>Status</div>
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
          <div>{task.start ?? '?'}</div>
          <div>{task.end ?? '?'}</div>
          <div>
            <span className={`status-pill status-pill--${task.status}`}>{task.status}</span>
          </div>
        </button>
      ))}
    </div>
  );
};

export default TaskList;

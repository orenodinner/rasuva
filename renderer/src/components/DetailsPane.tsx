import { useAppStore } from '../state/store';

const DetailsPane = () => {
  const task = useAppStore((state) => state.selectedTask);

  return (
    <aside className="details-pane">
      <div className="details-pane__header">Details</div>
      {!task ? (
        <div className="details-pane__empty">Select a task to view details.</div>
      ) : (
        <div className="details-pane__content">
          <div className="detail-block">
            <div className="detail-label">Task</div>
            <div className="detail-value">{task.taskName}</div>
          </div>
          <div className="detail-block">
            <div className="detail-label">Member</div>
            <div className="detail-value">{task.memberName}</div>
          </div>
          <div className="detail-block">
            <div className="detail-label">Project</div>
            <div className="detail-value">{task.projectId}</div>
          </div>
          <div className="detail-block">
            <div className="detail-label">Group</div>
            <div className="detail-value">{task.projectGroup ?? '-'}</div>
          </div>
          <div className="detail-block">
            <div className="detail-label">Schedule</div>
            <div className="detail-value">
              {task.start ?? '?'} ¨ {task.end ?? '?'}
            </div>
          </div>
          <div className="detail-block">
            <div className="detail-label">Status</div>
            <div className={`status-pill status-pill--${task.status}`}>
              {task.status}
            </div>
          </div>
          <div className="detail-block">
            <div className="detail-label">Note</div>
            <div className="detail-value">{task.note ?? '?'}</div>
          </div>
          <div className="detail-block">
            <div className="detail-label">Raw date</div>
            <div className="detail-value detail-raw">{task.rawDate}</div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default DetailsPane;

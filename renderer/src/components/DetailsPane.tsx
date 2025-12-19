import { useAppStore } from '../state/store';
import { getStatusLabel } from './status';

const DetailsPane = () => {
  const task = useAppStore((state) => state.selectedTask);

  return (
    <aside className="details-pane">
      <div className="details-pane__header">詳細</div>
      {!task ? (
        <div className="details-pane__empty">タスクを選択すると詳細が表示されます。</div>
      ) : (
        <div className="details-pane__content">
          <div className="detail-block">
            <div className="detail-label">タスク</div>
            <div className="detail-value">{task.taskName}</div>
          </div>
          <div className="detail-block">
            <div className="detail-label">担当者</div>
            <div className="detail-value">{task.memberName}</div>
          </div>
          <div className="detail-block">
            <div className="detail-label">プロジェクト</div>
            <div className="detail-value">{task.projectId}</div>
          </div>
          <div className="detail-block">
            <div className="detail-label">グループ</div>
            <div className="detail-value">{task.projectGroup ?? '—'}</div>
          </div>
          <div className="detail-block">
            <div className="detail-label">期間</div>
            <div className="detail-value">
              {task.start ?? '—'} → {task.end ?? '—'}
            </div>
          </div>
          <div className="detail-block">
            <div className="detail-label">状態</div>
            <div className={`status-pill status-pill--${task.status}`}>
              {getStatusLabel(task.status)}
            </div>
          </div>
          <div className="detail-block">
            <div className="detail-label">メモ</div>
            <div className="detail-value">{task.note ?? '—'}</div>
          </div>
          <div className="detail-block">
            <div className="detail-label">原文日付</div>
            <div className="detail-value detail-raw">{task.rawDate}</div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default DetailsPane;

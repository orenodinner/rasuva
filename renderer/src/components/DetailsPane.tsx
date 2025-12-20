import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../state/store';
import { getStatusLabel } from './status';

const DetailsPane = () => {
  const task = useAppStore((state) => state.selectedTask);
  const taskOrder = useAppStore((state) => state.taskOrder);
  const setSelectedTask = useAppStore((state) => state.setSelectedTask);
  const updateTask = useAppStore((state) => state.updateTask);
  const lastError = useAppStore((state) => state.lastError);
  const clearError = useAppStore((state) => state.clearError);

  const [isEditing, setIsEditing] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!task) {
      setIsEditing(false);
      setStart('');
      setEnd('');
      setNote('');
      return;
    }
    setIsEditing(false);
    setStart(task.start ?? '');
    setEnd(task.end ?? '');
    setNote(task.note ?? '');
  }, [task]);

  const { prevTask, nextTask } = useMemo(() => {
    if (!task) {
      return { prevTask: null, nextTask: null };
    }
    const index = taskOrder.findIndex((item) => item.taskKeyFull === task.taskKeyFull);
    if (index === -1) {
      return { prevTask: null, nextTask: null };
    }
    return {
      prevTask: index > 0 ? taskOrder[index - 1] : null,
      nextTask: index < taskOrder.length - 1 ? taskOrder[index + 1] : null
    };
  }, [task, taskOrder]);

  const handleSave = async () => {
    if (!task) {
      return;
    }
    clearError();
    const ok = await updateTask({
      taskKeyFull: task.taskKeyFull,
      start: start.trim() ? start.trim() : null,
      end: end.trim() ? end.trim() : null,
      note: note.trim() ? note.trim() : null
    });
    if (ok) {
      setIsEditing(false);
    }
  };

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
            <div className="detail-value">{task.projectGroup ?? '?'}</div>
          </div>
          <div className="detail-block">
            <div className="detail-label">状態</div>
            <div className={`status-pill status-pill--${task.status}`}>
              {getStatusLabel(task.status)}
            </div>
          </div>

          <div className="detail-nav">
            <button
              className="cmd-button cmd-button--ghost"
              disabled={!prevTask || isEditing}
              onClick={() => prevTask && setSelectedTask(prevTask)}
            >
              前へ
            </button>
            <button
              className="cmd-button cmd-button--ghost"
              disabled={!nextTask || isEditing}
              onClick={() => nextTask && setSelectedTask(nextTask)}
            >
              次へ
            </button>
          </div>

          {isEditing ? (
            <>
              <div className="detail-block">
                <div className="detail-label">開始日</div>
                <input
                  className="detail-input"
                  type="date"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                />
              </div>
              <div className="detail-block">
                <div className="detail-label">終了日</div>
                <input
                  className="detail-input"
                  type="date"
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                />
              </div>
              <div className="detail-block">
                <div className="detail-label">メモ</div>
                <textarea
                  className="detail-textarea"
                  rows={3}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>
              <div className="detail-hint">開始/終了を空にすると未確定として保存します。</div>
              {lastError ? <div className="alert">{lastError}</div> : null}
              <div className="detail-actions">
                <button className="cmd-button" onClick={handleSave}>
                  保存
                </button>
                <button
                  className="cmd-button cmd-button--ghost"
                  onClick={() => setIsEditing(false)}
                >
                  キャンセル
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="detail-block">
                <div className="detail-label">期間</div>
                <div className="detail-value">
                  {task.start ?? '?'} → {task.end ?? '?'}
                </div>
              </div>
              <div className="detail-block">
                <div className="detail-label">メモ</div>
                <div className="detail-value">{task.note ?? '?'}</div>
              </div>
              <div className="detail-block">
                <div className="detail-label">原文日付</div>
                <div className="detail-value detail-raw">{task.rawDate}</div>
              </div>
              <div className="detail-actions">
                <button className="cmd-button" onClick={() => setIsEditing(true)}>
                  編集
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  );
};

export default DetailsPane;

import { useEffect, useState } from 'react';
import { useAppStore } from '../state/store';

const SchedulesPage = () => {
  const [name, setName] = useState('');
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const schedules = useAppStore((state) => state.schedules);
  const currentScheduleId = useAppStore((state) => state.currentScheduleId);
  const loadSchedules = useAppStore((state) => state.loadSchedules);
  const createSchedule = useAppStore((state) => state.createSchedule);
  const updateSchedule = useAppStore((state) => state.updateSchedule);
  const deleteSchedule = useAppStore((state) => state.deleteSchedule);
  const switchSchedule = useAppStore((state) => state.switchSchedule);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const handleCreate = async () => {
    if (!name.trim()) {
      return;
    }
    await createSchedule(name.trim());
    setName('');
  };

  const startRename = (scheduleId: number, currentName: string) => {
    setEditingScheduleId(scheduleId);
    setEditingName(currentName);
  };

  const cancelRename = () => {
    setEditingScheduleId(null);
    setEditingName('');
  };

  const handleRenameSave = async () => {
    if (!editingScheduleId) {
      return;
    }
    const next = editingName.trim();
    if (!next) {
      return;
    }
    const ok = await updateSchedule(editingScheduleId, next);
    if (ok) {
      cancelRename();
    }
  };

  const handleDelete = async (scheduleId: number, scheduleName: string) => {
    if (scheduleId === currentScheduleId) {
      window.alert('このスケジュールは現在使用中のため削除できません。');
      return;
    }
    const ok = window.confirm(`スケジュール「${scheduleName}」を削除します。よろしいですか？`);
    if (!ok) {
      return;
    }
    await deleteSchedule(scheduleId);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>スケジュール管理</h1>
        <p>既存のスケジュールを作成・編集・削除します。</p>
      </div>
      <div className="view-save">
        <input
          className="text-input"
          placeholder="新しいスケジュール名"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="button" className="cmd-button" onClick={handleCreate}>
          追加
        </button>
      </div>
      {schedules.length === 0 ? (
        <div className="empty-state">スケジュールがありません。</div>
      ) : (
        <div className="list">
          {schedules.map((schedule) => (
            <div key={schedule.id} className="list-row list-row--action">
              <div>
                {editingScheduleId === schedule.id ? (
                  <>
                    <input
                      className="text-input"
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      placeholder="新しいスケジュール名"
                    />
                    <div className="list-subtitle">更新 {schedule.updatedAt}</div>
                  </>
                ) : (
                  <>
                    <div className="list-title">{schedule.name}</div>
                    <div className="list-subtitle">更新 {schedule.updatedAt}</div>
                  </>
                )}
              </div>
              <div className="list-metrics">
                <span>ID {schedule.id}</span>
                <span>{schedule.description ?? '説明なし'}</span>
              </div>
              <div className="list-actions">
                {editingScheduleId === schedule.id ? (
                  <>
                    <button
                      type="button"
                      className="cmd-button"
                      onClick={handleRenameSave}
                      disabled={editingName.trim().length === 0}
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      className="cmd-button cmd-button--ghost"
                      onClick={cancelRename}
                    >
                      キャンセル
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="cmd-button cmd-button--ghost"
                      disabled={schedule.id === currentScheduleId}
                      onClick={() => switchSchedule(schedule.id)}
                    >
                      {schedule.id === currentScheduleId ? '使用中' : '切り替え'}
                    </button>
                    <button
                      type="button"
                      className="cmd-button cmd-button--ghost"
                      onClick={() => startRename(schedule.id, schedule.name)}
                    >
                      名称変更
                    </button>
                    <button
                      type="button"
                      className="cmd-button"
                      disabled={schedule.id === currentScheduleId}
                      onClick={() => handleDelete(schedule.id, schedule.name)}
                    >
                      削除
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SchedulesPage;

import { useEffect, useState } from 'react';
import { useAppStore } from '../state/store';

const SchedulesPage = () => {
  const [name, setName] = useState('');
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

  const handleRename = async (scheduleId: number, currentName: string) => {
    const next = window.prompt('新しいスケジュール名', currentName);
    if (!next || !next.trim()) {
      return;
    }
    await updateSchedule(scheduleId, next.trim());
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
        <p>複数のスケジュールを作成し、切り替えて管理します。</p>
      </div>
      <div className="view-save">
        <input
          className="text-input"
          placeholder="新しいスケジュール名"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="button" className="cmd-button" onClick={handleCreate}>
          作成
        </button>
      </div>
      {schedules.length === 0 ? (
        <div className="empty-state">スケジュールがありません。</div>
      ) : (
        <div className="list">
          {schedules.map((schedule) => (
            <div key={schedule.id} className="list-row list-row--action">
              <div>
                <div className="list-title">{schedule.name}</div>
                <div className="list-subtitle">更新 {schedule.updatedAt}</div>
              </div>
              <div className="list-metrics">
                <span>ID {schedule.id}</span>
                <span>{schedule.description ?? '説明なし'}</span>
              </div>
              <div className="list-actions">
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
                  onClick={() => handleRename(schedule.id, schedule.name)}
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SchedulesPage;

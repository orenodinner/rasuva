import { useEffect } from 'react';
import GanttView from '../components/GanttView';
import { useAppStore } from '../state/store';

const GanttPage = () => {
  const gantt = useAppStore((state) => state.gantt);
  const loadGantt = useAppStore((state) => state.loadGantt);
  const currentScheduleId = useAppStore((state) => state.currentScheduleId);
  const rangeStart = useAppStore((state) => state.rangeStart);
  const rangeEnd = useAppStore((state) => state.rangeEnd);
  const setRange = useAppStore((state) => state.setRange);
  const collapsedGroups = useAppStore((state) => state.collapsedGroups);
  const setCollapsedGroups = useAppStore((state) => state.setCollapsedGroups);

  useEffect(() => {
    if (!currentScheduleId) {
      return;
    }
    if (!gantt) {
      loadGantt();
    }
  }, [gantt, loadGantt, currentScheduleId]);

  if (!currentScheduleId) {
    return (
      <div className="page gantt-page">
        <div className="page-header">
          <h1>ガント</h1>
          <p>スケジュールを選択してください。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page gantt-page">
      <div className="page-header">
        <h1>ガント</h1>
        <p>担当者 → プロジェクト → タスクのタイムラインです。</p>
      </div>
      <div className="view-toggle">
        <label className="range-control">
          <span>開始</span>
          <input
            className="text-input"
            type="date"
            value={rangeStart ?? ''}
            onChange={(event) => setRange(event.target.value || null, rangeEnd)}
          />
        </label>
        <label className="range-control">
          <span>終了</span>
          <input
            className="text-input"
            type="date"
            value={rangeEnd ?? ''}
            onChange={(event) => setRange(rangeStart, event.target.value || null)}
          />
        </label>
        <button className="cmd-button cmd-button--ghost" onClick={() => setRange(null, null)}>
          期間リセット
        </button>
        <button
          className="cmd-button cmd-button--ghost"
          onClick={() => setCollapsedGroups([])}
          disabled={collapsedGroups.length === 0}
        >
          折りたたみ解除
        </button>
      </div>
      <GanttView />
    </div>
  );
};

export default GanttPage;

import { useEffect, useMemo } from 'react';
import { useAppStore } from '../state/store';
import GanttView from '../components/GanttView';

const DiffPage = () => {
  const diff = useAppStore((state) => state.diff);
  const loadDiff = useAppStore((state) => state.loadDiff);

  useEffect(() => {
    loadDiff();
  }, [loadDiff]);

  const diffTasks = useMemo(() => {
    if (!diff) {
      return [];
    }
    return [...diff.added, ...diff.updated, ...diff.archived];
  }, [diff]);

  const taskClassMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!diff) {
      return map;
    }
    diff.added.forEach((task) => map.set(task.taskKeyFull, 'gantt-bar--added'));
    diff.updated.forEach((task) => map.set(task.taskKeyFull, 'gantt-bar--updated'));
    diff.archived.forEach((task) => map.set(task.taskKeyFull, 'gantt-bar--archived'));
    return map;
  }, [diff]);

  if (!diff) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>差分サマリー</h1>
          <p>差分情報がありません。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>差分サマリー</h1>
        <p>直前のインポートとの差分を表示します。</p>
      </div>
      <div className="stat-grid">
        <div className="stat-card">
          <span>追加</span>
          <strong>{diff.summary.added}</strong>
        </div>
        <div className="stat-card">
          <span>更新</span>
          <strong>{diff.summary.updated}</strong>
        </div>
        <div className="stat-card">
          <span>アーカイブ</span>
          <strong>{diff.summary.archived}</strong>
        </div>
        <div className="stat-card">
          <span>未確定</span>
          <strong>{diff.summary.unscheduled}</strong>
        </div>
        <div className="stat-card">
          <span>不正</span>
          <strong>{diff.summary.invalid}</strong>
        </div>
      </div>

      <div className="diff-legend">
        <div className="diff-legend__item">
          <span className="diff-legend__swatch diff-legend__swatch--added" />
          追加
        </div>
        <div className="diff-legend__item">
          <span className="diff-legend__swatch diff-legend__swatch--updated" />
          更新
        </div>
        <div className="diff-legend__item">
          <span className="diff-legend__swatch diff-legend__swatch--archived" />
          アーカイブ
        </div>
      </div>

      <section className="section">
        <GanttView
          tasks={diffTasks}
          emptyLabel="差分はありません。"
          getBarClassName={(task) => taskClassMap.get(task.taskKeyFull) ?? ''}
        />
      </section>
    </div>
  );
};

export default DiffPage;

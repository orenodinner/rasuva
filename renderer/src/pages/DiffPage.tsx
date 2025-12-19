import { useEffect } from 'react';
import { useAppStore } from '../state/store';
import TaskList from '../components/TaskList';

const DiffPage = () => {
  const diff = useAppStore((state) => state.diff);
  const loadDiff = useAppStore((state) => state.loadDiff);
  const setSelectedTask = useAppStore((state) => state.setSelectedTask);

  useEffect(() => {
    loadDiff();
  }, [loadDiff]);

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

      <section className="section">
        <div className="section-header">
          <h2>追加</h2>
        </div>
        <TaskList tasks={diff.added} onSelect={setSelectedTask} emptyLabel="追加はありません。" />
      </section>

      <section className="section">
        <div className="section-header">
          <h2>更新</h2>
        </div>
        <TaskList
          tasks={diff.updated}
          onSelect={setSelectedTask}
          emptyLabel="更新はありません。"
        />
      </section>

      <section className="section">
        <div className="section-header">
          <h2>アーカイブ</h2>
        </div>
        <TaskList
          tasks={diff.archived}
          onSelect={setSelectedTask}
          emptyLabel="アーカイブはありません。"
        />
      </section>
    </div>
  );
};

export default DiffPage;

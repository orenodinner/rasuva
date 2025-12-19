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
          <h1>Diff Summary</h1>
          <p>No diff available yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Diff Summary</h1>
        <p>Changes compared to the previous import.</p>
      </div>
      <div className="stat-grid">
        <div className="stat-card">
          <span>Added</span>
          <strong>{diff.summary.added}</strong>
        </div>
        <div className="stat-card">
          <span>Updated</span>
          <strong>{diff.summary.updated}</strong>
        </div>
        <div className="stat-card">
          <span>Archived</span>
          <strong>{diff.summary.archived}</strong>
        </div>
        <div className="stat-card">
          <span>Unscheduled</span>
          <strong>{diff.summary.unscheduled}</strong>
        </div>
        <div className="stat-card">
          <span>Invalid</span>
          <strong>{diff.summary.invalid}</strong>
        </div>
      </div>

      <section className="section">
        <div className="section-header">
          <h2>Added</h2>
        </div>
        <TaskList tasks={diff.added} onSelect={setSelectedTask} emptyLabel="No added tasks." />
      </section>

      <section className="section">
        <div className="section-header">
          <h2>Updated</h2>
        </div>
        <TaskList
          tasks={diff.updated}
          onSelect={setSelectedTask}
          emptyLabel="No updated tasks."
        />
      </section>

      <section className="section">
        <div className="section-header">
          <h2>Archived</h2>
        </div>
        <TaskList
          tasks={diff.archived}
          onSelect={setSelectedTask}
          emptyLabel="No archived tasks."
        />
      </section>
    </div>
  );
};

export default DiffPage;
